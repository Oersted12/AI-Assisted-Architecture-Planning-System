import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BUILDING_PURPOSES,
  MAX_FLOORS,
  METRES_PER_FOOT,
} from '@/constants/architecture';
import {
  ActionButton,
  Card,
  ChoiceRow,
  Counter,
  InlineMessage,
  PlannerInput,
  PlannerPage,
  ScreenTitle,
  SectionTitle,
  plannerColors,
} from '@/features/planner/components';
import {
  copyRooms,
  DEFAULT_ROOMS,
} from '@/features/planner/types';
import type { BuildingDraft, LandDraft } from '@/features/planner/types';
import type { RoomConfig } from '@/types/api';

const LAYOUT_OPTIONS = [
  { label: 'Same on all floors', value: 'same' },
  { label: 'Some floors differ', value: 'almost' },
  { label: 'Custom per floor', value: 'custom' },
] as const;

export function RoomSetupScreen({
  value,
  onChange,
  land,
  onLandChange,
  onBack,
  onSubmit,
  loading,
  error,
}: {
  value: BuildingDraft;
  onChange: (value: BuildingDraft) => void;
  land: LandDraft;
  onLandChange: (value: LandDraft) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
}) {
  const [localError, setLocalError] = useState('');
  const [frontageError, setFrontageError] = useState('');

  const changeFloorCount = (floors: number) => {
    const perFloorRooms = [...value.perFloorRooms];
    if (floors > perFloorRooms.length) {
      for (let index = perFloorRooms.length; index < floors; index += 1) {
        perFloorRooms.push(copyRooms(DEFAULT_ROOMS));
      }
    } else {
      perFloorRooms.length = floors;
    }

    const floorOverrides = Object.fromEntries(
      Object.entries(value.floorOverrides).filter(([floor]) => Number(floor) <= floors),
    );
    onChange({ ...value, floors, perFloorRooms, floorOverrides });
  };

  const toggleOverride = (floor: number) => {
    const key = String(floor);
    const floorOverrides = { ...value.floorOverrides };
    if (floorOverrides[key]) {
      delete floorOverrides[key];
    } else {
      floorOverrides[key] = copyRooms(value.standardRooms);
    }
    onChange({ ...value, floorOverrides });
  };

  const updateFloorOverride = (floor: number, rooms: RoomConfig) => {
    onChange({
      ...value,
      floorOverrides: { ...value.floorOverrides, [String(floor)]: rooms },
    });
  };

  const updatePerFloor = (index: number, rooms: RoomConfig) => {
    const perFloorRooms = [...value.perFloorRooms];
    perFloorRooms[index] = rooms;
    onChange({ ...value, perFloorRooms });
  };

  const applyStandardToAll = () => {
    onChange({
      ...value,
      perFloorRooms: Array.from({ length: value.floors }, () =>
        copyRooms(value.standardRooms),
      ),
    });
  };

  const submit = () => {
    if (
      value.layoutMode === 'custom' &&
      value.floors > 1 &&
      value.perFloorRooms.length !== value.floors
    ) {
      setLocalError('Set a room configuration for every floor.');
      return;
    }
    setLocalError('');
    const frontageInput = land.frontage.trim();
    if (frontageInput) {
      const frontage = Number(frontageInput);
      const frontageMetres =
        land.unit === 'ft' ? frontage * METRES_PER_FOOT : frontage;
      const length = Number(land.length);
      const width = Number(land.width);
      const lengthMetres =
        land.unit === 'ft' ? length * METRES_PER_FOOT : length;
      const widthMetres =
        land.unit === 'ft' ? width * METRES_PER_FOOT : width;

      if (!Number.isFinite(frontageMetres) || frontageMetres <= 0) {
        setFrontageError('Frontage must be more than 0');
        return;
      }
      if (frontageMetres > Math.max(lengthMetres, widthMetres)) {
        setFrontageError(
          "Frontage cannot be longer than the plot's longest side",
        );
        return;
      }
    }
    setFrontageError('');
    onSubmit();
  };

  return (
    <PlannerPage>
      <ScreenTitle title="Room Setup" step="Step 2 of 2" onBack={onBack} />
      <Card>
        <SectionTitle>Building requirements</SectionTitle>
        <Text style={styles.label}>Building purpose</Text>
        <ChoiceRow
          options={BUILDING_PURPOSES.map((purpose) => ({
            label: purpose,
            value: purpose,
          }))}
          value={value.purpose}
          onChange={(purpose) => onChange({ ...value, purpose })}
        />
        <View style={styles.floorRow}>
          <Text style={styles.label}>Number of floors</Text>
          <Counter
            value={value.floors}
            onChange={changeFloorCount}
            minimum={1}
            maximum={MAX_FLOORS}
          />
        </View>
        {value.floors > 1 ? (
          <>
            <Text style={styles.label}>Room layout</Text>
            <ChoiceRow
              options={LAYOUT_OPTIONS}
              value={value.layoutMode}
              onChange={(layoutMode) => onChange({ ...value, layoutMode })}
            />
          </>
        ) : null}
      </Card>

      {value.floors === 1 || value.layoutMode === 'same' ? (
        <RoomEditor
          label={value.floors === 1 ? 'Ground floor' : 'Standard floor (all floors)'}
          purpose={value.purpose}
          rooms={value.standardRooms}
          onChange={(standardRooms) => onChange({ ...value, standardRooms })}
        />
      ) : null}

      {value.floors > 1 && value.layoutMode === 'almost' ? (
        <>
          <RoomEditor
            label="Standard floor"
            purpose={value.purpose}
            rooms={value.standardRooms}
            onChange={(standardRooms) => onChange({ ...value, standardRooms })}
          />
          <Card>
            <SectionTitle>Floors that differ</SectionTitle>
            <Text style={styles.hint}>Choose each floor that needs a different room setup.</Text>
            <View style={styles.floorChoices}>
              {Array.from({ length: value.floors }, (_, index) => index + 1).map((floor) => {
                const selected = Boolean(value.floorOverrides[String(floor)]);
                return (
                  <Text
                    key={floor}
                    onPress={() => toggleOverride(floor)}
                    accessibilityRole="button"
                    style={[styles.floorChip, selected ? styles.floorChipSelected : null]}
                  >
                    {floor === 1 ? 'Ground' : `Floor ${floor}`}
                  </Text>
                );
              })}
            </View>
          </Card>
          {Object.entries(value.floorOverrides)
            .sort(([left], [right]) => Number(left) - Number(right))
            .map(([floor, rooms]) => (
              <RoomEditor
                key={floor}
                label={Number(floor) === 1 ? 'Ground floor (different)' : `Floor ${floor}`}
                purpose={value.purpose}
                rooms={rooms}
                onChange={(updated) => updateFloorOverride(Number(floor), updated)}
              />
            ))}
        </>
      ) : null}

      {value.floors > 1 && value.layoutMode === 'custom' ? (
        <>
          <Card>
            <SectionTitle>Starting template</SectionTitle>
            <RoomEditor
              label="Standard floor template"
              purpose={value.purpose}
              rooms={value.standardRooms}
              onChange={(standardRooms) => onChange({ ...value, standardRooms })}
            />
            <ActionButton
              title="Apply standard setup to all floors"
              onPress={applyStandardToAll}
              secondary
            />
          </Card>
          {value.perFloorRooms.map((rooms, index) => (
            <RoomEditor
              key={index}
              label={index === 0 ? 'Ground floor' : `Floor ${index + 1}`}
              purpose={value.purpose}
              rooms={rooms}
              onChange={(updated) => updatePerFloor(index, updated)}
            />
          ))}
        </>
      ) : null}

      <Card>
        <SectionTitle>Additional notes (optional)</SectionTitle>
        <Text style={styles.hint}>
          These notes are used for the written explanation, not the ML prediction.
        </Text>
        <PlannerInput
          value={value.notes}
          onChangeText={(notes) => onChange({ ...value, notes })}
          placeholder="e.g. Rooftop floor has a terrace garden and a small gym"
          multiline
        />
        <Text style={styles.label}>{`Road Frontage (${land.unit}) - optional`}</Text>
        <Text style={styles.hint}>
          Length of the plot side that touches the road. Leave empty if unsure.
        </Text>
        <PlannerInput
          value={land.frontage}
          onChangeText={(frontage) => {
            onLandChange({ ...land, frontage });
            setFrontageError('');
          }}
          keyboardType="decimal-pad"
          placeholder={land.unit === 'm' ? 'e.g. 12' : 'e.g. 40'}
        />
        {frontageError ? <InlineMessage>{frontageError}</InlineMessage> : null}
      </Card>

      {localError ? <InlineMessage>{localError}</InlineMessage> : null}
      {error ? <InlineMessage>{error}</InlineMessage> : null}
      <ActionButton
        title="Generate My Building Plan"
        onPress={submit}
        loading={loading}
      />
      <Text style={styles.disclaimer}>
        AI-generated concept plan only. A licensed architect must certify final
        construction drawings.
      </Text>
    </PlannerPage>
  );
}

function RoomEditor({
  label,
  purpose,
  rooms,
  onChange,
}: {
  label: string;
  purpose: BuildingDraft['purpose'];
  rooms: RoomConfig;
  onChange: (rooms: RoomConfig) => void;
}) {
  const isResidential = ['House', 'Apartment', 'Hotel'].includes(purpose);
  const changeCount = (field: keyof RoomConfig, count: number) => {
    onChange({ ...rooms, [field]: count });
  };

  return (
    <Card>
      <SectionTitle>{label}</SectionTitle>
      {isResidential ? (
        <RoomCounter
          label="Bedrooms"
          value={rooms.bedrooms}
          onChange={(count) => changeCount('bedrooms', count)}
        />
      ) : null}
      <RoomCounter
        label="Bathrooms"
        value={rooms.bathrooms}
        onChange={(count) => changeCount('bathrooms', count)}
      />
      {isResidential ? (
        <RoomCounter
          label="Kitchens"
          value={rooms.kitchens}
          onChange={(count) => changeCount('kitchens', count)}
        />
      ) : null}
      <RoomCounter
        label="Visitor halls"
        value={rooms.visitorHalls}
        onChange={(count) => changeCount('visitorHalls', count)}
      />
      <RoomCounter
        label="Extra rooms"
        value={rooms.extraRooms}
        onChange={(count) => changeCount('extraRooms', count)}
      />
      {rooms.extraRooms > 0 ? (
        <PlannerInput
          value={rooms.extraRoomNote}
          onChangeText={(extraRoomNote) => onChange({ ...rooms, extraRoomNote })}
          placeholder="Describe the extra rooms (optional)"
        />
      ) : null}
    </Card>
  );
}

function RoomCounter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.roomCounter}>
      <Text style={styles.roomLabel}>{label}</Text>
      <Counter value={value} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: plannerColors.navy, fontSize: 14, fontWeight: '700' },
  hint: { color: plannerColors.muted, fontSize: 12, lineHeight: 18 },
  floorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  floorChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  floorChip: {
    overflow: 'hidden',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: plannerColors.navy,
    backgroundColor: '#F4F6F9',
    fontSize: 13,
    fontWeight: '700',
  },
  floorChipSelected: { color: '#FFFFFF', backgroundColor: plannerColors.gold },
  roomCounter: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roomLabel: { color: plannerColors.navy, fontSize: 14, fontWeight: '600' },
  disclaimer: {
    textAlign: 'center',
    color: plannerColors.muted,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 10,
  },
});
