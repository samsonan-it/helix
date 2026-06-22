import 'gantt-task-react/dist/index.css';
import { useMemo, useState } from 'react';
import { Box, Paper, SegmentedControl, Text, useMantineTheme } from '@mantine/core';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import type { ProjectPlanItem } from '../api/execution.api';

// Shared so the editable rail (PlanBoard) can align its rows to the chart.
export const GANTT_ROW_HEIGHT = 50;
export const GANTT_HEADER_HEIGHT = 50;

function fmt(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function GanttTooltip({ task }: { task: Task; fontSize: string; fontFamily: string }) {
  const isMilestone = task.type === 'milestone';
  return (
    <Paper shadow="sm" p="xs" withBorder style={{ minWidth: 180 }}>
      <Text fw={600} size="sm" mb={4}>{task.name}</Text>
      {isMilestone ? (
        <Text size="xs" c="dimmed">{fmt(task.start)}</Text>
      ) : (
        <>
          <Text size="xs" c="dimmed">Start: {fmt(task.start)}</Text>
          <Text size="xs" c="dimmed">End: {fmt(task.end)}</Text>
        </>
      )}
    </Paper>
  );
}

// Props passed by gantt-task-react to custom list header/table components.
interface TaskListHeaderProps {
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}

interface TaskListTableProps {
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
}

function PlanListHeader({ headerHeight, rowWidth }: TaskListHeaderProps) {
  const nameW = Math.round(Number(rowWidth) * 0.6);
  const dateW = Number(rowWidth) - nameW;
  return (
    <Box style={{ display: 'flex', height: headerHeight, alignItems: 'flex-end', paddingBottom: 8, borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
      <Text size="xs" fw={600} c="dimmed" style={{ width: nameW, paddingLeft: 8 }}>Name</Text>
      <Text size="xs" fw={600} c="dimmed" style={{ width: dateW }}>Dates</Text>
    </Box>
  );
}

function PlanListTable({ rowHeight, rowWidth, tasks }: TaskListTableProps) {
  const theme = useMantineTheme();
  const phaseColor = theme.colors.stadaBlue[6];
  const milestoneColor = theme.colors.stadaRed[6];
  const nameW = Math.round(Number(rowWidth) * 0.6);
  const dateW = Number(rowWidth) - nameW;
  return (
    <Box>
      {tasks.map((task) => {
        const isMilestone = task.type === 'milestone';
        const dateStr = isMilestone
          ? fmt(task.start)
          : `${fmt(task.start)} – ${fmt(task.end)}`;
        return (
          <Box
            key={task.id}
            style={{ display: 'flex', height: rowHeight, alignItems: 'center' }}
          >
            <Box style={{ display: 'flex', alignItems: 'center', gap: 6, width: nameW, paddingLeft: 8, minWidth: 0, overflow: 'hidden' }}>
              <Box
                style={{
                  width: 10,
                  height: 10,
                  flexShrink: 0,
                  backgroundColor: isMilestone ? milestoneColor : phaseColor,
                  borderRadius: isMilestone ? 2 : 3,
                  transform: isMilestone ? 'rotate(45deg)' : undefined,
                }}
              />
              <Text size="xs" truncate style={{ minWidth: 0 }}>{task.name}</Text>
            </Box>
            <Box style={{ width: dateW, flexShrink: 0 }}>
              <Text size="xs" c="dimmed">{dateStr}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

const VIEW_OPTIONS = [
  { value: ViewMode.Week,  label: 'Week' },
  { value: ViewMode.Month, label: 'Month' },
  { value: ViewMode.Year,  label: 'Year' },
];

function getDefaultViewMode(items: ProjectPlanItem[]): ViewMode {
  if (items.length === 0) return ViewMode.Month;
  const times = items.flatMap((i) => [
    new Date(i.startDate).getTime(),
    i.endDate ? new Date(i.endDate).getTime() : new Date(i.startDate).getTime(),
  ]);
  const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000;
  return spanDays <= 56 ? ViewMode.Week : ViewMode.Month;
}

interface Props {
  items: ProjectPlanItem[];
  rowHeight?: number;
  canEdit?: boolean;
  onDateChange?: (updated: { id: string; start: Date; end: Date }) => void;
}

export function PlanGantt({ items, rowHeight, canEdit, onDateChange }: Props) {
  const theme = useMantineTheme();
  const phaseColor = theme.colors.stadaBlue[6];
  const milestoneColor = theme.colors.stadaRed[6];
  const [viewMode, setViewMode] = useState<ViewMode>(() => getDefaultViewMode(items));

  // Anchor the initial scroll to the earliest start; computed once so live
  // edits move the bars without yanking the viewport around.
  const [viewDate] = useState<Date | undefined>(() => {
    if (items.length === 0) return undefined;
    return items.reduce(
      (min, it) => (new Date(it.startDate) < min ? new Date(it.startDate) : min),
      new Date(items[0].startDate),
    );
  });

  const tasks: Task[] = useMemo(
    () =>
      items.map((item) => {
        const isMilestone = item.type === 'MILESTONE';
        const color = isMilestone ? milestoneColor : phaseColor;
        return {
          id: item.id,
          name: item.name,
          start: new Date(item.startDate),
          end: isMilestone
            ? new Date(item.startDate)
            : new Date(item.endDate ?? item.startDate),
          type: isMilestone ? 'milestone' : 'task',
          progress: 0,
          ...(canEdit ? {} : { isDisabled: true }),
          styles: {
            backgroundColor: color,
            backgroundSelectedColor: color,
            progressColor: color,
            progressSelectedColor: color,
          },
        };
      }),
    [items, canEdit, phaseColor, milestoneColor],
  );

  if (items.length === 0) return null;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <Box mb="xs" style={{ alignSelf: 'flex-start' }}>
        <SegmentedControl
          size="xs"
          data={VIEW_OPTIONS}
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
        />
      </Box>
      <Box style={{ overflow: 'auto', flex: 1 }}>
        <Gantt
          tasks={tasks}
          viewMode={viewMode}
          viewDate={viewDate}
          listCellWidth={canEdit ? '' : '280'}
          columnWidth={viewMode === ViewMode.Week ? 60 : viewMode === ViewMode.Year ? 120 : 160}
          rowHeight={rowHeight ?? GANTT_ROW_HEIGHT}
          headerHeight={GANTT_HEADER_HEIGHT}
          barCornerRadius={4}
          todayColor={theme.colors.gray[6]}
          fontFamily='"Frutiger", Arial, sans-serif'
          milestoneBackgroundColor={milestoneColor}
          TooltipContent={GanttTooltip}
          preStepsCount={0}
          {...(!canEdit && {
            TaskListHeader: PlanListHeader,
            TaskListTable: PlanListTable,
          })}
          {...(canEdit && onDateChange && {
            onDateChange: (task: Task, _children: Task[]) => {
              onDateChange({ id: task.id, start: task.start, end: task.end });
            },
          })}
        />
      </Box>
    </Box>
  );
}
