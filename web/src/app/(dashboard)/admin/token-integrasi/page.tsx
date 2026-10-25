import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/ui';
import { CreateTokenButton, IntegrationTokens } from '@/features/admin/integration-tokens';
import { apiGet, getSessionUser } from '@/lib/api/server';
import type { IntegrationTokenList } from '@/lib/types';

export default async function TokenIntegrasiPage() {
  const me = await getSessionUser();
  if (me?.role !== 'SUPERADMIN') return <AccessDenied who="superadmin" />;
  const list = await apiGet<IntegrationTokenList>('/admin/integration-tokens');

  return (
    <>
      <PageHeader
        title="Token Integrasi"
        subtitle="Akses baca-saja Baharkam Command Center (Pusat) ke /integration/*"
        actions={<CreateTokenButton accounts={list.accounts} defaultIps={list.defaultIps} />}
      />
      <IntegrationTokens list={list} tz={me.unit.timezone} />
    </>
  );
}
