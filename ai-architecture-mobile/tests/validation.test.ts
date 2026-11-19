import { describe, expect, it } from '@jest/globals';
import {
  normalizeFloorOverrides,
  validateEditBlueprintRequest,
  validatePredictRequest,
} from '../src/utils/validation';
import { validRequest, zeroRooms } from './fixtures';

describe('predict request validation', () => {
  it('accepts zero room counts and rejects negative, fractional, and over-limit counts', () => {
    expect(validatePredictRequest(validRequest)).toEqual([]);
    for (const field of [
      'bedrooms',
      'bathrooms',
      'kitchens',
      'visitorHalls',
      'extraRooms',
    ] as const) {
      for (const badCount of [-1, 0.5, 21]) {
        const request = {
          ...validRequest,
          rooms: {
            type: 'same' as const,
            data: { ...zeroRooms, [field]: badCount },
          },
        };
        expect(
          validatePredictRequest(request).some(
            (issue) => issue.field === `rooms.data.${field}`,
          ),
        ).toBe(true);
      }
    }
  });

  it.each([
    ['landLength', 0],
    ['landLength', -1],
    ['landLength', Number.NaN],
    ['landLength', Number.POSITIVE_INFINITY],
    ['landWidth', 0],
    ['landWidth', -1],
    ['landWidth', Number.NaN],
    ['landWidth', Number.POSITIVE_INFINITY],
    ['landAreaSqm', 0],
    ['landAreaSqm', -1],
    ['landAreaSqm', Number.NaN],
    ['landAreaSqm', Number.POSITIVE_INFINITY],
    ['roadWidth', 0],
    ['roadWidth', -1],
    ['roadWidth', Number.NaN],
    ['roadWidth', Number.POSITIVE_INFINITY],
  ] as const)('rejects invalid %s value %s', (field, value) => {
    expect(
      validatePredictRequest({ ...validRequest, [field]: value }).some(
        (issue) => issue.field === field,
      ),
    ).toBe(true);
  });

  it.each([
    ['lat', -90.01],
    ['lat', 90.01],
    ['lat', Number.NaN],
    ['lat', Number.POSITIVE_INFINITY],
    ['lng', -180.01],
    ['lng', 180.01],
    ['lng', Number.NaN],
    ['lng', Number.POSITIVE_INFINITY],
  ] as const)('rejects out-of-range %s value %s', (field, value) => {
    expect(
      validatePredictRequest({ ...validRequest, [field]: value }).some(
        (issue) => issue.field === field,
      ),
    ).toBe(true);
  });

  it('accepts exact coordinate boundaries', () => {
    for (const lat of [-90, 90]) {
      expect(validatePredictRequest({ ...validRequest, lat })).toEqual([]);
    }
    for (const lng of [-180, 180]) {
      expect(validatePredictRequest({ ...validRequest, lng })).toEqual([]);
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects supplied frontage %s',
    (roadFrontage) => {
      expect(
        validatePredictRequest({ ...validRequest, roadFrontage }).some(
          (issue) => issue.field === 'roadFrontage',
        ),
      ).toBe(true);
    },
  );

  it('accepts empty optional frontage and rejects frontage longer than the plot', () => {
    expect(validatePredictRequest({ ...validRequest, roadFrontage: null })).toEqual([]);
    expect(
      validatePredictRequest({ ...validRequest, roadFrontage: 21 }).some(
        (issue) => issue.field === 'roadFrontage',
      ),
    ).toBe(true);
  });

  it('accepts zero parking spaces and rejects negative, fractional, and non-finite values', () => {
    expect(validatePredictRequest({ ...validRequest, parkingSpaces: 0 })).toEqual([]);
    for (const parkingSpaces of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validatePredictRequest({ ...validRequest, parkingSpaces }).some(
          (issue) => issue.field === 'parkingSpaces',
        ),
      ).toBe(true);
    }
  });

  it('rejects unresolved or empty addresses', () => {
    for (const address of ['', 'Fetching address...', 'Unknown location', 'Could not fetch address']) {
      expect(
        validatePredictRequest({ ...validRequest, address }).some(
          (issue) => issue.field === 'address',
        ),
      ).toBe(true);
    }
  });
});

describe('floor override normalization', () => {
  it('normalizes zero-padded numeric keys', () => {
    expect(normalizeFloorOverrides({ '01': zeroRooms })).toEqual({ '1': zeroRooms });
  });

  it.each(['abc', '0', '-1'])('rejects floor key %s', (key) => {
    expect(() => normalizeFloorOverrides({ [key]: zeroRooms })).toThrow();
  });

  it('rejects duplicate keys after normalization', () => {
    expect(() =>
      normalizeFloorOverrides({ '01': zeroRooms, '1': zeroRooms }),
    ).toThrow('Duplicates floor 1');
  });
});

describe('blueprint edit validation', () => {
  const request = {
    instruction: 'Add a door',
    perFloorBreakdown: [zeroRooms],
    purpose: 'House',
    layout_type: 'Linear',
    structure_type: 'Concrete',
    landLength: 20,
    landWidth: 15,
    groundFloorAreaSqm: 120,
    roadLabel: 'Local Road',
    variant: 0,
    extraDoors: [],
    extraRoads: [],
  };

  it('accepts variant zero and rejects negative or fractional variants', () => {
    expect(validateEditBlueprintRequest(request)).toEqual([]);
    for (const variant of [-1, 0.5]) {
      expect(
        validateEditBlueprintRequest({ ...request, variant }).some(
          (issue) => issue.field === 'variant',
        ),
      ).toBe(true);
    }
  });
});
