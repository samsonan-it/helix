import { Burger, Group, Text, Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth.store';
import { useShellStore } from '../stores/shell.store';

export function TopBar(): JSX.Element {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { navbarOpen, toggleNavbar } = useShellStore();

  const switchLang = (lang: string): void => {
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  };

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group>
        <Burger
          opened={navbarOpen}
          onClick={toggleNavbar}
          aria-label={t('shell.toggleNav')}
          size="sm"
        />
        <Text fw={700} size="lg">
          {t('shell.appName')}
        </Text>
      </Group>
      <Group gap="xs">
        {user?.name && <Text size="sm">{user.name}</Text>}
        <Button
          variant={i18n.language === 'en' ? 'filled' : 'subtle'}
          size="compact-sm"
          onClick={() => switchLang('en')}
        >
          {t('shell.langEn')}
        </Button>
        <Button
          variant={i18n.language === 'de' ? 'filled' : 'subtle'}
          size="compact-sm"
          onClick={() => switchLang('de')}
        >
          {t('shell.langDe')}
        </Button>
      </Group>
    </Group>
  );
}
