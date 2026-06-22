import { useEffect, useState } from 'react';
import { Button, Divider, Group, Modal, Stack, Text, TextInput, Title } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { UpdateInternalOrdersRequest, updateProjectInternalOrders } from '../api/execution.api';

interface Props {
  projectId: string;
  opexInternalOrder: string | null;
  capexInternalOrder: string | null;
  canEdit: boolean;
}

const HINT = 'Orders are created in SAP after final approval';

export function SapIntegrationSection({ projectId, opexInternalOrder, capexInternalOrder, canEdit }: Props) {
  const qc = useQueryClient();
  const [opex, setOpex] = useState(opexInternalOrder ?? '');
  const [capex, setCapex] = useState(capexInternalOrder ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setOpex(opexInternalOrder ?? '');
    setCapex(capexInternalOrder ?? '');
  }, [opexInternalOrder, capexInternalOrder]);
  const [pendingDto, setPendingDto] = useState<UpdateInternalOrdersRequest | null>(null);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (dto: UpdateInternalOrdersRequest) => updateProjectInternalOrders(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      setConfirmOpen(false);
      setPendingDto(null);
    },
  });

  function handleSave() {
    const dto: UpdateInternalOrdersRequest = {};
    if (opex !== (opexInternalOrder ?? '')) dto.opexInternalOrder = opex || null;
    if (capex !== (capexInternalOrder ?? '')) dto.capexInternalOrder = capex || null;
    if (Object.keys(dto).length === 0) return;

    const overwriting =
      (dto.opexInternalOrder !== undefined && opexInternalOrder !== null && opexInternalOrder !== '') ||
      (dto.capexInternalOrder !== undefined && capexInternalOrder !== null && capexInternalOrder !== '');

    if (overwriting) {
      setPendingDto(dto);
      setConfirmOpen(true);
    } else {
      save(dto);
    }
  }

  return (
    <Stack gap="md" mt="md">
      <Divider label={<Title order={5}>SAP Integration</Title>} labelPosition="left" />

      {canEdit ? (
        <Stack gap="sm" maw={480}>
          <TextInput
            label="OPEX Internal Order"
            placeholder={HINT}
            value={opex}
            onChange={(e) => setOpex(e.currentTarget.value)}
            maxLength={50}
          />
          <TextInput
            label="CAPEX Internal Order"
            placeholder={HINT}
            value={capex}
            onChange={(e) => setCapex(e.currentTarget.value)}
            maxLength={50}
          />
          <Group>
            <Button size="sm" loading={isPending} onClick={handleSave}>
              Save
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="xs">
          <SapField label="OPEX Internal Order" value={opexInternalOrder} />
          <SapField label="CAPEX Internal Order" value={capexInternalOrder} />
        </Stack>
      )}

      <Modal
        opened={confirmOpen}
        onClose={() => { setConfirmOpen(false); setPendingDto(null); }}
        title="Overwrite Internal Order"
        centered
      >
        <Text size="sm" mb="md">This field already has a value. Overwrite?</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => { setConfirmOpen(false); setPendingDto(null); }}>Cancel</Button>
          <Button loading={isPending} onClick={() => pendingDto && save(pendingDto)}>Confirm</Button>
        </Group>
      </Modal>
    </Stack>
  );
}

function SapField({ label, value }: { label: string; value: string | null }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Text size="sm">{value ?? <Text size="sm" c="dimmed" fs="italic">{HINT}</Text>}</Text>
    </Stack>
  );
}
