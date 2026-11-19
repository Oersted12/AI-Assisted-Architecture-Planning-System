import { useState } from 'react';

import {
  DEFAULT_BUILDING,
  DEFAULT_LAND,
} from '@/features/planner/types';
import type {
  BuildingDraft,
  LandDraft,
  SelectedLocation,
} from '@/features/planner/types';
import { LandDetailsScreen } from '@/features/planner/LandDetailsScreen';
import { LocationScreen } from '@/features/planner/LocationScreen';
import { ResultsScreen } from '@/features/planner/ResultsScreen';
import { RoomSetupScreen } from '@/features/planner/RoomSetupScreen';
import { buildPredictPayload } from '@/utils/payload';
import type {
  PredictRequest,
  PredictResponse,
  Rooms,
} from '@/types/api';
import { predictPlan } from '@/services/api';

type PlannerStep = 'location' | 'land' | 'rooms' | 'results';

export default function PlannerFlow() {
  const [step, setStep] = useState<PlannerStep>('location');
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [land, setLand] = useState<LandDraft>({ ...DEFAULT_LAND });
  const [building, setBuilding] = useState<BuildingDraft>({
    ...DEFAULT_BUILDING,
    standardRooms: { ...DEFAULT_BUILDING.standardRooms },
    perFloorRooms: [{ ...DEFAULT_BUILDING.perFloorRooms[0] }],
  });
  const [request, setRequest] = useState<PredictRequest | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');

  const generatePlan = async () => {
    if (!location) {
      setGenerationError('Confirm a location before generating a plan.');
      return;
    }

    const rooms: Rooms =
      building.floors === 1 || building.layoutMode === 'same'
        ? { type: 'same', data: building.standardRooms }
        : building.layoutMode === 'almost'
          ? {
              type: 'standardWithOverrides',
              standard: building.standardRooms,
              overrides: building.floorOverrides,
            }
          : { type: 'perFloor', data: building.perFloorRooms };

    setGenerating(true);
    setGenerationError('');
    try {
      const payload = buildPredictPayload({
        location,
        land: {
          length: land.length,
          width: land.width,
          frontage: land.frontage,
          unit: land.unit,
          shape: land.shape,
          roadWidth: land.roadWidth,
          roadLabel: land.roadLabel,
          extraRoads:
            land.shape === 'Corner Plot'
              ? [
                  {
                    side: land.extraRoadSide,
                    width: land.extraRoadWidth,
                    label: land.extraRoadLabel,
                  },
                ]
              : [],
        },
        building: {
          purpose: building.purpose,
          floors: building.floors,
          layoutMode: building.floors === 1 ? 'same' : building.layoutMode,
          rooms,
          notes: building.notes,
        },
      });
      const response = await predictPlan(payload);
      setRequest(payload);
      setResult(response);
      setStep('results');
    } catch (cause) {
      setGenerationError(
        cause instanceof Error ? cause.message : 'Could not generate the plan.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const startNewPlan = () => {
    setStep('location');
    setLocation(null);
    setLand({ ...DEFAULT_LAND });
    setBuilding({
      ...DEFAULT_BUILDING,
      standardRooms: { ...DEFAULT_BUILDING.standardRooms },
      perFloorRooms: [{ ...DEFAULT_BUILDING.perFloorRooms[0] }],
    });
    setRequest(null);
    setResult(null);
    setGenerationError('');
  };

  if (step === 'location') {
    return (
      <LocationScreen
        initialLocation={location}
        onContinue={() => setStep('land')}
        onConfirmed={(confirmedLocation) => {
          setLocation(confirmedLocation);
          setStep('land');
        }}
      />
    );
  }

  if (step === 'land' && location) {
    return (
      <LandDetailsScreen
        location={location}
        value={land}
        onChange={setLand}
        onBack={() => setStep('location')}
        onContinue={() => setStep('rooms')}
      />
    );
  }

  if (step === 'rooms') {
    return (
      <RoomSetupScreen
        value={building}
        onChange={setBuilding}
        land={land}
        onLandChange={setLand}
        onBack={() => setStep('land')}
        onSubmit={() => void generatePlan()}
        loading={generating}
        error={generationError}
      />
    );
  }

  if (step === 'results' && result && request) {
    return (
      <ResultsScreen
        result={result}
        request={request}
        onEditDetails={() => setStep('land')}
        onNewPlan={startNewPlan}
      />
    );
  }

  return null;
}
