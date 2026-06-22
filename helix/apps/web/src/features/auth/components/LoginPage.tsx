import { Alert, Badge, Button, Group, LoadingOverlay, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useDevLogin, useDevUsers } from '../hooks/useAuth';

const AZURE_CONFIGURED = Boolean(import.meta.env.VITE_AZURE_AD_CLIENT_ID);

export function LoginPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('error');
  const authEmail = searchParams.get('email');
  const { data: users, isLoading: usersLoading } = useDevUsers({ enabled: !authError && !AZURE_CONFIGURED });
  const loginMutation = useDevLogin();

  if (authError) {
    return (
      <Stack p="xl" maw={480} mx="auto">
        <Alert color="stadaRed" title={authError === 'auth_failed' ? t('auth.notProvisionedTitle') : t('auth.loginError')}>
          {authError === 'auth_failed' ? (
            <Stack gap="xs">
              <Text>{t('auth.notProvisioned')}</Text>
              {authEmail && <Text size="sm" c="red.3">{authEmail}</Text>}
            </Stack>
          ) : authError}
        </Alert>
      </Stack>
    );
  }

  if (AZURE_CONFIGURED) {
    return (
      <Stack p="xl" maw={480} mx="auto" align="center">
        <Title order={1}>Helix</Title>
        <Button
          size="md"
          onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL}/auth/azure`; }}
        >
          {t('auth.msalLoginButton')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack p="xl" maw={960} mx="auto" pos="relative">
      <LoadingOverlay visible={loginMutation.isPending} />
      <Title order={1}>{t('auth.devLoginTitle')}</Title>
      <Alert color="orange" title={t('auth.devLoginWarning')} />

      {loginMutation.isError && (
        <Alert color="stadaRed">{t('auth.loginError')}</Alert>
      )}

      {usersLoading && <Text>{t('auth.loadingUsers')}</Text>}

      <Table withTableBorder withColumnBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('auth.colName')}</Table.Th>
            <Table.Th>{t('auth.colEmail')}</Table.Th>
            <Table.Th>{t('auth.colRoles')}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...(users ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
            <Table.Tr key={user.id}>
              <Table.Td><Text fw={600}>{user.name}</Text></Table.Td>
              <Table.Td><Text size="sm" c="dimmed">{user.email}</Text></Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {user.roles.map((role) => (
                    <Badge key={role} size="sm" variant="light">{role}</Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <Button
                  size="xs"
                  onClick={() => loginMutation.mutate(user.id)}
                  loading={loginMutation.isPending}
                  disabled={loginMutation.isPending}
                >
                  {t('auth.loginButton', { name: user.name })}
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
