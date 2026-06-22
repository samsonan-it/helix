import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import {
  CreateDemandDto,
  UpdateDraftDemandDto,
  UpdateDemandDatesDto,
  SaveDmAssessmentDraftDto,
  DemandResponse,
  CostCentreResponse,
  GlAccountResponse,
  LegalEntityResponse,
  AreaResponse,
  CountryResponse,
  PersonResponse,
  SystemSettingsResponse,
  systemSettingsResponseSchema,
  FinancialPlanResponse,
  UpdateFinancialPlanEntriesDto,
  UpdateFinancialPlanEntryItem,
} from '@helix/shared';

export const defaultSystemSettings: SystemSettingsResponse = {
  spThresholdEurCents:   5_000_000,
  intakeWindowStart:     null,
  intakeWindowEnd:       null,
  budgetCycleStart:      null,
  budgetCycleEnd:        null,
  gxpItValidationDays:   30,
  gxpDocumentationDays:  14,
};

async function createDemand(dto: CreateDemandDto): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>('/demands', dto);
  return data;
}

async function updateDemand(id: string, dto: UpdateDraftDemandDto): Promise<DemandResponse> {
  const { data } = await api.patch<DemandResponse>(`/demands/${id}`, dto);
  return data;
}

async function getDemand(id: string): Promise<DemandResponse> {
  const { data } = await api.get<DemandResponse>(`/demands/${id}`);
  return data;
}

export function useCreateDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDemand,
    onSuccess: (demand) => {
      queryClient.setQueryData(queryKeys.demands.detail(demand.id), demand);
    },
  });
}

export function useUpdateDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDraftDemandDto }) =>
      updateDemand(id, dto),
    onSuccess: (demand) => {
      queryClient.setQueryData(queryKeys.demands.detail(demand.id), demand);
    },
  });
}

async function updateDemandDates(demandId: string, dto: UpdateDemandDatesDto): Promise<DemandResponse> {
  const { data } = await api.patch<DemandResponse>(`/demands/${demandId}/dates`, dto);
  return data;
}

export function useUpdateDemandDates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ demandId, dto }: { demandId: string; dto: UpdateDemandDatesDto }) =>
      updateDemandDates(demandId, dto),
    onSuccess: (demand) => {
      queryClient.setQueryData(queryKeys.demands.detail(demand.id), demand);
    },
    // onError: caller components pass an onError option to revert local date state
  });
}

async function saveAssessmentDraft(demandId: string, dto: SaveDmAssessmentDraftDto): Promise<DemandResponse> {
  const { data } = await api.patch<DemandResponse>(`/demands/${demandId}/assessment`, dto);
  return data;
}

export function useSaveAssessmentDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ demandId, dto }: { demandId: string; dto: SaveDmAssessmentDraftDto }) =>
      saveAssessmentDraft(demandId, dto),
    onSuccess: (demand) => {
      queryClient.setQueryData(queryKeys.demands.detail(demand.id), demand);
    },
  });
}

async function submitDemand(id: string): Promise<DemandResponse> {
  const { data } = await api.post<DemandResponse>(`/demands/${id}/submit`);
  return data;
}

async function deleteDemand(id: string): Promise<void> {
  await api.delete(`/demands/${id}`);
}

export function useDeleteDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDemand,
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.demands.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.demands.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.demands.myList({}) });
    },
  });
}

export function useSubmitDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitDemand,
    onSuccess: (demand) => {
      queryClient.setQueryData(queryKeys.demands.detail(demand.id), demand);
      queryClient.invalidateQueries({ queryKey: queryKeys.demands.all() });
    },
  });
}

export function useGetDemand(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.demands.detail(id ?? ''),
    queryFn: () => getDemand(id!),
    enabled: !!id,
  });
}

async function getCostCentres(): Promise<CostCentreResponse[]> {
  const { data } = await api.get<CostCentreResponse[]>('/cost-centres');
  return data;
}

export function useGetCostCentres() {
  return useQuery({
    queryKey: queryKeys.costCentres.all(),
    queryFn: getCostCentres,
  });
}

async function getLegalEntities(): Promise<LegalEntityResponse[]> {
  const { data } = await api.get<LegalEntityResponse[]>('/legal-entities');
  return data;
}

export function useGetLegalEntities() {
  return useQuery({
    queryKey: queryKeys.legalEntities.all(),
    queryFn: getLegalEntities,
  });
}

async function getAreas(): Promise<AreaResponse[]> {
  const { data } = await api.get<AreaResponse[]>('/areas');
  return data;
}

export function useGetAreas() {
  return useQuery({
    queryKey: queryKeys.areas.all(),
    queryFn: getAreas,
  });
}

async function getCountries(): Promise<CountryResponse[]> {
  const { data } = await api.get<CountryResponse[]>('/countries');
  return data;
}

export function useGetCountries() {
  return useQuery({
    queryKey: queryKeys.countries.all(),
    queryFn: getCountries,
  });
}

async function getPersons(areaId?: string, countryId?: string, globalScope?: boolean): Promise<PersonResponse[]> {
  const { data } = await api.get<PersonResponse[]>('/persons', {
    params: {
      ...(areaId ? { areaId } : {}),
      ...(countryId ? { countryId } : {}),
      ...(globalScope ? { globalScope: 'true' } : {}),
    },
  });
  return data;
}

export function useGetPersons(areaId?: string, countryId?: string, globalScope?: boolean) {
  return useQuery({
    queryKey: queryKeys.persons.all(areaId, countryId, globalScope),
    queryFn: () => getPersons(areaId, countryId, globalScope),
  });
}

async function getGlAccounts(): Promise<GlAccountResponse[]> {
  const { data } = await api.get<GlAccountResponse[]>('/gl-accounts');
  return data;
}

export function useGetGlAccounts() {
  return useQuery({
    queryKey: queryKeys.glAccounts.all(),
    queryFn: getGlAccounts,
  });
}

async function getSystemSettings(): Promise<SystemSettingsResponse> {
  try {
    const { data } = await api.get<SystemSettingsResponse>('/config/system-settings');
    const parsed = systemSettingsResponseSchema.safeParse(data);
    return parsed.success ? parsed.data : defaultSystemSettings;
  } catch {
    return defaultSystemSettings;
  }
}

export function useGetSystemSettings() {
  return useQuery({
    queryKey: queryKeys.systemSettings.all(),
    queryFn: getSystemSettings,
    staleTime: Infinity,
  });
}

// Re-export for callers that need the type
export type { UpdateFinancialPlanEntryItem };

async function getFinancialPlan(demandId: string): Promise<FinancialPlanResponse> {
  const { data } = await api.get<FinancialPlanResponse>(`/demands/${demandId}/financial-plan`);
  return data;
}

export function useGetFinancialPlan(demandId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.financialPlans.byDemand(demandId ?? ''),
    queryFn: () => getFinancialPlan(demandId!),
    enabled: !!demandId,
  });
}

export function usePatchFinancialPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ demandId, dto }: { demandId: string; dto: UpdateFinancialPlanEntriesDto }) =>
      api.patch(`/demands/${demandId}/financial-plan`, dto),
    onSuccess: (_, { demandId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financialPlans.byDemand(demandId) });
    },
  });
}

async function getBusinessControllers(areaId: string, globalScope?: boolean): Promise<PersonResponse[]> {
  const { data } = await api.get<PersonResponse[]>('/persons/business-controllers', {
    params: { areaId, ...(globalScope ? { globalScope: 'true' } : {}) },
  });
  return data;
}

export function useGetBcsByArea(areaId: string | undefined, globalScope?: boolean) {
  return useQuery<PersonResponse[]>({
    queryKey: queryKeys.bcsByArea.byArea(areaId, globalScope),
    queryFn: () => getBusinessControllers(areaId!, globalScope),
    enabled: !!areaId,
  });
}
