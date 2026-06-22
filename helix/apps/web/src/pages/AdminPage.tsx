import { IconSettings } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { PageLayout } from '../components/PageLayout';

export function AdminPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <PageLayout>
      <PageHeader title={t('pages.admin')} icon={<IconSettings size={22} />} />
    </PageLayout>
  );
}
