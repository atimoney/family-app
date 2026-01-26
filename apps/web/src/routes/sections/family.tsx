import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { Outlet, Navigate } from 'react-router';

import { CONFIG } from 'src/global-config';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AuthGuard } from 'src/auth/guard';

import { usePathname } from '../hooks';

// ----------------------------------------------------------------------

const FamilyCalendarPage = lazy(() => import('src/pages/family/calendar'));
const FamilyTasksPage = lazy(() => import('src/pages/family/tasks'));
const FamilyShoppingPage = lazy(() => import('src/pages/family/shopping'));

// ----------------------------------------------------------------------

function SuspenseOutlet() {
  const pathname = usePathname();
  return (
    <Suspense key={pathname} fallback={<LoadingScreen />}>
      <Outlet />
    </Suspense>
  );
}

const dashboardLayout = () => (
  <DashboardLayout>
    <SuspenseOutlet />
  </DashboardLayout>
);

export const familyRoutes: RouteObject[] = [
  {
    path: 'family',
    element: CONFIG.auth.skip ? dashboardLayout() : <AuthGuard>{dashboardLayout()}</AuthGuard>,
    children: [
      { index: true, element: <Navigate to="calendar" replace /> },
      { path: 'calendar', element: <FamilyCalendarPage /> },
      { path: 'tasks', element: <FamilyTasksPage /> },
      { path: 'shopping', element: <FamilyShoppingPage /> },
    ],
  },
];
