import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Alert, Center, Container, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AppShellLayout } from './shell/AppShell';
import { getMe } from './features/auth/api/authApi';
import { useAuthStore } from './stores/auth.store';
import { queryKeys } from './lib/queryKeys';
import { AuthUser, Role } from '@helix/types';

function AdminGuard(): JSX.Element | null {
  const user = useAuthStore((s) => s.user);
  if (!user || !user.roles.includes(Role.Admin)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function RequesterGuard(): JSX.Element | null {
  const user = useAuthStore((s) => s.user);
  if (!user || !user.roles.includes(Role.DemandRequester)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function PortfolioManagerGuard(): JSX.Element | null {
  const user = useAuthStore((s) => s.user);
  if (!user || !user.roles.includes(Role.PortfolioManager)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function QueueRedirect(): JSX.Element {
  const location = useLocation();
  return <Navigate to={`/demands/unified-queue${location.search}`} replace />;
}

/**
 * AuthGuard — fetches GET /auth/me on mount.
 * On 401, api.ts response interceptor redirects to /auth/azure (prod) or /login (dev).
 */
function AuthGuard(): JSX.Element | null {
  const setUser = useAuthStore((s) => s.setUser);

  const { isPending, isError, error } = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () =>
      getMe().then((user: AuthUser) => {
        setUser(user);
        return user;
      }),
    retry: false,
  });

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (isError) {
    // 401 is handled by the api.ts response interceptor (redirects to /auth/azure or /login).
    // 403 means the authenticated user is not provisioned in Helix.
    const is403 = axios.isAxiosError(error) && error.response?.status === 403;
    if (is403) {
      return (
        <Container size="xs" pt="xl">
          <Alert color="stadaRed" title="Account not provisioned">
            Your account is not provisioned in Helix. Contact your system administrator.
          </Alert>
        </Container>
      );
    }
    return (
      <Container size="xs" pt="xl">
        <Alert color="stadaRed" title="Unable to load session">
          Could not reach the server. Please refresh the page or contact support if the problem persists.
        </Alert>
      </Container>
    );
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    lazy: () => import('./features/auth/components/LoginPage').then((m) => ({ Component: m.LoginPage })),
  },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        element: <AppShellLayout />,
        children: [
          {
            index: true,
            lazy: () => import('./pages/DashboardPage').then((m) => ({ Component: m.DashboardPage })),
          },
          {
            path: 'demands',
            lazy: () => import('./pages/DemandsPage').then((m) => ({ Component: m.DemandsPage })),
          },
          {
            element: <RequesterGuard />,
            children: [
              {
                path: 'demands/new',
                lazy: () => import('./pages/NewDemandPage').then((m) => ({ Component: m.NewDemandPage })),
              },
            ],
          },
          { path: 'demands/queue',    element: <QueueRedirect /> },
          { path: 'demands/bc-queue', element: <QueueRedirect /> },
          { path: 'demands/pm-queue', element: <QueueRedirect /> },
          {
            path: 'demands/unified-queue',
            lazy: () => import('./pages/UnifiedQueuePage').then((m) => ({ Component: m.UnifiedQueuePage })),
          },
          {
            path: 'demands/:id/confirmation',
            lazy: () => import('./pages/DemandConfirmationPage').then((m) => ({ Component: m.DemandConfirmationPage })),
          },
          {
            path: 'demands/:id/financial-planning',
            lazy: () => import('./pages/FinancialPlanningPage').then((m) => ({ Component: m.FinancialPlanningPage })),
          },
          {
            path: 'demands/:id',
            lazy: () => import('./pages/NewDemandPage').then((m) => ({ Component: m.NewDemandPage })),
          },
          {
            element: <PortfolioManagerGuard />,
            children: [
              {
                path: 'portfolio',
                lazy: () => import('./pages/PortfolioPage').then((m) => ({ Component: m.PortfolioPage })),
              },
            ],
          },
          {
            path: 'projects',
            lazy: () => import('./pages/ProjectsPage').then((m) => ({ Component: m.ProjectsPage })),
          },
          {
            path: 'projects/:id/status-report',
            lazy: () => import('./pages/StatusReportPage').then((m) => ({ Component: m.StatusReportPage })),
          },
          {
            path: 'projects/:id',
            lazy: () => import('./pages/ProjectDetailPage').then((m) => ({ Component: m.ProjectDetailPage })),
          },
          {
            path: 'admin',
            lazy: () => import('./pages/AdminPage').then((m) => ({ Component: m.AdminPage })),
          },
          {
            element: <AdminGuard />,
            children: [
              {
                path: 'admin/users',
                lazy: () => import('./features/admin/pages/AdminUsersPage').then((m) => ({ Component: m.AdminUsersPage })),
              },
              {
                path: 'admin/routing-health',
                lazy: () => import('./features/admin/pages/RoutingHealthPage').then((m) => ({ Component: m.RoutingHealthPage })),
              },
              {
                path: 'admin/cost-centres',
                lazy: () => import('./features/admin/pages/CostCentresAdminPage').then((m) => ({ Component: m.CostCentresAdminPage })),
              },
              {
                path: 'admin/gl-accounts',
                lazy: () => import('./features/admin/pages/GlAccountsAdminPage').then((m) => ({ Component: m.GlAccountsAdminPage })),
              },
              {
                path: 'admin/legal-entities',
                lazy: () => import('./features/admin/pages/LegalEntitiesAdminPage').then((m) => ({ Component: m.LegalEntitiesAdminPage })),
              },
              {
                path: 'admin/areas',
                lazy: () => import('./features/admin/pages/AreasAdminPage').then((m) => ({ Component: m.AreasAdminPage })),
              },
              {
                path: 'admin/countries',
                lazy: () => import('./features/admin/pages/CountriesAdminPage').then((m) => ({ Component: m.CountriesAdminPage })),
              },
              {
                path: 'admin/system-config',
                lazy: () => import('./features/admin/pages/SystemConfigPage').then((m) => ({ Component: m.SystemConfigPage })),
              },
              {
                path: 'admin/feature-flags',
                lazy: () => import('./features/admin/pages/FeatureFlagsAdminPage').then((m) => ({ Component: m.FeatureFlagsAdminPage })),
              },
              {
                path: 'admin/audit-log',
                lazy: () => import('./features/admin/pages/AuditLogAdminPage').then((m) => ({ Component: m.AuditLogAdminPage })),
              },
              {
                path: 'admin/sap-integration',
                lazy: () => import('./features/admin/pages/SapIntegrationAdminPage').then((m) => ({ Component: m.SapIntegrationAdminPage })),
              },
            ],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
