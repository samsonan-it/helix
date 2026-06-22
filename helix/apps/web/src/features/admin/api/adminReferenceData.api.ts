import { api } from '../../../lib/api';
import {
  CostCentreAdminRow,
  CreateCostCentreDto,
  UpdateCostCentreDto,
  GlAccountAdminRow,
  CreateGlAccountDto,
  UpdateGlAccountDto,
  LegalEntityAdminRow,
  CreateLegalEntityDto,
  UpdateLegalEntityDto,
  AreaAdminRow,
  CreateAreaDto,
  UpdateAreaDto,
  CountryAdminRow,
  CreateCountryDto,
  UpdateCountryDto,
} from '@helix/shared';

// ── Cost Centres ──────────────────────────────────────────────────

export async function listAdminCostCentres(): Promise<CostCentreAdminRow[]> {
  const res = await api.get<CostCentreAdminRow[]>('/admin/cost-centres');
  return res.data;
}

export async function createAdminCostCentre(dto: CreateCostCentreDto): Promise<CostCentreAdminRow> {
  const res = await api.post<CostCentreAdminRow>('/admin/cost-centres', dto);
  return res.data;
}

export async function updateAdminCostCentre(id: string, dto: UpdateCostCentreDto): Promise<CostCentreAdminRow> {
  const res = await api.patch<CostCentreAdminRow>(`/admin/cost-centres/${id}`, dto);
  return res.data;
}

export async function deactivateAdminCostCentre(id: string): Promise<void> {
  await api.patch(`/admin/cost-centres/${id}/deactivate`);
}

export async function activateAdminCostCentre(id: string): Promise<void> {
  await api.patch(`/admin/cost-centres/${id}/activate`);
}

// ── GL Accounts ───────────────────────────────────────────────────

export async function listAdminGlAccounts(): Promise<GlAccountAdminRow[]> {
  const res = await api.get<GlAccountAdminRow[]>('/admin/gl-accounts');
  return res.data;
}

export async function createAdminGlAccount(dto: CreateGlAccountDto): Promise<GlAccountAdminRow> {
  const res = await api.post<GlAccountAdminRow>('/admin/gl-accounts', dto);
  return res.data;
}

export async function updateAdminGlAccount(id: string, dto: UpdateGlAccountDto): Promise<GlAccountAdminRow> {
  const res = await api.patch<GlAccountAdminRow>(`/admin/gl-accounts/${id}`, dto);
  return res.data;
}

export async function deactivateAdminGlAccount(id: string): Promise<void> {
  await api.patch(`/admin/gl-accounts/${id}/deactivate`);
}

export async function activateAdminGlAccount(id: string): Promise<void> {
  await api.patch(`/admin/gl-accounts/${id}/activate`);
}

// ── Legal Entities ────────────────────────────────────────────────

export async function listAdminLegalEntities(): Promise<LegalEntityAdminRow[]> {
  const res = await api.get<LegalEntityAdminRow[]>('/admin/legal-entities');
  return res.data;
}

export async function createAdminLegalEntity(dto: CreateLegalEntityDto): Promise<LegalEntityAdminRow> {
  const res = await api.post<LegalEntityAdminRow>('/admin/legal-entities', dto);
  return res.data;
}

export async function updateAdminLegalEntity(id: string, dto: UpdateLegalEntityDto): Promise<LegalEntityAdminRow> {
  const res = await api.patch<LegalEntityAdminRow>(`/admin/legal-entities/${id}`, dto);
  return res.data;
}

export async function deactivateAdminLegalEntity(id: string): Promise<void> {
  await api.patch(`/admin/legal-entities/${id}/deactivate`);
}

export async function activateAdminLegalEntity(id: string): Promise<void> {
  await api.patch(`/admin/legal-entities/${id}/activate`);
}

// ── Areas ─────────────────────────────────────────────────────────

export async function listAdminAreas(): Promise<AreaAdminRow[]> {
  const res = await api.get<AreaAdminRow[]>('/admin/areas');
  return res.data;
}

export async function createAdminArea(dto: CreateAreaDto): Promise<AreaAdminRow> {
  const res = await api.post<AreaAdminRow>('/admin/areas', dto);
  return res.data;
}

export async function updateAdminArea(id: string, dto: UpdateAreaDto): Promise<AreaAdminRow> {
  const res = await api.patch<AreaAdminRow>(`/admin/areas/${id}`, dto);
  return res.data;
}

export async function deactivateAdminArea(id: string): Promise<void> {
  await api.patch(`/admin/areas/${id}/deactivate`);
}

export async function activateAdminArea(id: string): Promise<void> {
  await api.patch(`/admin/areas/${id}/activate`);
}

// ── Countries ─────────────────────────────────────────────────────

export async function listAdminCountries(): Promise<CountryAdminRow[]> {
  const res = await api.get<CountryAdminRow[]>('/admin/countries');
  return res.data;
}

export async function createAdminCountry(dto: CreateCountryDto): Promise<CountryAdminRow> {
  const res = await api.post<CountryAdminRow>('/admin/countries', dto);
  return res.data;
}

export async function updateAdminCountry(id: string, dto: UpdateCountryDto): Promise<CountryAdminRow> {
  const res = await api.patch<CountryAdminRow>(`/admin/countries/${id}`, dto);
  return res.data;
}

export async function deactivateAdminCountry(id: string): Promise<void> {
  await api.patch(`/admin/countries/${id}/deactivate`);
}

export async function activateAdminCountry(id: string): Promise<void> {
  await api.patch(`/admin/countries/${id}/activate`);
}
