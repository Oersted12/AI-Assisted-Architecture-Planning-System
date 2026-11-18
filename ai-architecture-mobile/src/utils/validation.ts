import type {
  EditBlueprintRequest,
  PredictRequest,
  RoomConfig,
  Rooms,
} from '@/types/api';
import {
  MAX_ROOM_COUNT,
  MIN_LAND_AREA_SQM,
} from '@/constants/architecture';

export interface ValidationIssue {
  field: string;
  message: string;
}

export class RequestValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(issues.map(({ field, message }) => `${field}: ${message}`).join('; '));
    this.name = 'RequestValidationError';
    this.issues = issues;
  }
}

const ROOM_COUNTS = [
  'bedrooms',
  'bathrooms',
  'kitchens',
  'visitorHalls',
  'extraRooms',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRoomConfig(
  rooms: RoomConfig,
  field: string,
  issues: ValidationIssue[],
): void {
  for (const key of ROOM_COUNTS) {
    const count = rooms[key];
    if (!Number.isInteger(count) || count < 0 || count > MAX_ROOM_COUNT) {
      issues.push({
        field: `${field}.${key}`,
        message: `Must be a whole number from 0 to ${MAX_ROOM_COUNT}.`,
      });
    }
  }

  if (typeof rooms.extraRoomNote !== 'string') {
    issues.push({
      field: `${field}.extraRoomNote`,
      message: 'Must be text.',
    });
  }

  if (rooms.roomTweaks !== undefined && !isRecord(rooms.roomTweaks)) {
    issues.push({
      field: `${field}.roomTweaks`,
      message: 'Must be an object.',
    });
  }
}

export function normalizeFloorOverrides(
  overrides: Record<string, RoomConfig>,
): Record<string, RoomConfig> {
  if (!isRecord(overrides)) {
    throw new RequestValidationError([
      { field: 'rooms.overrides', message: 'Must be an object.' },
    ]);
  }

  const normalized: Record<string, RoomConfig> = {};
  for (const [rawKey, rooms] of Object.entries(overrides)) {
    const key = rawKey.trim();
    if (!/^\d+$/.test(key)) {
      throw new RequestValidationError([
        {
          field: `rooms.overrides.${rawKey}`,
          message: 'Floor key must be a positive whole number.',
        },
      ]);
    }

    const floor = Number(key);
    if (!Number.isSafeInteger(floor) || floor < 1) {
      throw new RequestValidationError([
        {
          field: `rooms.overrides.${rawKey}`,
          message: 'Floor key must be a positive whole number.',
        },
      ]);
    }

    const canonicalKey = String(floor);
    if (canonicalKey in normalized) {
      throw new RequestValidationError([
        {
          field: `rooms.overrides.${rawKey}`,
          message: `Duplicates floor ${canonicalKey} after normalization.`,
        },
      ]);
    }
    normalized[canonicalKey] = rooms;
  }
  return normalized;
}

function validateRooms(rooms: Rooms, issues: ValidationIssue[]): void {
  if (rooms.type === 'same') {
    validateRoomConfig(rooms.data, 'rooms.data', issues);
    return;
  }

  if (rooms.type === 'standardWithOverrides') {
    validateRoomConfig(rooms.standard, 'rooms.standard', issues);
    try {
      const normalized = normalizeFloorOverrides(rooms.overrides);
      for (const [floor, roomConfig] of Object.entries(normalized)) {
        validateRoomConfig(roomConfig, `rooms.overrides.${floor}`, issues);
      }
    } catch (error) {
      if (error instanceof RequestValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }
    return;
  }

  if (rooms.type === 'perFloor') {
    rooms.data.forEach((roomConfig, index) =>
      validateRoomConfig(roomConfig, `rooms.data.${index}`, issues),
    );
    return;
  }

  issues.push({ field: 'rooms.type', message: 'Unsupported room configuration.' });
}

export function validatePredictRequest(
  request: PredictRequest,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const finitePositiveFields = [
    'landLength',
    'landWidth',
    'landAreaSqm',
    'landAreaPerch',
    'roadWidth',
  ] as const;

  if (!Number.isFinite(request.lat) || request.lat < -90 || request.lat > 90) {
    issues.push({ field: 'lat', message: 'Must be finite and between -90 and 90.' });
  }
  if (!Number.isFinite(request.lng) || request.lng < -180 || request.lng > 180) {
    issues.push({ field: 'lng', message: 'Must be finite and between -180 and 180.' });
  }
  if (
    typeof request.address !== 'string' ||
    request.address.trim().length === 0 ||
    ['fetching address...', 'could not fetch address', 'unknown location'].includes(
      request.address.trim().toLowerCase(),
    )
  ) {
    issues.push({ field: 'address', message: 'Wait for a real location address before continuing.' });
  }

  for (const field of finitePositiveFields) {
    const value = request[field];
    if (!Number.isFinite(value) || value <= 0) {
      issues.push({ field, message: 'Must be a positive finite number.' });
    }
  }
  if (
    Number.isFinite(request.landAreaSqm) &&
    request.landAreaSqm > 0 &&
    request.landAreaSqm < MIN_LAND_AREA_SQM
  ) {
    issues.push({
      field: 'landAreaSqm',
      message: `Land area seems too small (minimum ~${MIN_LAND_AREA_SQM} sqm).`,
    });
  }

  if (
    request.roadFrontage !== null &&
    (!Number.isFinite(request.roadFrontage) || request.roadFrontage <= 0)
  ) {
    issues.push({
      field: 'roadFrontage',
      message: 'Must be a positive finite number when supplied.',
    });
  }
  if (
    request.roadFrontage !== null &&
    Number.isFinite(request.roadFrontage) &&
    Number.isFinite(request.landLength) &&
    Number.isFinite(request.landWidth) &&
    request.roadFrontage > Math.max(request.landLength, request.landWidth)
  ) {
    issues.push({
      field: 'roadFrontage',
      message: "Frontage cannot be longer than the plot's longest side.",
    });
  }

  if (!Number.isInteger(request.floors) || request.floors < 1 || request.floors > 15) {
    issues.push({ field: 'floors', message: 'Must be a whole number from 1 to 15.' });
  }
  if (!Number.isInteger(request.parkingSpaces) || request.parkingSpaces < 0) {
    issues.push({ field: 'parkingSpaces', message: 'Must be a non-negative whole number.' });
  }
  if (typeof request.roadLabel !== 'string' || request.roadLabel.trim() === '') {
    issues.push({ field: 'roadLabel', message: 'Must not be empty.' });
  }
  if (typeof request.notes !== 'string') {
    issues.push({ field: 'notes', message: 'Must be text.' });
  }

  if (
    request.layoutMode === 'same' && request.rooms.type !== 'same' ||
    request.layoutMode === 'almost' && request.rooms.type !== 'standardWithOverrides' ||
    request.layoutMode === 'custom' && request.rooms.type !== 'perFloor'
  ) {
    issues.push({
      field: 'rooms.type',
      message: 'Must match the selected layout mode.',
    });
  }

  if (request.rooms.type === 'perFloor' && request.rooms.data.length !== request.floors) {
    issues.push({
      field: 'rooms.data',
      message: 'Must contain one room configuration for each floor.',
    });
  }

  request.extraRoads.forEach((road, index) => {
    if (!Number.isFinite(road.width) || road.width <= 0) {
      issues.push({
        field: `extraRoads.${index}.width`,
        message: 'Must be a positive finite number.',
      });
    }
  });
  if (request.extraRoads.length > 3) {
    issues.push({ field: 'extraRoads', message: 'Cannot contain more than three roads.' });
  }

  validateRooms(request.rooms, issues);
  return issues;
}

export function validateEditBlueprintRequest(
  request: EditBlueprintRequest,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isInteger(request.variant) || request.variant < 0) {
    issues.push({ field: 'variant', message: 'Must be a non-negative whole number.' });
  }
  if (!request.instruction.trim()) {
    issues.push({ field: 'instruction', message: 'Enter what you want to change.' });
  }
  if (request.instruction.length > 500) {
    issues.push({
      field: 'instruction',
      message: 'Must be 500 characters or fewer.',
    });
  }
  return issues;
}

export function assertValidPredictRequest(request: PredictRequest): void {
  const issues = validatePredictRequest(request);
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }
}

export function assertValidEditBlueprintRequest(
  request: EditBlueprintRequest,
): void {
  const issues = validateEditBlueprintRequest(request);
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }
}
