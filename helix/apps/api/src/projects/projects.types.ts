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
  // SP DM access
  demandManagerId: string | null;
  // SAP Internal Orders (Story 5.5)
  opexInternalOrder: string | null;
  capexInternalOrder: string | null;
}

export interface ProjectPlanItemResponse {
  id: string;
  name: string;
  type: 'PHASE' | 'MILESTONE';
  startDate: string;
  endDate: string | null;
  displayOrder: number;
}

export interface ProjectPlanResponse {
  items: ProjectPlanItemResponse[];
}

export interface ProjectListFilters {
  status?: string;
  page: number;
  pageSize: number;
  userRoles: string[];
}

export interface ProjectListResponse {
  data: ProjectItem[];
  total: number;
  page: number;
  pageSize: number;
}
