import { ProjectHistoryItem } from '@helix/shared';
import { api } from '../../../lib/api';

export interface ProjectFilters {
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ProjectItem {
  id: string;
  demandId: string;
  publicId: number;
  title: string;
  demandType: 'P' | 'SP';
  startDate: string | null;
  endDate: string | null;
  overallRag: string | null;
  status: string;
  currentStage: string | null;
  assignedPmId: string | null;
  assignedPmName: string | null;
  closureSubmittedAt: string | null;
  charterSubmittedAt?: string | null;
}

export interface ProjectDetail extends ProjectItem {
  description: string | null;
  businessCase: string | null;
  asIsDescription: string | null;
  toBeDescription: string | null;
  projectType: string | null;
  investmentApproval: string | null;
  demandScope: string | null;
  isSmallProject: boolean;
  publicId: number;
  createdAt: string;
  // Charter snapshot fields
  objective: string | null;
  necessity: string | null;
  gxpRelevant: boolean | null;
  eaInvolved: boolean | null;
  eaComment: string | null;
  itSecurityInvolved: boolean | null;
  itSecurityComment: string | null;
  // Charter PM-filled fields
  scope: string | null;
  depsAssumptionsRisk: string | null;
  appPlatformOwner: string | null;
  businessPm: string | null;
  businessSponsor: string | null;
  icRecharge: boolean | null;
  icRechargeAlignmentConducted: boolean | null;
  archImpact: string | null;
  eaAlignmentConducted: boolean | null;
  itSecurityAlignmentConducted: boolean | null;
  maintenanceL1: string | null;
  maintenanceL2: string | null;
  maintenanceL3: string | null;
  licensesNeeded: boolean | null;
  licenseCostCents: number | null;
  licenseExpectedUsers: number | null;
  licenseMetric: string | null;
  licenseInBudget: boolean | null;
  qualitativeValue: boolean | null;
  quantitativeValue: boolean | null;
  valueCaseDescription: string | null;
  charterSubmittedAt: string | null;
  // Closure fields
  closureWorkDelivered: boolean | null;
  closureFinancialReconciled: boolean | null;
  closureHandoverDocumentPath: string | null;
  closurePmSummaryNotes: string | null;
  closureSubmittedAt: string | null;
  demandManagerId: string | null;
  // SAP Internal Orders (Story 5.5)
  opexInternalOrder: string | null;
  capexInternalOrder: string | null;
}

export interface UpdateCharterRequest {
  objective?: string | null;
  necessity?: string | null;
  gxpRelevant?: boolean | null;
  eaInvolved?: boolean | null;
  eaComment?: string | null;
  itSecurityInvolved?: boolean | null;
  itSecurityComment?: string | null;
  scope?: string | null;
  depsAssumptionsRisk?: string | null;
  appPlatformOwner?: string | null;
  businessPm?: string | null;
  businessSponsor?: string | null;
  icRecharge?: boolean | null;
  icRechargeAlignmentConducted?: boolean | null;
  archImpact?: string | null;
  eaAlignmentConducted?: boolean | null;
  itSecurityAlignmentConducted?: boolean | null;
  maintenanceL1?: string | null;
  maintenanceL2?: string | null;
  maintenanceL3?: string | null;
  licensesNeeded?: boolean | null;
  licenseCostCents?: number | null;
  licenseExpectedUsers?: number | null;
  licenseMetric?: string | null;
  licenseInBudget?: boolean | null;
  qualitativeValue?: boolean | null;
  quantitativeValue?: boolean | null;
  valueCaseDescription?: string | null;
}

export interface ProjectListResponse {
  data: ProjectItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getProjectList(filters: ProjectFilters = {}): Promise<ProjectListResponse> {
  const params: Record<string, string> = {};
  if (filters.status)   params['status']   = filters.status;
  if (filters.page)     params['page']     = String(filters.page);
  if (filters.pageSize) params['pageSize'] = String(filters.pageSize);
  const { data } = await api.get<ProjectListResponse>('/projects', { params });
  return data;
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const { data } = await api.get<ProjectDetail>(`/projects/${id}`);
  return data;
}

export async function updateCurrentStage(projectId: string, stage: string, comment?: string): Promise<void> {
  await api.patch(`/projects/${projectId}/current-stage`, { stage, ...(comment ? { comment } : {}) });
}

export async function updateCharter(projectId: string, dto: UpdateCharterRequest): Promise<void> {
  await api.patch(`/projects/${projectId}/charter`, dto);
}

export async function submitCharter(projectId: string): Promise<void> {
  await api.post(`/projects/${projectId}/charter/submit`);
}

export type RagValue = 'GREEN' | 'AMBER' | 'RED';

export interface StatusReportItem {
  id: string;
  projectId: string;
  submittedAt: string;
  submittedById: string;
  overallRag: RagValue;
  scheduleRag: RagValue;
  resourcesRag: RagValue;
  budgetCurrentRag: RagValue;
  budgetForecastRag: RagValue;
  stakeholdersRag: RagValue;
  valuePropRag: RagValue;
  providerRag: RagValue;
  overallExplanation: string | null;
  scheduleExplanation: string | null;
  resourcesExplanation: string | null;
  budgetCurrentExplanation: string | null;
  budgetForecastExplanation: string | null;
  stakeholdersExplanation: string | null;
  valuePropExplanation: string | null;
  providerExplanation: string | null;
  keyAccomplishments: string | null;
  nextSteps: string | null;
  goLiveDate: string | null;
}

export interface CreateStatusReportRequest {
  overallRag: RagValue;
  scheduleRag: RagValue;
  resourcesRag: RagValue;
  budgetCurrentRag: RagValue;
  budgetForecastRag: RagValue;
  stakeholdersRag: RagValue;
  valuePropRag: RagValue;
  providerRag: RagValue;
  overallExplanation?: string | null;
  scheduleExplanation?: string | null;
  resourcesExplanation?: string | null;
  budgetCurrentExplanation?: string | null;
  budgetForecastExplanation?: string | null;
  stakeholdersExplanation?: string | null;
  valuePropExplanation?: string | null;
  providerExplanation?: string | null;
  keyAccomplishments?: string | null;
  nextSteps?: string | null;
  goLiveDate?: string | null;
}

export async function getStatusReports(projectId: string): Promise<StatusReportItem[]> {
  const { data } = await api.get<StatusReportItem[]>(`/projects/${projectId}/status-reports`);
  return data;
}

export async function submitStatusReport(
  projectId: string,
  dto: CreateStatusReportRequest,
): Promise<StatusReportItem> {
  const { data } = await api.post<StatusReportItem>(`/projects/${projectId}/status-reports`, dto);
  return data;
}

export async function uploadHandoverDocument(
  projectId: string,
  file: File,
): Promise<{ fileName: string }> {
  const formData = new FormData();
  formData.append('handoverDocument', file);
  const { data } = await api.post<{ fileName: string }>(
    `/projects/${projectId}/closure/handover-document`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export interface ClosureSubmitRequest {
  workDelivered: true;
  financialReconciled: true;
  pmSummaryNotes?: string;
}

export async function submitClosure(
  projectId: string,
  dto: ClosureSubmitRequest,
): Promise<void> {
  await api.post(`/projects/${projectId}/closure/submit`, dto);
}

export async function getClosureQueue(): Promise<ProjectItem[]> {
  const { data } = await api.get<ProjectItem[]>('/projects/closure-queue');
  return data;
}

export async function acceptClosure(projectId: string): Promise<void> {
  await api.post(`/projects/${projectId}/closure/accept`);
}

export async function returnClosure(projectId: string, comment: string): Promise<void> {
  await api.post(`/projects/${projectId}/closure/return`, { comment });
}

export async function getCharterQueue(): Promise<ProjectItem[]> {
  const { data } = await api.get<ProjectItem[]>('/projects/charter-queue');
  return data;
}

export async function approveCharter(projectId: string): Promise<void> {
  await api.post(`/projects/${projectId}/charter/approve`);
}

export async function returnCharter(projectId: string, comment: string): Promise<void> {
  await api.post(`/projects/${projectId}/charter/return`, { comment });
}

export interface ProjectFinancialPlanEntry {
  id: string;
  projectId: string;
  glAccountId: string;
  category: string;
  month: number;
  year: number;
  valueCents: number;
  isActual: boolean;
  isUserSet: boolean;
}

export interface ProjectFinancialPlanResponse {
  glAccounts: { id: string; category: string; label: string; isActive: boolean }[];
  entries: ProjectFinancialPlanEntry[];
}

export interface UpdateFinancialPlanEntriesDto {
  entries: {
    glAccountId: string;
    category: string;
    month: number;
    year: number;
    valueCents: number;
  }[];
}

export async function getProjectFinancialPlan(projectId: string): Promise<ProjectFinancialPlanResponse> {
  const { data } = await api.get<ProjectFinancialPlanResponse>(`/projects/${projectId}/financial-plan`);
  return data;
}

export async function patchProjectFinancialPlan(projectId: string, dto: UpdateFinancialPlanEntriesDto): Promise<void> {
  await api.patch(`/projects/${projectId}/financial-plan`, dto);
}

export interface ProjectPlanItem {
  id: string;
  name: string;
  type: 'PHASE' | 'MILESTONE';
  startDate: string;
  endDate: string | null;
  displayOrder: number;
}

export interface ReplaceProjectPlanRequest {
  items: Array<{
    name: string;
    type: 'PHASE' | 'MILESTONE';
    startDate: string;
    endDate?: string | null;
  }>;
}

export async function getProjectPlan(projectId: string): Promise<{ items: ProjectPlanItem[] }> {
  const { data } = await api.get<{ items: ProjectPlanItem[] }>(`/projects/${projectId}/plan`);
  return data;
}

export async function replaceProjectPlan(projectId: string, dto: ReplaceProjectPlanRequest): Promise<void> {
  await api.put(`/projects/${projectId}/plan`, dto);
}

export async function getProjectHistory(id: string): Promise<ProjectHistoryItem[]> {
  const { data } = await api.get<ProjectHistoryItem[]>(`/projects/${id}/history`);
  return data;
}

export interface UpdateInternalOrdersRequest {
  opexInternalOrder?: string | null;
  capexInternalOrder?: string | null;
}

export async function updateProjectInternalOrders(projectId: string, dto: UpdateInternalOrdersRequest): Promise<void> {
  await api.patch(`/projects/${projectId}/internal-orders`, dto);
}
