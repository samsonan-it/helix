import { describe, it, expect } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys factory — all 7 namespaces', () => {
  it('demands.all returns ["demands"]', () => {
    expect(queryKeys.demands.all()).toEqual(['demands']);
  });

  it('demands.list includes filter in key', () => {
    const key = queryKeys.demands.list({ status: 'DRAFT' });
    expect(key[0]).toBe('demands');
    expect(key[1]).toBe('list');
    expect(key[2]).toEqual({ status: 'DRAFT' });
  });

  it('demands.detail includes id in key', () => {
    const key = queryKeys.demands.detail('abc-123');
    expect(key).toEqual(['demands', 'detail', 'abc-123']);
  });

  it('portfolio.list includes filter in key', () => {
    const key = queryKeys.portfolio.list({ year: 2026 });
    expect(key[0]).toBe('portfolio');
    expect(key[1]).toBe('list');
  });

  it('projects.detail includes id in key', () => {
    expect(queryKeys.projects.detail('proj-1')).toEqual(['projects', 'detail', 'proj-1']);
  });

  it('statusReports.byProject includes projectId in key', () => {
    expect(queryKeys.statusReports.byProject('p-1')).toEqual([
      'status-reports', 'by-project', 'p-1',
    ]);
  });

  it('timesheets.byUser includes userId and week in key', () => {
    expect(queryKeys.timesheets.byUser('u-1', '2026-W23')).toEqual([
      'timesheets', 'by-user', 'u-1', '2026-W23',
    ]);
  });

  it('flags.all returns ["flags"]', () => {
    expect(queryKeys.flags.all()).toEqual(['flags']);
  });

  it('referenceData.all returns ["reference-data"]', () => {
    expect(queryKeys.referenceData.all()).toEqual(['reference-data']);
  });

  it('demands.unifiedQueue returns three-element key with filters', () => {
    expect(queryKeys.demands.unifiedQueue()).toEqual(['demands', 'unified-queue', {}]);
    expect(queryKeys.demands.unifiedQueue({ search: 'foo' })).toEqual(['demands', 'unified-queue', { search: 'foo' }]);
  });
});
