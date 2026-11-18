import {
  METRES_PER_FOOT,
  SQUARE_METRES_PER_PERCH,
} from '@/constants/architecture';
import type {
  ExtraRoad,
  LandShape,
  LayoutMode,
  PredictRequest,
  Rooms,
  BuildingPurpose,
} from '@/types/api';
import {
  normalizeFloorOverrides,
  RequestValidationError,
  validatePredictRequest,
} from '@/utils/validation';

export type MeasurementInput = number | string;

export interface PredictDraft {
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  land: {
    length: MeasurementInput;
    width: MeasurementInput;
    frontage?: MeasurementInput | null;
    unit: 'm' | 'ft';
    shape: LandShape;
    roadWidth: MeasurementInput;
    roadLabel: string;
    extraRoads?: ExtraRoad[];
  };
  building: {
    purpose: BuildingPurpose;
    floors: number;
    layoutMode: LayoutMode;
    rooms: Rooms;
    notes?: string;
    parkingSpaces?: number;
  };
}

function toNumber(value: MeasurementInput, field: string): number {
  const number = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(number)) {
    throw new RequestValidationError([
      { field, message: 'Must be a finite number.' },
    ]);
  }
  return number;
}

function toMetres(value: MeasurementInput, unit: 'm' | 'ft', field: string): number {
  const number = toNumber(value, field);
  return unit === 'ft' ? number * METRES_PER_FOOT : number;
}

function normalizeRooms(rooms: Rooms): Rooms {
  if (rooms.type !== 'standardWithOverrides') {
    return rooms;
  }
  return {
    ...rooms,
    overrides: normalizeFloorOverrides(rooms.overrides),
  };
}

export function buildPredictPayload(draft: PredictDraft): PredictRequest {
  const landLength = toMetres(draft.land.length, draft.land.unit, 'landLength');
  const landWidth = toMetres(draft.land.width, draft.land.unit, 'landWidth');
  const frontageInput = draft.land.frontage;
  const roadFrontage =
    frontageInput === undefined ||
    frontageInput === null ||
    (typeof frontageInput === 'string' && frontageInput.trim() === '')
      ? null
      : toMetres(frontageInput, draft.land.unit, 'roadFrontage');
  const landAreaSqm = landLength * landWidth;

  const request: PredictRequest = {
    lat: draft.location.lat,
    lng: draft.location.lng,
    address: draft.location.address,
    landLength,
    landWidth,
    roadFrontage,
    extraRoads: draft.land.extraRoads ?? [],
    landAreaSqm,
    landAreaPerch: landAreaSqm / SQUARE_METRES_PER_PERCH,
    landShape: draft.land.shape,
    roadWidth: toNumber(draft.land.roadWidth, 'roadWidth'),
    roadLabel: draft.land.roadLabel,
    purpose: draft.building.purpose,
    floors: draft.building.floors,
    layoutMode: draft.building.layoutMode,
    rooms: normalizeRooms(draft.building.rooms),
    notes: draft.building.notes?.trim() ?? '',
    parkingSpaces: draft.building.parkingSpaces ?? 0,
  };

  const issues = validatePredictRequest(request);
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }
  return request;
}
