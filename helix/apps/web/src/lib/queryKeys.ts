// Single source of truth for all TanStack Query cache keys.
// NEVER use inline string arrays in useQuery/useMutation — always reference queryKeys.*
// Feature stories add entries; they NEVER change existing key shapes.
export const queryKeys = {
  auth: {
    me:      () => ['auth', 'me'] as const,
    session: () => ['auth', 'session'] as const,
    devUsers: () => ['auth', 'dev-users'] as const,
  },
  demands: {
    all:      ()             => ['demands'] as const,
    list:     (f: unknown)   => ['demands', 'list', f] as const,
    detail:   (id: string)   => ['demands', 'detail', id] as const,
    history:        (id: string)   => ['demands', 'history', id] as const,
    myList:         (f: unknown)   => ['demands', 'my-list', f] as const,
    dashboardStats:  ()             => ['demands', 'dashboard-stats'] as const,
    unifiedQueueAll: ()               => ['demands', 'unified-queue'] as const,
    unifiedQueue:    (f: unknown = {}) => ['demands', 'unified-queue', f] as const,
  },
  portfolio: {
    list: (f: unknown) => ['portfolio', 'list', f] as const,
  },
  projects: {
    all:          ()             => ['projects'] as const,
    list:         (f: unknown)   => ['projects', 'list', f] as const,
    detail:       (id: string)   => ['projects', 'detail', id] as const,
    closureQueue: ()             => ['projects', 'closure-queue'] as const,
    charterQueue: ()             => ['projects', 'charter-queue'] as const,
    plan:         (id: string)   => ['projects', 'plan', id] as const,
    history:      (id: string)   => ['projects', 'history', id] as const,
  },
  statusReports: {
    byProject: (projectId: string) => ['status-reports', 'by-project', projectId] as const,
  },
  timesheets: {
    byUser: (userId: string, week: string) =>
      ['timesheets', 'by-user', userId, week] as const,
  },
  flags: {
    all: () => ['flags'] as const,
  },
  referenceData: {
    all:                () => ['reference-data'] as const,            // DO NOT CHANGE — existing invalidation key
    adminCostCentres:   () => ['reference-data', 'admin', 'cost-centres'] as const,
    adminGlAccounts:    () => ['reference-data', 'admin', 'gl-accounts'] as const,
    adminLegalEntities: () => ['reference-data', 'admin', 'legal-entities'] as const,
    adminAreas:         () => ['reference-data', 'admin', 'areas'] as const,
    adminCountries:     () => ['reference-data', 'admin', 'countries'] as const,
  },
  costCentres: {
    all: () => ['cost-centres'] as const,
  },
  glAccounts: {
    all: () => ['gl-accounts'] as const,
  },
  legalEntities: {
    all: () => ['legal-entities'] as const,
  },
  areas: {
    all: () => ['areas'] as const,
  },
  countries: {
    all: () => ['countries'] as const,
  },
  persons: {
    all: (areaId?: string, countryId?: string, globalScope?: boolean) => ['persons', areaId, countryId, globalScope] as const,
  },
  systemSettings: {
    all: () => ['system-settings'] as const,
  },
  admin: {
    users: (params?: { search?: string; role?: string; costCentreId?: string; areaId?: string }) =>
      ['admin', 'users', params ?? {}] as const,
    routingHealth: () => ['admin', 'routing-health'] as const,
    featureFlags: () => ['admin', 'feature-flags'] as const,
    auditLogs: (filters: Record<string, unknown>) => ['admin', 'audit-logs', filters] as const,
  },
  financialPlans: {
    byDemand:   (id: string) => ['financial-plans', 'by-demand', id] as const,
    byProject:  (id: string) => ['financial-plans', 'by-project', id] as const,
  },
  bcsByArea: {
    byArea: (areaId: string | undefined, globalScope?: boolean) => ['bcs', 'by-area', areaId ?? '', globalScope] as const,
  },
  users: {
    byRole: (role: string) => ['users', 'by-role', role] as const,
  },
} as const;
