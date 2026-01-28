import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';

import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

const InviteAcceptPage = lazy(() => import('src/pages/invite/accept'));

// ----------------------------------------------------------------------

export const inviteRoutes: RouteObject[] = [
  {
    path: 'invite/:token',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <InviteAcceptPage />
      </Suspense>
    ),
  },
];
