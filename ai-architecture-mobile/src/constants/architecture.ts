import type {
  BuildingPurpose,
  ExtraRoadSide,
  LandShape,
} from '@/types/api';

export const METRES_PER_FOOT = 0.3048;
export const SQUARE_METRES_PER_PERCH = 25.29;
export const MIN_LAND_AREA_SQM = 50;
export const MAX_FLOORS = 15;
export const MAX_ROOM_COUNT = 20;
export const MAX_RECENT_LOCATIONS = 5;
export const MAX_EDIT_INSTRUCTION_LENGTH = 500;

export const LAND_SHAPES: readonly LandShape[] = [
  'Rectangular',
  'Square',
  'L-Shape',
  'Corner Plot',
  'Irregular',
];

export const BUILDING_PURPOSES: readonly BuildingPurpose[] = [
  'House',
  'Apartment',
  'Office',
  'Shop',
  'Supermarket',
  'Hospital',
  'School',
  'Hotel',
  'Warehouse',
  'Mixed-Use',
];

export const ROAD_TYPES = [
  { label: 'Highway (A-Road)', width: 12 },
  { label: 'Main Road (B-Road)', width: 9 },
  { label: 'Local Road', width: 6 },
  { label: 'Lane / Small Road', width: 3 },
] as const;

export const EXTRA_ROAD_SIDES: readonly ExtraRoadSide[] = [
  'left',
  'right',
  'top',
];

export const JAFFNA_CENTER = { lat: 9.6615, lng: 80.0255 } as const;

export const JAFFNA_BOUNDS = {
  minLat: 9,
  maxLat: 10,
  minLng: 79.5,
  maxLng: 80.5,
} as const;
