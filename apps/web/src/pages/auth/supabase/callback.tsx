import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { supabase } from 'src/lib/supabase';

// ----------------------------------------------------------------------

/**
 * OAuth callback page for Supabase.
 *
 * This page handles the redirect back from OAuth providers (e.g., Google).
 * When Supabase redirects back with tokens in the URL hash, we need to
 * explicitly exchange them for a session before redirecting.
 */
export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const returnTo = searchParams.get('returnTo') || paths.family.root;

  // Log immediately when component mounts
  console.log('[Auth Callback] Page loaded!');
  console.log('[Auth Callback] Full URL:', window.location.href);
  console.log('[Auth Callback] Hash:', window.location.hash);
  console.log('[Auth Callback] returnTo:', returnTo);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('[Auth Callback] handleOAuthCallback running...');
        // Check if we have hash params (OAuth redirect includes tokens in hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        console.log('[Auth Callback] Has access_token:', !!accessToken);
        console.log('[Auth Callback] Has refresh_token:', !!refreshToken);

        if (accessToken && refreshToken) {
          // Exchange the tokens for a session
          console.log('[Auth Callback] Exchanging OAuth tokens for session...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('[Auth Callback] Session error:', sessionError);
            setError(sessionError.message);
            return;
          }

          console.log('[Auth Callback] Session established, redirecting to:', returnTo);
          router.replace(returnTo);
        } else {
          // No tokens in hash - check if we already have a session
          console.log('[Auth Callback] No tokens in hash, checking existing session...');
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            console.log('[Auth Callback] Existing session found, redirecting to:', returnTo);
            router.replace(returnTo);
          } else {
            console.error('[Auth Callback] No tokens or session found');
            setError('Authentication failed - no tokens received');
          }
        }
      } catch (err) {
        console.error('[Auth Callback] Error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleOAuthCallback();
  }, [returnTo, router]);

  if (error) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error}
        </Alert>
        <Typography
          variant="body2"
          color="primary"
          sx={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => router.replace(paths.auth.supabase.signIn)}
        >
          Return to sign in
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body2" color="text.secondary">
        Signing you in...
      </Typography>
    </Box>
  );
}
