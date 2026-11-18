export interface GeocodedAddress {
  lat: number;
  lng: number;
  displayName: string;
}

export function geocodeAddress(address: string): Promise<GeocodedAddress>;
export function reverseGeocode(lat: number, lng: number): Promise<string>;
