import { useState } from 'react';
import {
  Drawer,
  Stack,
  Text,
  Group,
  Button,
  Select,
  MultiSelect,
  Badge,
  ActionIcon,
  Alert,
  Divider,
  Title,
  Paper,
  Tooltip,
} from '@mantine/core';
import { IconTrash, IconPlus, IconEdit } from '@tabler/icons-react';
import { UserAdminRow, RoleAssignment } from '@helix/shared';
import { useUpdateUserRoles } from '../hooks/useUpdateUserRoles';
import { useGetCostCentres } from '../../intake/intake.queries';
import { useAdminAreas } from '../hooks/useAdminAreas';
import { useAdminCountries } from '../hooks/useAdminCountries';

// DM and BC are area-scoped; ITCostCenterOwner stays cost-centre scoped
const AREA_SCOPED_ROLES = ['DemandManager', 'BusinessController'];
const AREA_ROLE_DISPLAY: Record<string, string> = {
  DemandManager: 'DM',
  BusinessController: 'BC',
};
const COST_CENTRE_SCOPED_ROLES = ['ITCostCenterOwner'];
const ALL_ROLES = [
  'Admin',
  'DemandRequester',
  'BusinessController',
  'DemandManager',
  'PortfolioManager',
  'ProjectManager',
  'TeamMember',
  'ITCostCenterOwner',
  'SECMember',
];

interface Props {
  user: UserAdminRow | null;
  opened: boolean;
  onClose: () => void;
}

interface PendingAssignment extends RoleAssignment {
  key: string;
}

function buildKey(a: RoleAssignment) {
  return `${a.role}::${a.scopeType}::${a.scopeId ?? 'null'}`;
}

export function RoleAssignmentDrawer({ user, opened, onClose }: Props): JSX.Element {
  const { data: costCentres = [] } = useGetCostCentres();
  const { data: adminAreas = [] } = useAdminAreas();
  const { data: adminCountries = [] } = useAdminCountries();
  const mutation = useUpdateUserRoles();

  const [pending, setPending] = useState<PendingAssignment[]>([]);
  const [newRole, setNewRole] = useState<RoleAssignment['role'] | null>(null);
  const [newScopeId, setNewScopeId] = useState<string | null>(null);
  const [newAreaIds, setNewAreaIds] = useState<string[]>([]);
  const [newCountryIds, setNewCountryIds] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Reset local state when drawer opens for a new user
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  if (user && user.id !== lastUserId) {
    setLastUserId(user.id);
    setPending(user.assignments.map((a) => ({
      ...a,
      areaIds: a.areaIds ?? [],
      countryIds: a.countryIds ?? [],
      key: buildKey(a),
    })));
    setNewRole(null);
    setNewScopeId(null);
    setNewAreaIds([]);
    setNewCountryIds([]);
    setAddError(null);
    setEditingKey(null);
  }

  if (!user) return <></>;

  const isAreaRole = newRole ? AREA_SCOPED_ROLES.includes(newRole) : false;
  const isCostCentreRole = newRole ? COST_CENTRE_SCOPED_ROLES.includes(newRole) : false;

  function handleAdd() {
    if (!newRole) {
      setAddError('Select a role');
      return;
    }

    if (isAreaRole && pending.some((p) => p.role === newRole && p.key !== editingKey)) {
      const displayName = AREA_ROLE_DISPLAY[newRole] ?? newRole;
      setAddError(`${displayName} role already added — remove the existing entry to change scope`);
      return;
    }

    if (isCostCentreRole && !newScopeId) {
      setAddError('Select a cost centre for this role');
      return;
    }

    const assignment: RoleAssignment = isAreaRole
      ? { role: newRole, scopeType: 'area', areaIds: newAreaIds, countryIds: newCountryIds }
      : isCostCentreRole
        ? { role: newRole, scopeType: 'cost_centre', scopeId: newScopeId ?? undefined, areaIds: [], countryIds: [] }
        : { role: newRole, scopeType: 'global', areaIds: [], countryIds: [] };

    const key = buildKey(assignment);
    if (!editingKey && pending.some((p) => p.key === key)) {
      setAddError('This assignment already exists');
      return;
    }

    if (editingKey) {
      setPending((prev) => prev.map((p) => p.key === editingKey ? { ...assignment, key } : p));
      setEditingKey(null);
    } else {
      setPending((prev) => [...prev, { ...assignment, key }]);
    }
    setNewRole(null);
    setNewScopeId(null);
    setNewAreaIds([]);
    setNewCountryIds([]);
    setAddError(null);
  }

  function handleEdit(a: PendingAssignment) {
    setEditingKey(a.key);
    setNewRole(a.role as RoleAssignment['role']);
    setNewScopeId(a.scopeId ?? null);
    setNewAreaIds(a.areaIds ?? []);
    setNewCountryIds(a.countryIds ?? []);
    setAddError(null);
  }

  function handleRemove(key: string) {
    setPending((prev) => prev.filter((p) => p.key !== key));
    if (editingKey === key) {
      setEditingKey(null);
      setNewRole(null);
      setNewScopeId(null);
      setNewAreaIds([]);
      setNewCountryIds([]);
      setAddError(null);
    }
  }

  function handleSave() {
    if (!user) return;
    mutation.mutate(
      { userId: user.id, dto: { assignments: pending.map(({ key: _k, ...a }) => a) } },
      { onSuccess: onClose },
    );
  }

  function buildAreaTooltip(a: PendingAssignment): string {
    const areaIds = a.areaIds ?? [];
    const countryIds = a.countryIds ?? [];

    const areaLine = areaIds.length === 0
      ? 'Areas: all'
      : `Areas: ${areaIds.map((id) => { const ar = adminAreas.find((x) => x.id === id); return ar ? `${ar.code} — ${ar.name}` : id; }).join(', ')}`;

    const countryLine = countryIds.length === 0
      ? 'Countries: all'
      : `Countries: ${countryIds.map((id) => { const c = adminCountries.find((x) => x.id === id); return c ? c.name : id; }).join(', ')}`;

    return `${areaLine}\n${countryLine}`;
  }

  function scopeLabel(a: PendingAssignment): string {
    if (a.scopeType === 'area') {
      const areaIds = a.areaIds ?? [];
      const countryIds = a.countryIds ?? [];

      const areaStr = areaIds.length === 0
        ? 'all areas'
        : areaIds.length === 1
          ? (adminAreas.find((ar) => ar.id === areaIds[0])?.code ?? areaIds[0])
          : `${areaIds.length} areas`;

      const countryStr = areaIds.length === 0 || countryIds.length === 0
        ? 'all countries'
        : countryIds.length === 1
          ? (adminCountries.find((c) => c.id === countryIds[0])?.code ?? countryIds[0])
          : `${countryIds.length} countries`;

      return `${areaStr}, ${countryStr}`;
    }
    if (a.scopeType === 'cost_centre') {
      const cc = costCentres.find((c) => c.id === a.scopeId);
      return `Cost Centre: ${cc ? `${cc.code} ${cc.name}` : a.scopeId}`;
    }
    if (a.scopeType === 'legal_entity') {
      return `Legal Entity: ${a.scopeId ?? '-'}`;
    }
    return 'Global';
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={<Title order={4}>Manage Roles — {user.name}</Title>}
      padding="md"
    >
      <Stack gap="md">
        {/* Current assignments */}
        <div>
          <Text fw={600} mb="xs">Current Assignments</Text>
          {pending.length === 0 ? (
            <Text c="dimmed" size="sm">No roles assigned</Text>
          ) : (
            <Stack gap="xs">
              {pending.map((a) => (
                <Paper key={a.key} withBorder p="xs">
                  <Group justify="space-between" wrap="nowrap">
                    {AREA_SCOPED_ROLES.includes(a.role) ? (
                      <Tooltip label={buildAreaTooltip(a)} multiline w={320} style={{ whiteSpace: 'pre-line' }}>
                        <Text size="sm" style={{ cursor: 'default' }}>
                          <b>{a.role}</b> — {scopeLabel(a)}
                        </Text>
                      </Tooltip>
                    ) : (
                      <Text size="sm">
                        <b>{a.role}</b> — {scopeLabel(a)}
                      </Text>
                    )}
                    <Group gap={4} wrap="nowrap">
                      {AREA_SCOPED_ROLES.includes(a.role) && (
                        <ActionIcon
                          variant="subtle"
                          onClick={() => handleEdit(a)}
                          aria-label={`Edit ${a.role}`}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      )}
                      <ActionIcon
                        color="stadaRed"
                        variant="subtle"
                        onClick={() => handleRemove(a.key)}
                        aria-label={`Remove ${a.role}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </div>

        <Divider />

        {/* Add / edit role section */}
        <div>
          <Text fw={600} mb="xs">{editingKey ? 'Edit Role' : 'Add Role'}</Text>
          <Stack gap="xs">
            <Select
              label="Role"
              placeholder="Select a role"
              data={ALL_ROLES}
              value={newRole}
              onChange={(v) => {
                setNewRole(v as RoleAssignment['role'] | null);
                setNewScopeId(null);
                setNewAreaIds([]);
                setNewCountryIds([]);
                setAddError(null);
              }}
            />
            {isAreaRole && (
              <>
                <MultiSelect
                  label="Areas"
                  description={newAreaIds.length === 0 ? <Text size="xs" c="red">No areas selected — this DM/BC will match <u>ALL areas</u></Text> : undefined}
                  placeholder="Select areas…"
                  data={adminAreas.filter((a) => a.isActive).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                  value={newAreaIds}
                  onChange={(vals) => {
                    setNewAreaIds(vals);
                    if (vals.length === 0) setNewCountryIds([]);
                    setAddError(null);
                  }}
                  searchable
                  clearable
                />
                {newAreaIds.length > 0 && (
                  <MultiSelect
                    label="Countries"
                    description={newCountryIds.length === 0 ? <Text size="xs" c="red">No countries selected — this DM/BC will match <u>ALL countries</u> in the selected areas</Text> : undefined}
                    placeholder="Select countries…"
                    data={adminCountries.filter((c) => c.isActive).map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                    value={newCountryIds}
                    onChange={(vals) => { setNewCountryIds(vals); setAddError(null); }}
                    searchable
                    clearable
                  />
                )}
              </>
            )}
            {isCostCentreRole && (
              <Select
                label="Cost Centre"
                placeholder="Select cost centre"
                data={costCentres.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                value={newScopeId}
                onChange={(v) => { setNewScopeId(v); setAddError(null); }}
                searchable
              />
            )}
            {addError && <Text c="red" size="sm">{addError}</Text>}
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={handleAdd}
              disabled={!newRole}
            >
              {editingKey ? 'Update assignment' : 'Add to pending'}
            </Button>
          </Stack>
        </div>

        <Divider />

        {/* Summary */}
        <div>
          <Text fw={600} mb="xs">Summary</Text>
          {pending.length === 0 ? (
            <Text c="dimmed" size="sm">User will have no roles</Text>
          ) : (
            <Stack gap={4}>
              {pending.map((a) => (
                <Badge key={a.key} variant="light" size="sm">
                  {a.role} — {scopeLabel(a)}
                </Badge>
              ))}
            </Stack>
          )}
        </div>

        {mutation.isError && (
          <Alert color="stadaRed" title="Save failed">
            {(mutation.error as Error)?.message ?? 'An error occurred. Please try again.'}
          </Alert>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={mutation.isPending} disabled={mutation.isPending} color="stadaRed">
            Save
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
