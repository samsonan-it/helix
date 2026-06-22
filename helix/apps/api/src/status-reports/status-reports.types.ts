export interface StatusReportResponse {
  id: string;
  projectId: string;
  submittedAt: string;
  submittedById: string;
  overallRag: string;
  scheduleRag: string;
  resourcesRag: string;
  budgetCurrentRag: string;
  budgetForecastRag: string;
  stakeholdersRag: string;
  valuePropRag: string;
  providerRag: string;
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
