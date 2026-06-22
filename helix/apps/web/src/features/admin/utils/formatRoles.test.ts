import { describe, it, expect } from 'vitest';
import { formatRoles } from './formatRoles';
import { RoleAssignment } from '@helix/shared';

const CC_FINANCE = { id: 'cc-1', name: 'Finance' };
const CC_IT = { id: 'cc-2', name: 'IT Operations' };
const costCentres = [CC_FINANCE, CC_IT];

const AREA_WE = { id: 'a-1', code: 'WE', name: 'Western Europe' };
const AREA_CE = { id: 'a-2', code: 'CE', name: 'Central Europe' };
const areas = [AREA_WE, AREA_CE];

const COUNTRY_ES = { id: 'c-1', name: 'Spain' };
const COUNTRY_FR = { id: 'c-2', name: 'France' };
const COUNTRY_DE = { id: 'c-3', name: 'Germany' };
const countries = [COUNTRY_ES, COUNTRY_FR, COUNTRY_DE];

describe('formatRoles', () => {
  it('returns "—" for empty assignments', () => {
    expect(formatRoles([], costCentres)).toBe('—');
  });

  it('formats a single global role', () => {
    const assignments: RoleAssignment[] = [
      { role: 'Admin', scopeType: 'global', areaIds: [], countryIds: [] },
    ];
    expect(formatRoles(assignments, costCentres)).toBe('Admin (global)');
  });

  it('formats a single cost-centre role with resolved name', () => {
    const assignments: RoleAssignment[] = [
      { role: 'DemandManager', scopeType: 'cost_centre', scopeId: CC_FINANCE.id, areaIds: [], countryIds: [] },
    ];
    expect(formatRoles(assignments, costCentres)).toBe('DemandManager (Finance)');
  });

  it('groups multiple assignments of the same role across different cost centres', () => {
    const assignments: RoleAssignment[] = [
      { role: 'DemandManager', scopeType: 'cost_centre', scopeId: CC_FINANCE.id, areaIds: [], countryIds: [] },
      { role: 'DemandManager', scopeType: 'cost_centre', scopeId: CC_IT.id, areaIds: [], countryIds: [] },
    ];
    expect(formatRoles(assignments, costCentres)).toBe('DemandManager (Finance, IT Operations)');
  });

  it('separates multiple different roles with semicolons', () => {
    const assignments: RoleAssignment[] = [
      { role: 'Admin', scopeType: 'global', areaIds: [], countryIds: [] },
      { role: 'DemandManager', scopeType: 'cost_centre', scopeId: CC_FINANCE.id, areaIds: [], countryIds: [] },
    ];
    const result = formatRoles(assignments, costCentres);
    expect(result).toContain('Admin (global)');
    expect(result).toContain('DemandManager (Finance)');
    expect(result).toContain(';');
  });

  it('falls back to scopeId when cost centre not found in list', () => {
    const assignments: RoleAssignment[] = [
      { role: 'DemandManager', scopeType: 'cost_centre', scopeId: 'cc-unknown', areaIds: [], countryIds: [] },
    ];
    expect(formatRoles(assignments, costCentres)).toBe('DemandManager (cc-unknown)');
  });

  it('shows "Legal Entity: <scopeId>" for legal_entity scopeType', () => {
    const assignments: RoleAssignment[] = [
      { role: 'DemandManager', scopeType: 'legal_entity', scopeId: 'le-1', areaIds: [], countryIds: [] },
    ];
    expect(formatRoles(assignments, costCentres)).toBe('DemandManager (Legal Entity: le-1)');
  });

  describe('area-scoped roles with country info', () => {
    it('shows "all areas, global" when no areas and no countries selected', () => {
      const assignments: RoleAssignment[] = [
        { role: 'DemandManager', scopeType: 'area', areaIds: [], countryIds: [] },
      ];
      expect(formatRoles(assignments, costCentres, areas, countries)).toBe('DemandManager (all areas, global)');
    });

    it('shows area code and "global" when 1 area, no countries selected', () => {
      const assignments: RoleAssignment[] = [
        { role: 'DemandManager', scopeType: 'area', areaIds: [AREA_WE.id], countryIds: [] },
      ];
      expect(formatRoles(assignments, costCentres, areas, countries)).toBe('DemandManager (WE, global)');
    });

    it('shows area code and country name when 1 area, 1 country selected', () => {
      const assignments: RoleAssignment[] = [
        { role: 'DemandManager', scopeType: 'area', areaIds: [AREA_WE.id], countryIds: [COUNTRY_ES.id] },
      ];
      expect(formatRoles(assignments, costCentres, areas, countries)).toBe('DemandManager (WE, Spain)');
    });

    it('shows "N areas, country name" when multiple areas, 1 country selected', () => {
      const assignments: RoleAssignment[] = [
        { role: 'DemandManager', scopeType: 'area', areaIds: [AREA_WE.id, AREA_CE.id], countryIds: [COUNTRY_ES.id] },
      ];
      expect(formatRoles(assignments, costCentres, areas, countries)).toBe('DemandManager (2 areas, Spain)');
    });

    it('shows "N areas, N countries" when multiple areas and multiple countries selected', () => {
      const assignments: RoleAssignment[] = [
        { role: 'DemandManager', scopeType: 'area', areaIds: [AREA_WE.id, AREA_CE.id], countryIds: [COUNTRY_ES.id, COUNTRY_FR.id, COUNTRY_DE.id] },
      ];
      expect(formatRoles(assignments, costCentres, areas, countries)).toBe('DemandManager (2 areas, 3 countries)');
    });
  });
});
