import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-datatable/styles.css';
import './global.css';
import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { theme } from './theme';
import { router } from './router';
import { queryClient } from './lib/query-client';
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

function restorePostAuthRedirect() {
  const saved = sessionStorage.getItem('helix_post_auth_redirect');
  if (saved) {
    sessionStorage.removeItem('helix_post_auth_redirect');
    // Apply before React Router reads the initial URL so the correct route renders.
    window.history.replaceState(null, '', saved);
  }
}

restorePostAuthRedirect();

function bootstrap() {
  createRoot(rootElement!).render(
    <StrictMode>
      <MantineProvider theme={theme}>
        <ModalsProvider>
          <Notifications />
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ModalsProvider>
      </MantineProvider>
    </StrictMode>,
  );
}

bootstrap();
