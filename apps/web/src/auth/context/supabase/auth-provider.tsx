import type { AuthState } from '../../types';

import { useSetState } from 'minimal-shared/hooks';
import { useMemo, useEffect, useCallback } from 'react';

import axios from 'src/lib/axios';
import { supabase } from 'src/lib/supabase';

import { AuthContext } from '../auth-context';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const { state, setState } = useSetState<AuthState>({ user: null, loading: true });

  const checkUserSession = useCallback(async () => {
    try {
      console.log('[Auth] checkUserSession called');
      console.log('[Auth] Current URL hash:', window.location.hash ? 'has hash' : 'no hash');
      
      // Check if we have OAuth tokens in the URL hash (can happen if redirected to wrong page)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        console.log('[Auth] Found tokens in URL hash, processing...');
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('[Auth] Setting session from hash tokens...');
          const { error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (setError) {
            console.error('[Auth] Error setting session:', setError);
          } else {
            console.log('[Auth] Session set successfully, clearing hash');
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      }
      
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      console.log('[Auth] getSession result:', { hasSession: !!session, error: error?.message });

      if (error) {
        console.error('[Auth] Session error:', error);
        setState({ user: null, loading: false });
        console.error(error);
        throw error;
      }

      if (session) {
        console.log('[Auth] Session found, user:', session.user?.email);
        const accessToken = session?.access_token;

        // Merge session and user data for consistent access
        setState({ user: { ...session, ...session?.user }, loading: false });

        // Set auth header for API requests
        axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      } else {
        console.log('[Auth] No session found');
        setState({ user: null, loading: false });
        delete axios.defaults.headers.common.Authorization;
      }
    } catch (error) {
      console.error('[Auth] checkUserSession error:', error);
      setState({ user: null, loading: false });
    }
  }, [setState]);

  useEffect(() => {
    checkUserSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to auth state changes (sign in, sign out, token refresh)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event, 'hasSession:', !!session, 'user:', session?.user?.email);

      if (session) {
        console.log('[Auth] Setting authenticated state');
        setState({ user: { ...session, ...session.user }, loading: false });
        axios.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
      } else {
        console.log('[Auth] Clearing authenticated state');
        setState({ user: null, loading: false });
        delete axios.defaults.headers.common.Authorization;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setState]);

  // ----------------------------------------------------------------------

  const checkAuthenticated = state.user ? 'authenticated' : 'unauthenticated';

  const status = state.loading ? 'loading' : checkAuthenticated;

  const memoizedValue = useMemo(
    () => {
      const photoURL =
        state.user?.user_metadata?.avatar_url ||
        state.user?.user_metadata?.picture;

      return {
        user: state.user
          ? {
              ...state.user,
              id: state.user?.id,
              accessToken: state.user?.access_token,
              displayName:
                state.user?.user_metadata?.display_name ||
                state.user?.user_metadata?.full_name ||
                state.user?.user_metadata?.name ||
                state.user?.email,
              email: state.user?.email,
              photoURL,
              role: state.user?.role ?? 'user',
            }
          : null,
        checkUserSession,
        loading: status === 'loading',
        authenticated: status === 'authenticated',
        unauthenticated: status === 'unauthenticated',
      };
    },
    [checkUserSession, state.user, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
