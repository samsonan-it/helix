import { AppShell } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { RoteEcke } from '../components/RoteEcke';
import { useShellStore } from '../stores/shell.store';

export function AppShellLayout(): JSX.Element {
  const { t } = useTranslation();
  const navbarOpen = useShellStore((s) => s.navbarOpen);

  return (
    <>
      <a href="#main-content" className="skip-link">
        {t('shell.skipToMain')}
      </a>
      <RoteEcke />
      <AppShell
        navbar={{
          width: navbarOpen ? 240 : 64,
          breakpoint: 'lg',
          collapsed: { mobile: !navbarOpen },
        }}
      >
        <AppShell.Navbar className="helix-sidebar">
          <Sidebar />
        </AppShell.Navbar>
        {/* bg = design-system §4 appBackground token (theme.other.appBackground #F9FAFB); pr={96} clears the Rote Ecke */}
        <AppShell.Main id="main-content" bg="#f9fafb" pr={96}>
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </>
  );
}
