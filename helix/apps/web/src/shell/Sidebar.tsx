import { NavLink, AppShell, Group, Text, Burger, Button, Stack } from '@mantine/core';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconHome,
  IconClipboardList,
  IconPlus,
  IconSettings,
  IconUsers,
  IconHeartbeat,
  IconInbox,
  IconBuilding,
  IconCoin,
  IconBriefcase,
  IconLayoutGrid,
  IconFlag,
  IconLogout,
  IconGlobe,
  IconHistory,
  IconDatabase,
} from '@tabler/icons-react';
import { Role } from '@helix/types';
import { useAuthStore } from '../stores/auth.store';
import { useShellStore } from '../stores/shell.store';
import { useLogout } from '../features/auth/hooks/useAuth';

interface NavItem {
  path: string;
  labelKey: string;
  exact: boolean;
  icon: React.ComponentType<{ size?: number | string }>;
  roles: Role[] | null;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'nav.dashboard', exact: true, icon: IconHome, roles: null },
  { path: '/demands', labelKey: 'nav.demands', exact: true, icon: IconClipboardList, roles: null },
  { path: '/demands/unified-queue', labelKey: 'nav.actionQueue', exact: true, icon: IconInbox, roles: [Role.DemandManager, Role.BusinessController, Role.PortfolioManager, Role.DemandRequester] },
  { path: '/portfolio', labelKey: 'nav.portfolio', exact: true, icon: IconLayoutGrid, roles: [Role.PortfolioManager] },
  { path: '/projects', labelKey: 'nav.projects', exact: false, icon: IconBriefcase, roles: null },
  { path: '/demands/new', labelKey: 'nav.newDemand', exact: true, icon: IconPlus, roles: [Role.DemandRequester] },
  { path: '/admin', labelKey: 'nav.admin', exact: true, icon: IconSettings, roles: [Role.SECMember] },
  { path: '/admin/users', labelKey: 'nav.adminUsers', exact: true, icon: IconUsers, roles: [Role.Admin] },
  { path: '/admin/routing-health', labelKey: 'nav.routingHealth', exact: true, icon: IconHeartbeat, roles: [Role.Admin] },
  { path: '/admin/cost-centres', labelKey: 'nav.costCentres', exact: true, icon: IconBuilding, roles: [Role.Admin] },
  { path: '/admin/gl-accounts', labelKey: 'nav.glAccounts', exact: true, icon: IconCoin, roles: [Role.Admin] },
  { path: '/admin/legal-entities', labelKey: 'nav.legalEntities', exact: true, icon: IconBriefcase, roles: [Role.Admin] },
  { path: '/admin/areas', labelKey: 'nav.areas', exact: true, icon: IconLayoutGrid, roles: [Role.Admin] },
  { path: '/admin/countries', labelKey: 'nav.countries', exact: true, icon: IconGlobe, roles: [Role.Admin] },
  { path: '/admin/system-config', labelKey: 'nav.systemConfig', exact: true, icon: IconSettings, roles: [Role.Admin] },
  { path: '/admin/feature-flags', labelKey: 'nav.featureFlags', exact: true, icon: IconFlag, roles: [Role.Admin] },
  { path: '/admin/audit-log', labelKey: 'nav.auditLog', exact: true, icon: IconHistory, roles: [Role.Admin] },
  { path: '/admin/sap-integration', labelKey: 'nav.sapIntegration', exact: true, icon: IconDatabase, roles: [Role.Admin] },
];

export function Sidebar(): JSX.Element {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { navbarOpen, toggleNavbar } = useShellStore();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const switchLang = (lang: string): void => {
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      item.roles === null ||
      (user?.roles ?? []).some((r) => item.roles!.includes(r)),
  );

  const nonAdminItems = visibleItems.filter((item) => !item.path.startsWith('/admin'));
  const adminItems = visibleItems.filter((item) => item.path.startsWith('/admin'));
  const adminParentItem = adminItems.find((item) => item.path === '/admin');
  const adminSubItems = adminItems.filter((item) => item.path !== '/admin');
  const isOnAdminRoute = location.pathname.startsWith('/admin');

  const [adminSectionOpen, setAdminSectionOpen] = useState(isOnAdminRoute);
  useEffect(() => {
    if (isOnAdminRoute) setAdminSectionOpen(true);
  }, [isOnAdminRoute]);

  function renderNavItem(item: NavItem) {
    const isActive = item.exact
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path);
    const Icon = item.icon;
    return (
      <NavLink<typeof Link>
        key={item.path}
        label={navbarOpen ? t(item.labelKey) : undefined}
        leftSection={<Icon size={20} />}
        active={isActive}
        aria-current={isActive ? 'page' : undefined}
        component={Link}
        to={item.path}
        color="stadaRed"
        variant="filled"
      />
    );
  }

  return (
    <>
      <AppShell.Section p="md">
        <Group gap="xs" wrap="nowrap">
          <Burger
            opened={navbarOpen}
            onClick={toggleNavbar}
            aria-label={t('shell.toggleNav')}
            size="sm"
          />
          {navbarOpen && (
            <Text fw={700} c="stadaRed" size="lg" truncate>
              {t('shell.appName')}
            </Text>
          )}
        </Group>
      </AppShell.Section>

      <AppShell.Section grow>
        {nonAdminItems.map(renderNavItem)}

        {navbarOpen && adminSubItems.length > 0 ? (
          <NavLink
            label={t('nav.admin')}
            leftSection={<IconSettings size={20} />}
            active={isOnAdminRoute}
            opened={adminSectionOpen}
            onChange={setAdminSectionOpen}
            color="stadaRed"
            variant="filled"
          >
            {adminParentItem && renderNavItem(adminParentItem)}
            {adminSubItems.map(renderNavItem)}
          </NavLink>
        ) : (
          adminItems.map(renderNavItem)
        )}
      </AppShell.Section>

      <AppShell.Section p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
        <Stack gap="xs">
          {navbarOpen && user?.name && (
            <Text c="dimmed" size="sm" truncate>
              {user.name}
            </Text>
          )}
          <Group gap={4} justify={navbarOpen ? 'flex-start' : 'center'}>
            <Button
              variant={i18n.language === 'en' ? 'filled' : 'subtle'}
              size="compact-sm"
              color="gray"
              onClick={() => switchLang('en')}
            >
              {t('shell.langEn')}
            </Button>
            <Button
              variant={i18n.language === 'de' ? 'filled' : 'subtle'}
              size="compact-sm"
              color="gray"
              onClick={() => switchLang('de')}
            >
              {t('shell.langDe')}
            </Button>
          </Group>
          <Button
            variant="subtle"
            size="compact-sm"
            color="gray"
            justify={navbarOpen ? 'flex-start' : 'center'}
            leftSection={<IconLogout size={16} />}
            fullWidth
            loading={logout.isPending}
            onClick={() => logout.mutate()}
          >
            {navbarOpen ? t('shell.logout') : undefined}
          </Button>
        </Stack>
      </AppShell.Section>
    </>
  );
}
