export const STATUS_REPORT_EVENTS = {
  REMINDER_DUE: 'statusReport.reminderDue',
} as const;

export class StatusReportReminderEvent {
  constructor(
    public readonly projectId: string,
    public readonly pmId: string,
    public readonly projectTitle: string,
    public readonly publicId: number,
    public readonly prevOverallRag: string | null,
  ) {}
}
