import { RoleAssignment } from '@helix/shared';

interface CostCentre { id: string; name: string; }
interface Area { id: string; code: string; name: string; }
interface Country { id: string; name: string; }

export function formatRoles(
  assignments: RoleAssignment[],
  costCentres: CostCentre[],
  areas: Area[] = [],
  countries: Country[] = [],
): string {
  if (assignments.length === 0) return '—';

  const byRole = new Map<string, string[]>();
  for (const a of assignments) {
    if (!byRole.has(a.role)) byRole.set(a.role, []);
    let label: string;
    if (a.scopeType === 'global') {
      label = 'global';
    } else if (a.scopeType === 'area') {
      const areaIds = a.areaIds ?? [];
      const countryIds = a.countryIds ?? [];

      let areasPart: string;
      if (areaIds.length === 0) {
        areasPart = 'all areas';
      } else if (areaIds.length === 1) {
        const area = areas.find((ar) => ar.id === areaIds[0]);
        areasPart = area ? area.code : areaIds[0];
      } else {
        areasPart = `${areaIds.length} areas`;
      }

      let countriesPart: string;
      if (countryIds.length === 0) {
        countriesPart = 'global';
      } else if (countryIds.length === 1) {
        const country = countries.find((c) => c.id === countryIds[0]);
        countriesPart = country ? country.name : countryIds[0];
      } else {
        countriesPart = `${countryIds.length} countries`;
      }

      label = `${areasPart}, ${countriesPart}`;
    } else if (a.scopeType === 'legal_entity') {
      label = `Legal Entity: ${a.scopeId ?? 'unknown'}`;
    } else {
      label = costCentres.find((cc) => cc.id === a.scopeId)?.name ?? a.scopeId ?? 'unknown';
    }
    byRole.get(a.role)!.push(label);
  }

  return Array.from(byRole.entries())
    .map(([role, scopes]) => `${role} (${scopes.join(', ')})`)
    .join('; ');
}
