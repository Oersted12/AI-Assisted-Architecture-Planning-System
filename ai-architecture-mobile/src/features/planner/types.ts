import type {
  BuildingPurpose,
  ExtraRoadSide,
  LandShape,
  RoomConfig,
} from '@/types/api';

export interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface RecentLocation extends SelectedLocation {
  savedAt: string;
}

export interface LandDraft {
  length: string;
  width: string;
  frontage: string;
  unit: 'm' | 'ft';
  shape: LandShape;
  roadWidth: number;
  roadLabel: string;
  extraRoadSide: ExtraRoadSide;
  extraRoadWidth: number;
  extraRoadLabel: string;
}

export interface BuildingDraft {
  purpose: BuildingPurpose;
  floors: number;
  layoutMode: 'same' | 'almost' | 'custom';
  standardRooms: RoomConfig;
  floorOverrides: Record<string, RoomConfig>;
  perFloorRooms: RoomConfig[];
  notes: string;
}

export const DEFAULT_ROOMS: RoomConfig = {
  bedrooms: 0,
  bathrooms: 0,
  kitchens: 0,
  visitorHalls: 0,
  extraRooms: 0,
  extraRoomNote: '',
};

export const DEFAULT_LAND: LandDraft = {
  length: '',
  width: '',
  frontage: '',
  unit: 'm',
  shape: 'Rectangular',
  roadWidth: 6,
  roadLabel: 'Local Road',
  extraRoadSide: 'left',
  extraRoadWidth: 6,
  extraRoadLabel: 'Local Road',
};

export const DEFAULT_BUILDING: BuildingDraft = {
  purpose: 'House',
  floors: 1,
  layoutMode: 'same',
  standardRooms: { ...DEFAULT_ROOMS },
  floorOverrides: {},
  perFloorRooms: [{ ...DEFAULT_ROOMS }],
  notes: '',
};

export function copyRooms(rooms: RoomConfig): RoomConfig {
  return { ...rooms, roomTweaks: rooms.roomTweaks ? { ...rooms.roomTweaks } : undefined };
}
