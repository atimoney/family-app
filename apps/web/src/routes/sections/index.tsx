import type { RouteObject } from 'react-router';

import { Navigate } from 'react-router';
import { lazy, useState, useEffect } from 'react';

import { supabase } from 'src/lib/supabase';

import { authRoutes } from './auth';
import { listsRoutes } from './lists';
import { familyRoutes } from './family';
import { inviteRoutes } from './invite';
import { settingsRoutes } from './settings';

// ----------------------------------------------------------------------

const Page404 = lazy(() => import('src/pages/error/404'));

/**
 * Root redirect component that handles OAuth hash tokens before redirecting.
 * This is needed because Supabase redirects to the root URL with tokens in the hash,
 * and the Navigate component would strip them before they can be processed.
 */
function RootRedirect() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleHashTokens = async () => {
      const hash = window.location.hash;
      
      if (hash && hash.includes('access_token=')) {
        console.log('[RootRedirect] Found OAuth tokens in hash, processing...');
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('[RootRedirect] Error setting session:', error);
            } else {
              console.log('[RootRedirect] Session established successfully');
            }
          } catch (err) {
            console.error('[RootRedirect] Exception setting session:', err);
          }
        }
      }
      
      setReady(true);
    };

    handleHashTokens();
  }, []);

  if (!ready) {
    return null; // Or a loading spinner
  }

  return <Navigate to="/family" replace />;
}

export const routesSection: RouteObject[] = [
  {
    path: '/',
    element: <RootRedirect />,
  },

  // Auth
  ...authRoutes,

  // Family
  ...familyRoutes,

  // Lists
  ...listsRoutes,

  // Invite (public)
  ...inviteRoutes,

  // Settings
  ...settingsRoutes,

  // No match
  { path: '*', element: <Page404 /> },
];
