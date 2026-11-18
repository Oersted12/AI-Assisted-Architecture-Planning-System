export type LandShape =
  | 'Rectangular'
  | 'Square'
  | 'L-Shape'
  | 'Corner Plot'
  | 'Irregular';

export type BuildingPurpose =
  | 'House'
  | 'Apartment'
  | 'Office'
  | 'Shop'
  | 'Supermarket'
  | 'Hospital'
  | 'School'
  | 'Hotel'
  | 'Warehouse'
  | 'Mixed-Use';

export type LayoutMode = 'same' | 'almost' | 'custom';
export type ExtraRoadSide = 'left' | 'right' | 'top';

export interface RoomConfig {
  bedrooms: number;
  bathrooms: number;
  kitchens: number;
  visitorHalls: number;
  extraRooms: number;
  extraRoomNote: string;
  roomTweaks?: Record<string, unknown>;
}

export interface RoomsSame {
  type: 'same';
  data: RoomConfig;
}

export interface RoomsStandardWithOverrides {
  type: 'standardWithOverrides';
  standard: RoomConfig;
  overrides: Record<string, RoomConfig>;
}

export interface RoomsPerFloor {
  type: 'perFloor';
  data: RoomConfig[];
}

export type Rooms =
  | RoomsSame
  | RoomsStandardWithOverrides
  | RoomsPerFloor;

export interface ExtraRoad {
  side: ExtraRoadSide;
  width: number;
  label: string;
}

export interface PredictRequest {
  lat: number;
  lng: number;
  address: string;
  landLength: number;
  landWidth: number;
  roadFrontage: number | null;
  extraRoads: ExtraRoad[];
  landAreaSqm: number;
  landAreaPerch: number;
  landShape: LandShape;
  roadWidth: number;
  roadLabel: string;
  purpose: BuildingPurpose;
  floors: number;
  layoutMode: LayoutMode;
  rooms: Rooms;
  notes: string;
  parkingSpaces: number;
}

export interface PredictResponse {
  feasibility: string;
  feas_confidence: number;
  layout_type: string;
  layout_confidence: number;
  structure_type: string;
  struct_confidence: number;
  land_area_sqm: number;
  permissible_fa_sqm: number;
  requested_fa_sqm: number;
  fa_utilisation_ratio: number;
  ground_floor_area_sqm: number;
  blueprints: Record<string, string> | null;
  zone_code: string;
  zone_name: string;
  zone_type: string;
  explanation: string | null;
  per_floor_breakdown: RoomConfig[] | null;
  area_matched: boolean;
  rule_blockers: string[];
  rule_warnings: string[];
  rule_suggestions: string[];
  area_name: string;
}

export interface CheckLocationResponse {
  ok: true;
  zone_name: string;
}

export interface EditBlueprintRequest {
  instruction: string;
  perFloorBreakdown: RoomConfig[];
  purpose: string;
  layout_type: string;
  structure_type: string;
  landLength: number;
  landWidth: number;
  groundFloorAreaSqm: number;
  roadLabel: string;
  variant: number;
  extraDoors: Record<string, unknown>[];
  extraRoads: ExtraRoad[];
}

export type EditBlueprintResponse =
  | {
      applied: false;
      message: string;
    }
  | {
      applied: true;
      variant: number;
      summary: string;
      message: string | null;
      blueprints: Record<string, string>;
      perFloorBreakdown: RoomConfig[];
      extraDoors: Record<string, unknown>[];
    };

export interface DownloadPdfRequest {
  result: PredictResponse;
  inputs: PredictRequest;
}
