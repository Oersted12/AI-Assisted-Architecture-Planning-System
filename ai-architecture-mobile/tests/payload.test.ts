import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_BUILDING,
  DEFAULT_LAND,
  DEFAULT_ROOMS,
} from '../src/features/planner/types';
import { buildPredictPayload } from '../src/utils/payload';
import type { PredictDraft } from '../src/utils/payload';
import { zeroRooms } from './fixtures';

const draft = (overrides: Partial<PredictDraft> = {}): PredictDraft => {
  const base: PredictDraft = {
    location: {
    lat: 9.66,
    lng: 80.02,
    address: 'Chunnakam, Jaffna, Sri Lanka',
    },
    land: {
      ...DEFAULT_LAND,
      length: '20',
      width: '15',
      roadWidth: 6,
      roadLabel: 'Local Road',
      extraRoads: [],
    },
    building: {
      purpose: DEFAULT_BUILDING.purpose,
      floors: DEFAULT_BUILDING.floors,
      layoutMode: DEFAULT_BUILDING.layoutMode,
      rooms: { type: 'same', data: { ...zeroRooms } },
      notes: DEFAULT_BUILDING.notes,
    },
  };
  return {
    ...base,
    ...overrides,
    location: { ...base.location, ...overrides.location },
    land: { ...base.land, ...overrides.land },
    building: { ...base.building, ...overrides.building },
  };
};

describe('buildPredictPayload', () => {
  it('builds a same-floor room payload and retains zero-count defaults', () => {
    const payload = buildPredictPayload(draft());
    expect(payload.floors).toBe(1);
    expect(payload.rooms).toEqual({ type: 'same', data: zeroRooms });
    expect(DEFAULT_ROOMS).toEqual(zeroRooms);
    expect(DEFAULT_BUILDING.floors).toBe(1);
  });

  it('builds standard-with-overrides and normalizes its floor keys', () => {
    const payload = buildPredictPayload(
      draft({
        building: {
          purpose: DEFAULT_BUILDING.purpose,
          floors: 2,
          layoutMode: 'almost',
          rooms: {
            type: 'standardWithOverrides',
            standard: { ...zeroRooms },
            overrides: { '02': { ...zeroRooms, bedrooms: 2 } },
          },
          notes: '',
        },
      }),
    );
    expect(payload.rooms).toEqual({
      type: 'standardWithOverrides',
      standard: zeroRooms,
      overrides: { '2': { ...zeroRooms, bedrooms: 2 } },
    });
  });

  it('builds per-floor room data in floor order', () => {
    const perFloorRooms = [
      { ...zeroRooms, bedrooms: 1 },
      { ...zeroRooms, bedrooms: 3 },
    ];
    const payload = buildPredictPayload(
      draft({
        building: {
          purpose: DEFAULT_BUILDING.purpose,
          floors: 2,
          layoutMode: 'custom',
          rooms: { type: 'perFloor', data: perFloorRooms },
          notes: '',
        },
      }),
    );
    expect(payload.rooms).toEqual({ type: 'perFloor', data: perFloorRooms });
  });

  it('converts feet to metres and calculates square metres and perches', () => {
    const payload = buildPredictPayload(
      draft({
        land: {
          ...DEFAULT_LAND,
          length: '65.6167979',
          width: '49.2125984',
          unit: 'ft',
          roadWidth: 6,
          roadLabel: 'Local Road',
        },
      }),
    );
    expect(payload.landLength).toBeCloseTo(20, 5);
    expect(payload.landWidth).toBeCloseTo(15, 5);
    expect(payload.landAreaSqm).toBeCloseTo(300, 4);
    expect(payload.landAreaPerch).toBeCloseTo(300 / 25.29, 4);
  });

  it('leaves optional frontage null when blank and converts supplied frontage', () => {
    expect(buildPredictPayload(draft()).roadFrontage).toBeNull();
    const payload = buildPredictPayload(
      draft({
        land: {
          ...DEFAULT_LAND,
          length: '65.6167979',
          width: '49.2125984',
          frontage: '40',
          unit: 'ft',
          roadWidth: 6,
          roadLabel: 'Local Road',
        },
      }),
    );
    expect(payload.roadFrontage).toBeCloseTo(12.192);
  });

  it.each(['left', 'right', 'top'] as const)(
    'sends corner plot extra road on %s side',
    (side) => {
      const payload = buildPredictPayload(
        draft({
          land: {
            ...DEFAULT_LAND,
            length: '20',
            width: '15',
            shape: 'Corner Plot',
            extraRoads: [{ side, width: 9, label: 'Main Road (B-Road)' }],
          },
        }),
      );
      expect(payload.extraRoads).toEqual([
        { side, width: 9, label: 'Main Road (B-Road)' },
      ]);
    },
  );

  it('does not send an extra road for a non-corner plot', () => {
    expect(buildPredictPayload(draft()).extraRoads).toEqual([]);
  });

  it('rejects a placeholder address before constructing a request', () => {
    expect(() =>
      buildPredictPayload(
        draft({
          location: { lat: 9.66, lng: 80.02, address: 'Fetching address...' },
        }),
      ),
    ).toThrow(/address/i);
  });

  it('rejects blank or invalid land dimensions, road width, and supplied frontage', () => {
    for (const value of ['', '0', '-1', 'Infinity']) {
      expect(() =>
        buildPredictPayload(
          draft({ land: { ...DEFAULT_LAND, length: value, width: '15', roadWidth: 6 } }),
        ),
      ).toThrow();
      expect(() =>
        buildPredictPayload(
          draft({ land: { ...DEFAULT_LAND, length: '20', width: value, roadWidth: 6 } }),
        ),
      ).toThrow();
      expect(() =>
        buildPredictPayload(
          draft({ land: { ...DEFAULT_LAND, length: '20', width: '15', roadWidth: value } }),
        ),
      ).toThrow();
    }
    for (const frontage of ['0', '-1', 'NaN', 'Infinity']) {
      expect(() =>
        buildPredictPayload(
          draft({
            land: {
              ...DEFAULT_LAND,
              length: '20',
              width: '15',
              roadWidth: 6,
              frontage,
            },
          }),
        ),
      ).toThrow();
    }
  });
});
