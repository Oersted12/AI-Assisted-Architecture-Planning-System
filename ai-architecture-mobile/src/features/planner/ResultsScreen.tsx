import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ActionButton,
  Card,
  DataRow,
  InlineMessage,
  PlannerInput,
  PlannerPage,
  ScreenTitle,
  SectionTitle,
  plannerColors,
} from '@/features/planner/components';
import { savePdfReport, sharePdfReport } from '@/services/pdf';
import type {
  DownloadPdfRequest,
  EditBlueprintRequest,
  EditBlueprintResponse,
  PredictRequest,
  PredictResponse,
  RoomConfig,
} from '@/types/api';
import { blueprintUrl, editBlueprint } from '@/services/api';

interface PlanVersion {
  label: string;
  summary: string;
  variant: number;
  extraDoors: Record<string, unknown>[];
  blueprints: Record<string, string>;
  breakdown: RoomConfig[];
}

export function ResultsScreen({
  result,
  request,
  onEditDetails,
  onNewPlan,
}: {
  result: PredictResponse;
  request: PredictRequest;
  onEditDetails: () => void;
  onNewPlan: () => void;
}) {
  const [versions, setVersions] = useState<PlanVersion[]>([
    {
      label: 'Original plan',
      summary: '',
      variant: 0,
      extraDoors: [],
      blueprints: result.blueprints ?? {},
      breakdown: result.per_floor_breakdown ?? [],
    },
  ]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [editing, setEditing] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editMessageKind, setEditMessageKind] = useState<'error' | 'info'>('info');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [savedPdfUri, setSavedPdfUri] = useState<string | null>(null);
  const [pdfMessage, setPdfMessage] = useState('');
  const [pdfMessageKind, setPdfMessageKind] = useState<'error' | 'info' | 'success'>('info');

  const current = versions[activeIndex];
  const plans = useMemo(
    () =>
      Object.entries(current.blueprints).sort(
        ([left], [right]) => Number(left) - Number(right),
      ),
    [current.blueprints],
  );
  const canEdit = plans.length > 0 && current.breakdown.length > 0;
  const feasible = result.feasibility === 'Feasible';

  const downloadReport = async () => {
    const pdfInputs: PredictRequest =
      current.breakdown.length > 0
        ? {
            ...request,
            rooms: { type: 'perFloor', data: current.breakdown },
          }
        : request;
    const payload: DownloadPdfRequest = {
      result: { ...result, blueprints: current.blueprints },
      inputs: pdfInputs,
    };

    setDownloadingPdf(true);
    setPdfMessage('');
    try {
      const uri = await savePdfReport(payload);
      setSavedPdfUri(uri);
      setPdfMessage('PDF saved to this app’s documents.');
      setPdfMessageKind('success');
    } catch (cause) {
      setPdfMessageKind('error');
      setPdfMessage(cause instanceof Error ? cause.message : 'Could not save the PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const shareReport = async () => {
    if (!savedPdfUri) {
      return;
    }
    setSharingPdf(true);
    setPdfMessage('');
    try {
      await sharePdfReport(savedPdfUri);
      setPdfMessageKind('success');
      setPdfMessage('PDF shared.');
    } catch (cause) {
      setPdfMessageKind('error');
      setPdfMessage(cause instanceof Error ? cause.message : 'Could not share the PDF.');
    } finally {
      setSharingPdf(false);
    }
  };

  const submitEdit = async () => {
    if (!instruction.trim()) {
      setEditMessageKind('error');
      setEditMessage('Please type what you want to change.');
      return;
    }

    const payload: EditBlueprintRequest = {
      instruction: instruction.trim(),
      perFloorBreakdown: current.breakdown,
      purpose: request.purpose,
      layout_type: result.layout_type,
      structure_type: result.structure_type,
      landLength: request.landLength,
      landWidth: request.landWidth,
      groundFloorAreaSqm: result.ground_floor_area_sqm,
      roadLabel: request.roadLabel,
      variant: current.variant,
      extraDoors: current.extraDoors,
      extraRoads: request.extraRoads,
    };

    setEditing(true);
    setEditMessage('');
    try {
      const response: EditBlueprintResponse = await editBlueprint(payload);
      if (!response.applied) {
        setEditMessageKind('info');
        setEditMessage(response.message);
        return;
      }

      const next: PlanVersion = {
        label: `Edit ${versions.length}`,
        summary: response.summary || instruction.trim(),
        variant: response.variant,
        extraDoors: response.extraDoors,
        blueprints: response.blueprints,
        breakdown: response.perFloorBreakdown,
      };
      setVersions((currentVersions) => [...currentVersions, next]);
      setActiveIndex(versions.length);
      setInstruction('');
      setEditMessageKind('info');
      setEditMessage(response.message || 'Blueprint updated.');
    } catch (cause) {
      setEditMessageKind('error');
      setEditMessage(cause instanceof Error ? cause.message : 'Blueprint edit failed.');
    } finally {
      setEditing(false);
    }
  };

  return (
    <PlannerPage>
      <ScreenTitle title="Your Building Plan" step="Results" />

      <Card>
        <SectionTitle>Location</SectionTitle>
        <Text style={styles.muted}>{request.address}</Text>
      </Card>

      {result.area_matched === false ? (
        <InlineMessage kind="info">
          Area not recognized. We used “{result.area_name}”; this result may be less exact.
        </InlineMessage>
      ) : null}

      <Card>
        <Text style={[styles.feasibility, feasible ? styles.feasible : styles.notFeasible]}>
          {feasible ? 'Feasible' : result.feasibility}
        </Text>
        <Text style={styles.muted}>
          {result.rule_blockers.length > 0
            ? 'Decided by the UDA rules'
            : `Confidence: ${result.feas_confidence}%`}
        </Text>
      </Card>

      {result.rule_blockers.length > 0 ? (
        <Card>
          <SectionTitle>Why this plan is not feasible</SectionTitle>
          {result.rule_blockers.map((blocker, index) => (
            <Text key={`${index}-${blocker}`} style={styles.blocker}>
              • {blocker}
            </Text>
          ))}
          {result.rule_suggestions.length > 0 ? (
            <View style={styles.suggestionBox}>
              <Text style={styles.suggestionTitle}>Try this</Text>
              {result.rule_suggestions.map((suggestion, index) => (
                <Text key={`${index}-${suggestion}`} style={styles.suggestion}>
                  • {suggestion}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {!feasible && result.rule_blockers.length === 0 ? (
        <InlineMessage kind="info">
          No single rule blocked this plan. The model was not sure; please check with the UDA.
        </InlineMessage>
      ) : null}

      {result.rule_warnings.length > 0 ? (
        <Card>
          <SectionTitle>Things to check</SectionTitle>
          {result.rule_warnings.map((warning, index) => (
            <Text key={`${index}-${warning}`} style={styles.warning}>
              • {warning}
            </Text>
          ))}
        </Card>
      ) : null}

      {feasible ? (
        <Card>
          <SectionTitle>Suggested design</SectionTitle>
          <DataRow
            label="Layout"
            value={`${result.layout_type} (${result.layout_confidence}%)`}
          />
          <DataRow
            label="Structure"
            value={`${result.structure_type} (${result.struct_confidence}%)`}
          />
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Zone and area</SectionTitle>
        <DataRow label="Area" value={result.area_name} />
        <DataRow label="Zone" value={`${result.zone_name} (${result.zone_code})`} />
        <DataRow label="Land area" value={`${result.land_area_sqm} sqm`} />
        <DataRow label="Allowed floor area" value={`${result.permissible_fa_sqm} sqm`} />
        <DataRow label="Requested floor area" value={`${result.requested_fa_sqm} sqm`} />
        <DataRow
          label="Floor area used"
          value={`${Math.round(result.fa_utilisation_ratio * 100)}%`}
        />
        <DataRow label="Ground floor area" value={`${result.ground_floor_area_sqm} sqm`} />
      </Card>

      {versions.length > 1 ? (
        <Card>
          <Text style={styles.versionTitle}>
            Version {activeIndex + 1} of {versions.length}
          </Text>
          <Text style={styles.muted}>
            {current.label}
            {current.summary ? `: ${current.summary}` : ''}
          </Text>
        </Card>
      ) : null}

      {plans.length > 0 ? (
        <Card>
          <SectionTitle>Floor plans</SectionTitle>
          {plans.map(([floor, path]) => (
            <View key={`${activeIndex}-${floor}`} style={styles.blueprintContainer}>
              <Text style={styles.floorTitle}>
                {floor === '1' ? 'Ground floor' : `Floor ${floor}`}
              </Text>
              <Image
                source={{ uri: blueprintUrl(path) }}
                contentFit="contain"
                style={styles.blueprint}
                accessibilityLabel={`Floor ${floor} blueprint`}
              />
            </View>
          ))}
          {current.breakdown.length > 0 ? (
            <View style={styles.breakdown}>
              <SectionTitle>Per-floor breakdown</SectionTitle>
              {current.breakdown.map((rooms, index) => (
                <View key={`breakdown-${index}`} style={styles.breakdownRow}>
                  <Text style={styles.floorTitle}>
                    {index === 0 ? 'Ground floor' : `Floor ${index + 1}`}
                  </Text>
                  <Text style={styles.muted}>
                    Bedrooms {rooms.bedrooms} · Bathrooms {rooms.bathrooms} · Kitchens{' '}
                    {rooms.kitchens} · Visitor halls {rooms.visitorHalls} · Extra rooms{' '}
                    {rooms.extraRooms}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {versions.length > 1 ? (
            <View style={styles.versionButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={activeIndex === 0}
                onPress={() => setActiveIndex((index) => Math.max(0, index - 1))}
                style={[styles.versionButton, activeIndex === 0 ? styles.disabled : null]}
              >
                <Text style={styles.versionButtonText}>Previous plan</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={activeIndex === versions.length - 1}
                onPress={() =>
                  setActiveIndex((index) => Math.min(versions.length - 1, index + 1))
                }
                style={[
                  styles.versionButton,
                  activeIndex === versions.length - 1 ? styles.disabled : null,
                ]}
              >
                <Text style={styles.versionButtonText}>Next plan</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>
      ) : (
        <Card>
          <SectionTitle>Floor plans</SectionTitle>
          <Text style={styles.muted}>No blueprint was returned for this result.</Text>
        </Card>
      )}

      {canEdit ? (
        <Card>
          <SectionTitle>Want to change something?</SectionTitle>
          <Text style={styles.muted}>
            Describe a room or door change, then regenerate the plan currently shown.
          </Text>
          <PlannerInput
            value={instruction}
            onChangeText={setInstruction}
            maxLength={500}
            multiline
            placeholder="e.g. Make the kitchen square and add a door on the south wall"
            editable={!editing}
          />
          {editMessage ? (
            <InlineMessage kind={editMessageKind}>{editMessage}</InlineMessage>
          ) : null}
          <ActionButton
            title="Regenerate blueprint"
            onPress={() => void submitEdit()}
            loading={editing}
          />
          {activeIndex > 0 ? (
            <Text style={styles.muted}>
              Feasibility and explanation still refer to the original details.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {result.explanation ? (
        <Card>
          <SectionTitle>Explanation</SectionTitle>
          <Text style={styles.explanation}>
            {result.explanation.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <Text key={index} style={styles.boldExplanation}>
                  {part.slice(2, -2)}
                </Text>
              ) : (
                part
              ),
            )}
          </Text>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>PDF report</SectionTitle>
        <ActionButton
          title="Download PDF Report"
          onPress={() => void downloadReport()}
          loading={downloadingPdf}
        />
        {savedPdfUri ? (
          <ActionButton
            title="Share saved PDF"
            onPress={() => void shareReport()}
            loading={sharingPdf}
            secondary
          />
        ) : null}
        {pdfMessage ? <InlineMessage kind={pdfMessageKind}>{pdfMessage}</InlineMessage> : null}
      </Card>
      <ActionButton title="Edit Details" onPress={onEditDetails} secondary />
      <ActionButton title="New Plan" onPress={onNewPlan} />
      <Text style={styles.disclaimer}>
        AI-generated concept plan only. A licensed architect must certify final
        construction drawings.
      </Text>
    </PlannerPage>
  );
}

const styles = StyleSheet.create({
  feasibility: { fontSize: 22, fontWeight: '800' },
  feasible: { color: plannerColors.green },
  notFeasible: { color: plannerColors.red },
  muted: { color: plannerColors.muted, fontSize: 13, lineHeight: 19 },
  blocker: { color: '#7B241C', fontSize: 14, lineHeight: 21 },
  warning: { color: '#7D5A00', fontSize: 14, lineHeight: 21 },
  suggestionBox: {
    backgroundColor: '#E9F7EF',
    padding: 12,
    borderRadius: 10,
    gap: 7,
  },
  suggestionTitle: { color: plannerColors.green, fontWeight: '800', fontSize: 14 },
  suggestion: { color: '#1E8449', fontSize: 13, lineHeight: 19 },
  versionTitle: { color: plannerColors.navy, fontWeight: '800', fontSize: 14 },
  blueprintContainer: { gap: 8 },
  breakdown: { gap: 8, paddingTop: 6 },
  breakdownRow: { gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#E8EDF3' },
  floorTitle: { color: plannerColors.navy, fontWeight: '800', fontSize: 14 },
  blueprint: {
    width: '100%',
    height: 260,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6EAF8',
    backgroundColor: '#FFFFFF',
  },
  versionButtons: { flexDirection: 'row', gap: 10 },
  versionButton: {
    minHeight: 44,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: plannerColors.navy,
    borderRadius: 9,
  },
  versionButtonText: { color: plannerColors.navy, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  explanation: { color: plannerColors.text, fontSize: 14, lineHeight: 22 },
  boldExplanation: { fontWeight: '800' },
  disclaimer: {
    textAlign: 'center',
    color: plannerColors.muted,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 10,
  },
});
