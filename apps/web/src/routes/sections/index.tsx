import type { RouteObject } from 'react-router';

import { lazy } from 'react';
import { Navigate } from 'react-router';

import { authRoutes } from './auth';
import { listsRoutes } from './lists';
import { familyRoutes } from './family';
import { inviteRoutes } from './invite';
import { settingsRoutes } from './settings';

// ----------------------------------------------------------------------

const Page404 = lazy(() => import('src/pages/error/404'));

export const routesSection: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/family" replace />,
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
