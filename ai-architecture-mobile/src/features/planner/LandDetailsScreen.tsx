import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  LAND_SHAPES,
  MIN_LAND_AREA_SQM,
  METRES_PER_FOOT,
  ROAD_TYPES,
  SQUARE_METRES_PER_PERCH,
} from '@/constants/architecture';
import {
  ActionButton,
  Card,
  ChoiceRow,
  InlineMessage,
  PlannerInput,
  PlannerPage,
  ScreenTitle,
  SectionTitle,
  plannerColors,
} from '@/features/planner/components';
import type { LandDraft, SelectedLocation } from '@/features/planner/types';

export function LandDetailsScreen({
  location,
  value,
  onChange,
  onBack,
  onContinue,
}: {
  location: SelectedLocation;
  value: LandDraft;
  onChange: (value: LandDraft) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [error, setError] = useState('');
  const length = Number(value.length);
  const width = Number(value.width);
  const lengthMetres =
    value.unit === 'ft' ? length * METRES_PER_FOOT : length;
  const widthMetres = value.unit === 'ft' ? width * METRES_PER_FOOT : width;
  const area = lengthMetres * widthMetres;
  const perch = area / SQUARE_METRES_PER_PERCH;

  const updateRoad = (label: string, extra = false) => {
    const road = ROAD_TYPES.find((item) => item.label === label);
    if (!road) {
      return;
    }
    onChange(
      extra
        ? { ...value, extraRoadLabel: road.label, extraRoadWidth: road.width }
        : { ...value, roadLabel: road.label, roadWidth: road.width },
    );
  };

  const continueToRooms = () => {
    if (!value.length.trim() || !Number.isFinite(length) || length <= 0) {
      setError('Please enter a valid land length greater than 0.');
      return;
    }
    if (!value.width.trim() || !Number.isFinite(width) || width <= 0) {
      setError('Please enter a valid land width greater than 0.');
      return;
    }
    if (!Number.isFinite(area) || area < MIN_LAND_AREA_SQM) {
      setError(`Land area seems too small (minimum ~${MIN_LAND_AREA_SQM} sqm).`);
      return;
    }
    setError('');
    onContinue();
  };

  return (
    <PlannerPage>
      <ScreenTitle title="Land Details" step="Step 1 of 2" onBack={onBack} />
      <Card>
        <SectionTitle>Selected Location</SectionTitle>
        <Text style={styles.location}>{location.address}</Text>
        <Text style={styles.coordinates}>
          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </Text>
      </Card>

      <Card>
        <SectionTitle>Land information</SectionTitle>
        <Text style={styles.label}>Measurement unit</Text>
        <ChoiceRow
          options={[
            { label: 'Metres', value: 'm' },
            { label: 'Feet', value: 'ft' },
          ]}
          value={value.unit}
          onChange={(unit) => onChange({ ...value, unit })}
        />
        <View style={styles.dimensions}>
          <View style={styles.dimension}>
            <Text style={styles.label}>Length ({value.unit})</Text>
            <PlannerInput
              value={value.length}
              onChangeText={(length) => onChange({ ...value, length })}
              keyboardType="decimal-pad"
              placeholder={value.unit === 'm' ? 'e.g. 20' : 'e.g. 65'}
            />
          </View>
          <View style={styles.dimension}>
            <Text style={styles.label}>Width ({value.unit})</Text>
            <PlannerInput
              value={value.width}
              onChangeText={(width) => onChange({ ...value, width })}
              keyboardType="decimal-pad"
              placeholder={value.unit === 'm' ? 'e.g. 15' : 'e.g. 49'}
            />
          </View>
        </View>
        {Number.isFinite(area) && area > 0 ? (
          <View style={styles.areaPanel}>
            <Text style={styles.areaText}>
              {area.toFixed(1)} sqm · {perch.toFixed(2)} perch
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Land shape</Text>
        <ChoiceRow
          options={LAND_SHAPES.map((shape) => ({ label: shape, value: shape }))}
          value={value.shape}
          onChange={(shape) => onChange({ ...value, shape })}
        />

        <Text style={styles.label}>Road type</Text>
        <ChoiceRow
          options={ROAD_TYPES.map((road) => ({
            label: `${road.label} (${road.width} m)`,
            value: road.label,
          }))}
          value={value.roadLabel}
          onChange={(label) => updateRoad(label)}
        />

      </Card>

      {value.shape === 'Corner Plot' ? (
        <Card>
          <SectionTitle>Second road</SectionTitle>
          <Text style={styles.coordinates}>
            Stand on the main road and face your land. Where is the second road?
          </Text>
          <ChoiceRow
            options={[
              { label: 'Left side', value: 'left' },
              { label: 'Right side', value: 'right' },
              { label: 'Back side', value: 'top' },
            ]}
            value={value.extraRoadSide}
            onChange={(extraRoadSide) => onChange({ ...value, extraRoadSide })}
          />
          <Text style={styles.label}>Second road type</Text>
          <ChoiceRow
            options={ROAD_TYPES.map((road) => ({
              label: `${road.label} (${road.width} m)`,
              value: road.label,
            }))}
            value={value.extraRoadLabel}
            onChange={(label) => updateRoad(label, true)}
          />
        </Card>
      ) : null}

      {error ? <InlineMessage>{error}</InlineMessage> : null}
      <ActionButton title="Continue to Room Setup" onPress={continueToRooms} />
    </PlannerPage>
  );
}

const styles = StyleSheet.create({
  location: { color: plannerColors.text, fontSize: 14, lineHeight: 20 },
  coordinates: { color: plannerColors.muted, fontSize: 12, lineHeight: 18 },
  label: { color: plannerColors.navy, fontSize: 13, fontWeight: '700' },
  dimensions: { flexDirection: 'row', gap: 10 },
  dimension: { flex: 1, gap: 7 },
  areaPanel: {
    backgroundColor: '#EBF5FB',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  areaText: { color: plannerColors.navy, fontSize: 15, fontWeight: '800' },
});
