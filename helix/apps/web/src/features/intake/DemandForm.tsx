import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import axios from 'axios';
import dayjs from 'dayjs';
import { demandFormSchema, DemandFormValues, CreateDemandDto, DemandStatus, CountryResponse } from '@helix/shared';
import {
  useCreateDemand,
  useUpdateDemand,
  useGetDemand,
  useGetCostCentres,
  useGetLegalEntities,
  useGetAreas,
  useGetCountries,
  useGetPersons,
  useGetBcsByArea,
  useGetSystemSettings,
  useSubmitDemand,
  useDeleteDemand,
  defaultSystemSettings,
} from './intake.queries';
import { DemandTypeIndicator } from '../../components/DemandTypeIndicator';
import { useHelixViewport } from '../../hooks/useHelixViewport';
import { useFlags } from '../../hooks/useFlags';
import { useAIPrefillSuppressed } from '../../hooks/useAIPrefillSuppressed';
import { useAIPrefill } from './useAIPrefill';
import { AIPrefillModal } from './AIPrefillModal';
import { AIFieldIndicator } from '../../components/AIFieldIndicator';
import { confidenceBadgeProps } from '../../utils/badgeUtils';

const DEV_USER_ID = 'dev-user';

export function DemandForm(): JSX.Element {
  const navigate = useNavigate();
  const { id: pathId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const demandId = pathId ?? searchParams.get('id') ?? undefined;
  const isEditMode = !!demandId;
  const viewport = useHelixViewport();

  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [submitErrorModal, setSubmitErrorModal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const createMutation = useCreateDemand();
  const updateMutation = useUpdateDemand();
  const submitMutation = useSubmitDemand();
  const deleteDraftMutation = useDeleteDemand();
  const { data: existingDemand } = useGetDemand(demandId);
  const { data: costCentres = [] } = useGetCostCentres();
  const { data: legalEntities = [], isError: legalEntitiesError } = useGetLegalEntities();
  const { data: areas = [], isError: areasError } = useGetAreas();
  const { data: systemSettings } = useGetSystemSettings();

  const flags = useFlags();
  const { isSuppressed, suppress } = useAIPrefillSuppressed(DEV_USER_ID);
  const hasAutoOpened = useRef(false);

  const isIntakeClosed = useMemo(() => {
    if (!systemSettings) return false;
    const { intakeWindowStart, intakeWindowEnd } = systemSettings;
    if (!intakeWindowStart && !intakeWindowEnd) return false;
    const now = new Date();
    if (intakeWindowStart && now < new Date(intakeWindowStart)) return true;
    if (intakeWindowEnd   && now > new Date(intakeWindowEnd))   return true;
    return false;
  }, [systemSettings]);

  const intakeOpensAt = useMemo(() => {
    if (!systemSettings?.intakeWindowStart) return null;
    const open = new Date(systemSettings.intakeWindowStart);
    return new Date() < open ? open : null;
  }, [systemSettings]);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DemandFormValues>({
    resolver: zodResolver(demandFormSchema),
    defaultValues: {
      title: '',
      description: '',
      costCentreId: '',
      startDate: null,
      endDate: null,
      legalEntityId: '',
      areaId: '',
      demandManagerId: '',
      businessControllerId: '',
      demandOwner: '',
      objective: '',
      necessity: '',
      isMandatory: false,
      qualitativeValueCategory: false,
      quantitativeValueCategory: false,
      reasoningForMandatory: '',
      asisDescription: '',
      benefitsObjectives: '',
      tobeDescription: '',
      isSmallProject: false,
      isGxpRelevant: false,
      demandScope: null,
      countryId: null,
    },
  });

  const validCostCentreIds = useMemo(() => new Set(costCentres.map((cc) => cc.id)), [costCentres]);

  const watchedIsSmallProject = useWatch({ control, name: 'isSmallProject' });
  const watchedGxp = useWatch({ control, name: 'isGxpRelevant' });
  const watchedAreaId = useWatch({ control, name: 'areaId' });
  const watchedIsMandatory = useWatch({ control, name: 'isMandatory' });
  const watchedQualitative = useWatch({ control, name: 'qualitativeValueCategory' });
  const watchedQuantitative = useWatch({ control, name: 'quantitativeValueCategory' });
  const watchedDemandScope = useWatch({ control, name: 'demandScope' });
  const watchedCountryId = useWatch({ control, name: 'countryId' });
  const { data: countries = [], isError: countriesError } = useGetCountries();
  const showBenefits = watchedQualitative || watchedQuantitative;
  const isGlobalScope = watchedDemandScope === 'GLOBAL';
  const { data: persons = [], isError: personsError } = useGetPersons(watchedAreaId || undefined, watchedCountryId || undefined, isGlobalScope || undefined);
  const { data: bcsByArea = [] } = useGetBcsByArea(watchedAreaId || undefined, isGlobalScope || undefined);
  const refDataError = legalEntitiesError || areasError || personsError || countriesError;
  const settingsOrDefaults = systemSettings ?? defaultSystemSettings;
  const inferredType: 'P' | 'SP' = watchedIsSmallProject ? 'SP' : 'P';

  const {
    triggerPrefill,
    isLoading: prefillLoading,
    prefillFailed,
    aiSuggestedFields,
    clearAISuggested,
    markAISuggested,
    aiConfidence,
    estimatedCostCents,
  } = useAIPrefill({ flags, setValue, getValues, validCostCentreIds });

  useEffect(() => {
    if (flags['ai_prefill'] && !isEditMode && !isSuppressed && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      setModalOpened(true);
    }
  }, [flags, isEditMode, isSuppressed]);

  useEffect(() => {
    if (existingDemand) {
      reset({
        title: existingDemand.title,
        description: existingDemand.description,
        costCentreId: existingDemand.costCentreId ?? '',
        startDate: existingDemand.startDate ? dayjs(existingDemand.startDate).format('YYYY-MM-DD') : null,
        endDate: existingDemand.endDate ? dayjs(existingDemand.endDate).format('YYYY-MM-DD') : null,
        legalEntityId: existingDemand.legalEntityId ?? '',
        areaId: existingDemand.areaId ?? '',
        demandManagerId: existingDemand.demandManagerId ?? '',
        businessControllerId: existingDemand.businessControllerId ?? '',
        demandOwner: existingDemand.demandOwner ?? '',
        objective: existingDemand.objective ?? '',
        necessity: existingDemand.necessity ?? '',
        isMandatory: existingDemand.isMandatory ?? false,
        qualitativeValueCategory: existingDemand.qualitativeValueCategory ?? false,
        quantitativeValueCategory: existingDemand.quantitativeValueCategory ?? false,
        reasoningForMandatory: existingDemand.reasoningForMandatory ?? '',
        asisDescription: existingDemand.asisDescription ?? '',
        benefitsObjectives: existingDemand.benefitsObjectives ?? '',
        tobeDescription: existingDemand.tobeDescription ?? '',
        isSmallProject: (existingDemand as { isSmallProject?: boolean }).isSmallProject ?? false,
        isGxpRelevant: (existingDemand as { isGxpRelevant?: boolean }).isGxpRelevant ?? false,
        demandScope: (existingDemand as { demandScope?: 'GLOBAL' | 'LOCAL' | null }).demandScope ?? null,
        countryId: (existingDemand as { countryId?: string | null }).countryId ?? null,
      });
      if (existingDemand.draftSavedAt) {
        setDraftSavedAt(new Date(existingDemand.draftSavedAt));
      }
    }
  }, [existingDemand, reset]);

  useEffect(() => {
    if (estimatedCostCents == null) {
      clearAISuggested('isSmallProject');
      return;
    }
    const threshold = settingsOrDefaults.spThresholdEurCents;
    if (estimatedCostCents < threshold) {
      setValue('isSmallProject', true);
    }
    markAISuggested('isSmallProject');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedCostCents, settingsOrDefaults.spThresholdEurCents]);

  const handleDraftSave = async () => {
    const values = getValues();
    const dto = {
      title: values.title || undefined,
      description: values.description || undefined,
      costCentreId: values.costCentreId || undefined,
      startDate: values.startDate ? dayjs(values.startDate).format('YYYY-MM-DD') : undefined,
      endDate: values.endDate ? dayjs(values.endDate).format('YYYY-MM-DD') : undefined,
      legalEntityId: values.legalEntityId || undefined,
      areaId: values.areaId || undefined,
      demandManagerId: values.demandManagerId || undefined,
      businessControllerId: values.businessControllerId || undefined,
      demandOwner: values.demandOwner || undefined,
      objective: values.objective || undefined,
      necessity: values.necessity || undefined,
      isMandatory: values.isMandatory,
      qualitativeValueCategory: values.qualitativeValueCategory ?? false,
      quantitativeValueCategory: values.quantitativeValueCategory ?? false,
      reasoningForMandatory: values.isMandatory ? (values.reasoningForMandatory || undefined) : undefined,
      asisDescription: values.asisDescription || undefined,
      benefitsObjectives: (values.qualitativeValueCategory || values.quantitativeValueCategory)
        ? (values.benefitsObjectives || undefined)
        : undefined,
      tobeDescription: values.tobeDescription || undefined,
      isSmallProject: values.isSmallProject ?? false,
      isGxpRelevant: values.isGxpRelevant ?? false,
      demandScope: values.demandScope || undefined,
      countryId: values.demandScope === 'LOCAL' ? (values.countryId || undefined) : null,
    };

    if (demandId) {
      const result = await updateMutation.mutateAsync({ id: demandId, dto });
      if (result.draftSavedAt) setDraftSavedAt(new Date(result.draftSavedAt));
      return demandId;
    } else {
      const titleVal = values.title?.trim();
      const descVal = values.description?.trim();
      if (!titleVal || !descVal) return undefined;

      const createDto: CreateDemandDto = {
        title: titleVal,
        description: descVal,
        costCentreId: values.costCentreId || null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        isSmallProject: values.isSmallProject ?? false,
        isGxpRelevant: values.isGxpRelevant ?? false,
      };
      const result = await createMutation.mutateAsync(createDto);
      const updateResult = await updateMutation.mutateAsync({ id: result.id, dto });
      if (updateResult.draftSavedAt) setDraftSavedAt(new Date(updateResult.draftSavedAt));

      navigate(`/demands/new?id=${result.id}`, { replace: true });
      return result.id;
    }
  };

  const handleSaveAsDraft = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await handleDraftSave();
      notifications.show({ color: 'green', message: 'Draft saved' });
      navigate(-1);
    } catch {
      notifications.show({ color: 'red', message: 'Draft not saved — please try again' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalSubmit = handleSubmit(async () => {
    let id = demandId;

    try {
      id = await handleDraftSave() ?? id;
    } catch {
      // draft save failure is non-blocking — continue if id exists
    }

    if (!id) return;

    try {
      await submitMutation.mutateAsync(id);
      navigate(`/demands/${id}/confirmation`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.code === 'NO_DM_CONFIGURED') {
        setSubmitErrorModal('no-dm');
      } else if (axios.isAxiosError(err) && err.response?.data?.code === 'INTAKE_CLOSED') {
        setSubmitErrorModal('intake-closed');
      } else {
        setSubmitErrorModal('network');
      }
    }
  });

  const draftSaveRef = useRef(handleDraftSave);
  draftSaveRef.current = handleDraftSave;

  const handleConfirmDeleteDraft = async () => {
    if (!demandId) return;
    try {
      await deleteDraftMutation.mutateAsync(demandId);
      navigate('/demands');
    } catch {
      notifications.show({ color: 'red', message: 'Could not delete draft — please try again.' });
    } finally {
      setDeleteConfirmOpen(false);
    }
  };

  const handleFinancialPlanningClick = async () => {
    let id = demandId;
    if (!id) {
      id = await handleDraftSave().catch(() => undefined);
      if (!id) {
        notifications.show({
          color: 'yellow',
          message: 'Add a title and description first, then try Financial Planning.',
        });
        return;
      }
    } else {
      const saved = await handleDraftSave().catch(() => undefined);
      if (!saved) {
        notifications.show({
          color: 'red',
          title: 'Could not save draft',
          message: 'Please try again before opening Financial Planning.',
        });
        return;
      }
    }
    navigate(`/demands/${id}/financial-planning`);
  };

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        await draftSaveRef.current();
      } catch {
        notifications.show({
          color: 'red',
          title: 'Draft not saved',
          message: 'Could not save your draft. Your work is safe — keep going.',
        });
      }
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!persons.length) return;
    const currentDmId = getValues('demandManagerId');
    if (currentDmId && !persons.some(p => p.id === currentDmId)) {
      setValue('demandManagerId', '');
    }
  }, [watchedAreaId, persons, getValues, setValue]);

  return (
    <>
      <Modal
        opened={!!submitErrorModal}
        onClose={() => setSubmitErrorModal(null)}
        title={
          submitErrorModal === 'no-dm'
            ? 'No Demand Manager configured'
            : submitErrorModal === 'intake-closed'
              ? 'Intake window closed'
              : 'Submission failed'
        }
      >
        <Text>
          {submitErrorModal === 'no-dm'
            ? `No Demand Manager is configured for ${areas.find(a => a.id === getValues('areaId'))?.name ?? 'this area'}. Your draft has been saved. Contact your administrator.`
            : submitErrorModal === 'intake-closed'
              ? 'The intake window is currently closed. Your draft has been saved. Try again when the window opens.'
              : 'Your draft has been saved. Check your connection and try again.'}
        </Text>
        <Button mt="md" onClick={() => setSubmitErrorModal(null)}>OK</Button>
      </Modal>

      {flags['ai_prefill'] && (
        <AIPrefillModal
          opened={modalOpened}
          isLoading={prefillLoading}
          onCreateManually={(suppressPref) => {
            if (suppressPref) suppress();
            setModalOpened(false);
          }}
          onPrefill={async (description, suppressPref) => {
            if (suppressPref) suppress();
            await triggerPrefill(description);
            setModalOpened(false);
          }}
        />
      )}

      <Stack gap="lg" p="md" maw={860} mx="auto">
        <Group justify="space-between" align="baseline">
          <Group gap="sm" align="center">
            <Title order={2}>New Demand</Title>
            <DemandTypeIndicator type={inferredType} />
          </Group>
          {draftSavedAt && (
            <Text size="sm" c="dimmed">
              Draft — saved {dayjs(draftSavedAt).format('HH:mm:ss')}
            </Text>
          )}
        </Group>

        <Card withBorder shadow="sm" radius="lg" p="xl">
          <Stack gap="lg">
        {prefillFailed && (
          <Alert color="orange" title="AI unavailable">
            Starting with a blank form — AI suggestions unavailable
          </Alert>
        )}

        {existingDemand?.status === DemandStatus.REROUTED && existingDemand.dmCommentary && (
          <Alert color="yellow" title="Rework Requested" data-testid="rerouted-alert">
            {existingDemand.dmCommentary}
          </Alert>
        )}

        {/* ── Basics ─────────────────────────────────────────────── */}
        <div>
          <Group justify="space-between" mb={6}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">Basics</Text>
            {flags['ai_prefill'] && (
              <Button
                size="xs"
                variant="subtle"
                onClick={() => setModalOpened(true)}
              >
                ✨ Prefill with AI
              </Button>
            )}
          </Group>
          <Divider mb="sm" />
          <Stack gap="sm">
            <AIFieldIndicator isAISuggested={aiSuggestedFields.has('title')}>
              <Group align="flex-end" gap={4}>
                <Box style={{ flex: 1 }}>
                  <TextInput
                    label="Title"
                    required
                    size="sm"
                    placeholder="Brief title for your demand"
                    {...register('title', {
                      onChange: () => {
                        if (aiSuggestedFields.has('title')) clearAISuggested('title');
                      },
                    })}
                    error={errors.title?.message}
                  />
                </Box>
                {aiConfidence.title && (
                  <Badge size="xs" {...confidenceBadgeProps(aiConfidence.title)} mb={4} />
                )}
              </Group>
            </AIFieldIndicator>
            <AIFieldIndicator isAISuggested={aiSuggestedFields.has('description')}>
              <Group align="flex-end" gap={4}>
                <Box style={{ flex: 1 }}>
                  <Textarea
                    label="Description"
                    required
                    size="sm"
                    autosize
                    minRows={2}
                    maxRows={10}
                    placeholder="Describe the demand in a few sentences — what it is, why it matters"
                    {...register('description', {
                      onChange: () => {
                        if (aiSuggestedFields.has('description')) clearAISuggested('description');
                      },
                    })}
                    error={errors.description?.message}
                  />
                </Box>
                {aiConfidence.description && (
                  <Badge size="xs" {...confidenceBadgeProps(aiConfidence.description)} mb={4} />
                )}
              </Group>
            </AIFieldIndicator>
            <Box pt="xs">
              <Controller
                name="isSmallProject"
                control={control}
                render={({ field }) => (
                  <>
                    <Switch
                      label="Small Project — scope and budget are limited (classifies demand as SP)"
                      size="sm"
                      checked={field.value ?? false}
                      onChange={(e) => {
                        field.onChange(e.currentTarget.checked);
                        clearAISuggested('isSmallProject');
                      }}
                    />
                    {aiSuggestedFields.has('isSmallProject') && estimatedCostCents != null && (() => {
                      const threshold = settingsOrDefaults.spThresholdEurCents;
                      const costFormatted = (estimatedCostCents / 100).toLocaleString('en-GB');
                      const thresholdFormatted = (threshold / 100).toLocaleString('en-GB');
                      return (
                        <Text size="xs" c="dimmed" mt={4}>
                          AI estimated cost: €{costFormatted}
                          {aiConfidence.estimatedCostCents && (
                            <Badge size="xs" {...confidenceBadgeProps(aiConfidence.estimatedCostCents)} ml={4} />
                          )}
                          {' '}—{' '}
                          {estimatedCostCents < threshold
                            ? `below the €${thresholdFormatted} Small Project threshold. Toggled on automatically.`
                            : `above the €${thresholdFormatted} Small Project threshold. Toggle not set.`}
                        </Text>
                      );
                    })()}
                  </>
                )}
              />
            </Box>
          </Stack>
        </div>

        {/* ── Classification ─────────────────────────────────────── */}
        <div>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>Classification</Text>
          <Divider mb="sm" />
          {refDataError && (
            <Alert color="stadaRed" title="Reference data unavailable" mb="sm">
              Some dropdown options failed to load. Please refresh the page and try again.
            </Alert>
          )}
          <Stack gap="md">
            {/* Row 1: Cost Centre + Legal Entity */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Controller
                  name="costCentreId"
                  control={control}
                  render={({ field }) => (
                    <AIFieldIndicator isAISuggested={aiSuggestedFields.has('costCentreId')}>
                      <Select
                        label="Cost Centre"
                        required
                        searchable
                        size="sm"
                        placeholder="Select a cost centre"
                        data={[
                          ...costCentres.map((cc) => ({ value: cc.id, label: `${cc.code} — ${cc.name}` })),
                          ...(existingDemand?.costCentre && !costCentres.find((cc) => cc.id === existingDemand.costCentreId)
                            ? [{ value: existingDemand.costCentreId!, label: `${existingDemand.costCentre.code} — ${existingDemand.costCentre.name} (Inactive)`, disabled: true }]
                            : []),
                        ]}
                        value={field.value || null}
                        onChange={(val) => {
                          field.onChange(val ?? '');
                          if (aiSuggestedFields.has('costCentreId')) clearAISuggested('costCentreId');
                        }}
                        onBlur={field.onBlur}
                        error={errors.costCentreId?.message}
                      />
                    </AIFieldIndicator>
                  )}
                />
              </div>

              <Controller
                name="legalEntityId"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Legal Entity"
                    required
                    searchable
                    size="sm"
                    placeholder="Select legal entity"
                    data={[
                      ...legalEntities.map((le) => ({ value: le.id, label: le.name })),
                      ...(existingDemand?.legalEntity && !legalEntities.find((le) => le.id === existingDemand.legalEntityId)
                        ? [{ value: existingDemand.legalEntityId!, label: `${existingDemand.legalEntity.name} (Inactive)`, disabled: true }]
                        : []),
                    ]}
                    value={field.value ?? null}
                    onChange={(val) => field.onChange(val ?? '')}
                    error={errors.legalEntityId?.message}
                  />
                )}
              />
            </SimpleGrid>

            {/* Row 2: Area + Scope */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Controller
                name="areaId"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Area"
                    required
                    searchable
                    size="sm"
                    placeholder="Select area"
                    data={[
                      ...areas.map((a) => ({ value: a.id, label: a.name })),
                      ...(existingDemand?.area && !areas.find((a) => a.id === existingDemand.areaId)
                        ? [{ value: existingDemand.areaId!, label: `${existingDemand.area.name} (Inactive)`, disabled: true }]
                        : []),
                    ]}
                    value={field.value ?? null}
                    onChange={(val) => field.onChange(val ?? '')}
                    error={errors.areaId?.message}
                  />
                )}
              />
              <Controller
                name="demandScope"
                control={control}
                render={({ field }) => (
                  <div>
                    <Text size="sm" fw={500} mb={4}><span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></Text>
                    <SegmentedControl
                      data={[
                        { label: 'Global', value: 'GLOBAL' },
                        { label: 'Local', value: 'LOCAL' },
                      ]}
                      value={field.value ?? ''}
                      onChange={(val) => {
                        field.onChange(val);
                        if (val === 'GLOBAL') setValue('countryId', null);
                      }}
                      fullWidth
                    />
                    {errors.demandScope && <Text size="xs" c="red" mt={4}>{errors.demandScope.message}</Text>}
                  </div>
                )}
              />
            </SimpleGrid>

            {/* Row 3: Country (own row, shown only when LOCAL) */}
            {watchedDemandScope === 'LOCAL' && (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Controller
                  name="countryId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Country"
                      required
                      searchable
                      size="sm"
                      placeholder="Select country"
                      data={[
                        ...countries.map((c: CountryResponse) => ({ value: c.id, label: c.name })),
                        ...(existingDemand?.country && !countries.find((c: CountryResponse) => c.id === (existingDemand as { countryId?: string }).countryId)
                          ? [{ value: (existingDemand as { countryId?: string }).countryId!, label: `${existingDemand.country.name} (Inactive)`, disabled: true }]
                          : []),
                      ]}
                      value={field.value ?? null}
                      onChange={(val) => field.onChange(val ?? '')}
                      error={errors.countryId?.message}
                    />
                  )}
                />
              </SimpleGrid>
            )}

            {/* Row 4: Demand Manager + Business Controller (always paired) */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Controller
                name="demandManagerId"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Demand Manager"
                    required
                    searchable
                    size="sm"
                    placeholder="Select demand manager"
                    data={persons.map((p) => ({ value: p.id, label: p.name }))}
                    value={field.value ?? null}
                    onChange={(val) => field.onChange(val ?? '')}
                    error={errors.demandManagerId?.message}
                  />
                )}
              />
              {!watchedIsSmallProject && (
                <Controller
                  name="businessControllerId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Business Controller"
                      required
                      searchable
                      clearable
                      size="sm"
                      placeholder={
                        !watchedAreaId
                          ? 'Select an area first'
                          : bcsByArea.length === 0
                          ? 'No Business Controllers configured for this area'
                          : 'Select Business Controller'
                      }
                      data={bcsByArea.map((u) => ({ value: u.id, label: u.name }))}
                      value={field.value ?? null}
                      onChange={(val) => field.onChange(val ?? '')}
                      disabled={!watchedAreaId || bcsByArea.length === 0}
                      error={errors.businessControllerId?.message}
                    />
                  )}
                />
              )}
            </SimpleGrid>

            {/* Row 5: Start Date + End Date (always paired) */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DateInput
                    label="Start Date"
                    size="sm"
                    placeholder="YYYY-MM-DD"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    error={errors.startDate?.message}
                  />
                )}
              />
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <DateInput
                    label="End Date"
                    required
                    size="sm"
                    placeholder="YYYY-MM-DD"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    error={errors.endDate?.message}
                  />
                )}
              />
            </SimpleGrid>

            {/* Row 6: Demand Owner */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Demand Owner"
                required
                size="sm"
                placeholder="Full name of the demand owner"
                {...register('demandOwner')}
                error={errors.demandOwner?.message}
              />
            </SimpleGrid>

            {/* Full-width: toggles */}
            <Controller
              name="isMandatory"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Mandatory Demand (legal / compliance / regulatory / system-upgrade obligation)"
                  size="sm"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            {watchedIsMandatory && (
              <Textarea
                label="Reasoning for Mandatory"
                required
                size="sm"
                autosize
                minRows={2}
                maxRows={10}
                {...register('reasoningForMandatory')}
                error={errors.reasoningForMandatory?.message}
              />
            )}
            <Box pt="xl">
              <Controller
                name="isGxpRelevant"
                control={control}
                render={({ field }) => (
                  <Switch
                    label="GxP Relevant — demand feeds a validated downstream process"
                    size="sm"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
            </Box>
          </Stack>
        </div>

        {/* ── Timeline — GxP Milestones ──────────────────────────── */}
        {watchedGxp && (
          <div>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>Timeline — GxP Milestones</Text>
            <Divider mb="sm" />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Card withBorder p="sm">
                <Text fw={600} size="sm">IT Validation</Text>
                <Text size="sm" c="dimmed">{settingsOrDefaults.gxpItValidationDays} days</Text>
                <Text size="xs" c="dimmed" mt={4}>Default duration — adjustable by Project Manager after approval</Text>
              </Card>
              <Card withBorder p="sm">
                <Text fw={600} size="sm">Documentation</Text>
                <Text size="sm" c="dimmed">{settingsOrDefaults.gxpDocumentationDays} days</Text>
                <Text size="xs" c="dimmed" mt={4}>Default duration — adjustable by Project Manager after approval</Text>
              </Card>
            </SimpleGrid>
          </div>
        )}

        {/* ── Objectives & Value ─────────────────────────────────── */}
        <div>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>Objectives &amp; Value</Text>
          <Divider mb="sm" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Box style={{ gridColumn: '1 / -1' }}>
              <AIFieldIndicator isAISuggested={aiSuggestedFields.has('objective')}>
                <Group align="flex-end" gap={4}>
                  <Box style={{ flex: 1 }}>
                    <Textarea
                      label="Objective"
                      required
                      size="sm"
                      autosize
                      minRows={2}
                      maxRows={10}
                      placeholder="What is the objective of this demand?"
                      {...register('objective', {
                        onChange: () => {
                          if (aiSuggestedFields.has('objective')) clearAISuggested('objective');
                        },
                      })}
                      error={errors.objective?.message}
                    />
                  </Box>
                  {aiConfidence.objective && (
                    <Badge size="xs" {...confidenceBadgeProps(aiConfidence.objective)} mb={4} />
                  )}
                </Group>
              </AIFieldIndicator>
            </Box>
            <Box style={{ gridColumn: '1 / -1' }}>
              <AIFieldIndicator isAISuggested={aiSuggestedFields.has('necessity')}>
                <Group align="flex-end" gap={4}>
                  <Box style={{ flex: 1 }}>
                    <Textarea
                      label="Necessity"
                      required
                      size="sm"
                      autosize
                      minRows={2}
                      maxRows={10}
                      placeholder="Why is this demand necessary?"
                      {...register('necessity', {
                        onChange: () => {
                          if (aiSuggestedFields.has('necessity')) clearAISuggested('necessity');
                        },
                      })}
                      error={errors.necessity?.message}
                    />
                  </Box>
                  {aiConfidence.necessity && (
                    <Badge size="xs" {...confidenceBadgeProps(aiConfidence.necessity)} mb={4} />
                  )}
                </Group>
              </AIFieldIndicator>
            </Box>
            <Textarea
              label="As-is Description"
              size="sm"
              autosize
              minRows={2}
              maxRows={10}
              placeholder="Describe the current state"
              {...register('asisDescription')}
              error={errors.asisDescription?.message}
            />
            <Textarea
              label="To-be Description"
              size="sm"
              autosize
              minRows={2}
              maxRows={10}
              placeholder="Describe the desired future state"
              {...register('tobeDescription')}
              error={errors.tobeDescription?.message}
            />
            <Box style={{ gridColumn: '1 / -1' }}>
              <Stack gap="xs">
                <Controller
                  name="qualitativeValueCategory"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      label="Qualitative Value"
                      size="sm"
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
                <Controller
                  name="quantitativeValueCategory"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      label="Quantitative Value"
                      size="sm"
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.currentTarget.checked)}
                    />
                  )}
                />
              </Stack>
            </Box>
            {showBenefits && (
              <Box style={{ gridColumn: '1 / -1' }}>
                <AIFieldIndicator isAISuggested={aiSuggestedFields.has('benefitsObjectives')}>
                  <Group align="flex-end" gap={4}>
                    <Box style={{ flex: 1 }}>
                      <Textarea
                        label="Benefits"
                        required
                        size="sm"
                        autosize
                        minRows={2}
                        maxRows={10}
                        placeholder="Describe expected benefits"
                        {...register('benefitsObjectives', {
                          onChange: () => {
                            if (aiSuggestedFields.has('benefitsObjectives')) clearAISuggested('benefitsObjectives');
                          },
                        })}
                        error={errors.benefitsObjectives?.message}
                      />
                    </Box>
                    {aiConfidence.benefitsObjectives && (
                      <Badge size="xs" {...confidenceBadgeProps(aiConfidence.benefitsObjectives)} mb={4} />
                    )}
                  </Group>
                </AIFieldIndicator>
              </Box>
            )}
          </SimpleGrid>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <Modal
          opened={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title={`Delete Draft — ${getValues('title') || 'this draft'}?`}
          closeOnClickOutside={false}
        >
          <Text>This cannot be undone.</Text>
          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => setDeleteConfirmOpen(false)} autoFocus>
              Cancel
            </Button>
            <Button
              color="stadaRed"
              loading={deleteDraftMutation.isPending}
              onClick={handleConfirmDeleteDraft}
            >
              Delete
            </Button>
          </Group>
        </Modal>

        <Group justify="space-between" mt="xl">
          <Box>
            {(isEditMode || !!draftSavedAt) && (
              <Anchor
                component="button"
                c="red"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete draft
              </Anchor>
            )}
          </Box>
          <Group>
            <Button variant="default" onClick={() => navigate('/demands')}>
              Back to My Demands
            </Button>
            <Button variant="default" loading={isSaving} onClick={handleSaveAsDraft}>
              Save as Draft
            </Button>
            {!watchedIsSmallProject && (
              <Button variant="default" onClick={handleFinancialPlanningClick}>
                Financial Planning
              </Button>
            )}
            <Button
              type="submit"
              color="stadaRed"
              disabled={viewport === 'mobile' || isIntakeClosed}
              onClick={handleFinalSubmit}
              title={
                viewport === 'mobile'
                  ? 'Complete your demand on desktop — your draft has been saved.'
                  : isIntakeClosed
                    ? (intakeOpensAt
                        ? `Intake window is not currently open (opens ${intakeOpensAt.toLocaleDateString()})`
                        : 'Intake window is not currently open')
                    : undefined
              }
            >
              Submit Demand
            </Button>
          </Group>
        </Group>
        {viewport === 'mobile' && (
          <Text size="sm" c="dimmed" ta="right">
            Complete your demand on desktop — your draft has been saved.
          </Text>
        )}
        {isIntakeClosed && (
          <Alert color="yellow" mt="xs">
            {intakeOpensAt
              ? `Intake window is not currently open (opens ${intakeOpensAt.toLocaleDateString()})`
              : 'Intake window is not currently open'}
          </Alert>
        )}
          </Stack>
        </Card>
      </Stack>
    </>
  );
}
