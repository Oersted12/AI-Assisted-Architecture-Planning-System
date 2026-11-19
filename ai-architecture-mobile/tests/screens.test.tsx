import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { LandDetailsScreen } from '../src/features/planner/LandDetailsScreen';
import { LocationScreen } from '../src/features/planner/LocationScreen';
import { RoomSetupScreen } from '../src/features/planner/RoomSetupScreen';
import {
  DEFAULT_BUILDING,
  DEFAULT_LAND,
  DEFAULT_ROOMS,
} from '../src/features/planner/types';
import { geocodeAddress, reverseGeocode } from '../services/nominatim';
import { checkLocation } from '../src/services/api';
import type { BuildingDraft, LandDraft, SelectedLocation } from '../src/features/planner/types';
import { zeroRooms } from './fixtures';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-location', () => {
  const { fn } = require('jest-mock') as typeof import('jest-mock');
  return {
    requestForegroundPermissionsAsync: fn(() =>
      Promise.resolve({
        status: 'denied',
        expires: 'never',
        granted: false,
        canAskAgain: false,
      }),
    ),
    getCurrentPositionAsync: fn(),
    Accuracy: { High: 4 },
    PermissionStatus: { DENIED: 'denied' },
  };
});

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(View),
  };
});

jest.mock('../services/nominatim', () => ({
  geocodeAddress: jest.fn(),
  reverseGeocode: jest.fn(),
}));

jest.mock('../src/services/api', () => ({
  checkLocation: jest.fn(),
  blueprintUrl: (path: string) => path,
  editBlueprint: jest.fn(),
}));

const location: SelectedLocation = {
  lat: 9.66,
  lng: 80.02,
  address: 'Chunnakam, Jaffna, Sri Lanka',
};

async function render(...args: Parameters<typeof rtlRender>) {
  return await rtlRender(...args);
}

async function renderLand(value: LandDraft = { ...DEFAULT_LAND }) {
  return await render(
    <LandDetailsScreen
      location={location}
      value={value}
      onChange={jest.fn()}
      onBack={jest.fn()}
      onContinue={jest.fn()}
    />,
  );
}

async function renderRoomSetup(value: BuildingDraft = { ...DEFAULT_BUILDING }) {
  return await render(
    <RoomSetupScreen
      value={value}
      onChange={jest.fn()}
      land={{ ...DEFAULT_LAND, length: '20', width: '15' }}
      onLandChange={jest.fn()}
      onBack={jest.fn()}
      onSubmit={jest.fn()}
      loading={false}
      error=""
    />,
  );
}

describe('LocationScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.mocked(Location.requestForegroundPermissionsAsync).mockImplementation(() =>
      Promise.resolve({
        status: Location.PermissionStatus.DENIED,
        expires: 'never',
        granted: false,
        canAskAgain: false,
      }),
    );
    jest.mocked(geocodeAddress).mockReset();
    jest.mocked(reverseGeocode).mockResolvedValue('Chunnakam, Jaffna, Sri Lanka');
    jest.mocked(checkLocation).mockResolvedValue({ ok: true, zone_name: 'Residential' });
  });

  it('searches and confirms a selected map location', async () => {
    const onConfirmed = jest.fn();
    jest.mocked(geocodeAddress).mockResolvedValue({
      lat: 9.66,
      lng: 80.02,
      displayName: location.address,
    });
    await render(<LocationScreen onConfirmed={onConfirmed} onContinue={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Land address'), 'Chunnakam');
    await fireEvent.press(screen.getByText('Find on Map'));
    await waitFor(() => expect(screen.getByText(location.address)).toBeTruthy());
    await fireEvent.press(screen.getByText('Confirm This Location'));

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith(location));
    expect(checkLocation).toHaveBeenCalledWith(location.lat, location.lng);
  });

  it('shows GPS permission denial and keeps address search available', async () => {
    await render(<LocationScreen onConfirmed={jest.fn()} onContinue={jest.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByText('Location access denied. Please search for an address instead.'),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText('Land address')).toBeTruthy();
  });

  it('shows a clear error when address search returns no result', async () => {
    jest.mocked(geocodeAddress).mockRejectedValue(new Error('Address not found.'));
    await render(<LocationScreen onConfirmed={jest.fn()} onContinue={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Land address'), 'Unknown place');
    await fireEvent.press(screen.getByText('Find on Map'));

    await waitFor(() => expect(screen.getByText('Address not found.')).toBeTruthy());
  });

  it('loads recent history, reopens a saved location, and saves it after confirmation', async () => {
    const saved = {
      ...location,
      savedAt: '2026-01-01T00:00:00.000Z',
    };
    await AsyncStorage.setItem('ai_arch_location_history', JSON.stringify([saved]));
    jest.mocked(geocodeAddress).mockResolvedValue({
      lat: location.lat,
      lng: location.lng,
      displayName: location.address,
    });
    await render(<LocationScreen onConfirmed={jest.fn()} onContinue={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Recent Locations')).toBeTruthy());
    await fireEvent.press(screen.getByText(location.address));
    await waitFor(() => expect(screen.getByText('Confirm This Location')).toBeTruthy());
    await fireEvent.press(screen.getByText('Confirm This Location'));

    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'ai_arch_location_history',
        expect.stringContaining(location.address),
      ),
    );
  });
});

describe('LandDetailsScreen', () => {
  it('switches measurement units and displays all land shapes', async () => {
    const onChange = jest.fn();
    const view = await render(
      <LandDetailsScreen
        location={location}
        value={{ ...DEFAULT_LAND }}
        onChange={onChange}
        onBack={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByText('Feet'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ unit: 'ft' }),
    );
    await view.rerender(
      <LandDetailsScreen
        location={location}
        value={{ ...DEFAULT_LAND, unit: 'ft' }}
        onChange={onChange}
        onBack={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    expect(screen.getByText('Length (ft)')).toBeTruthy();
    for (const shape of ['Rectangular', 'Square', 'L-Shape', 'Corner Plot', 'Irregular']) {
      expect(screen.getByText(shape)).toBeTruthy();
    }
  });

  it('shows second-road fields only for corner plots and updates choices', async () => {
    const onChange = jest.fn();
    await render(
      <LandDetailsScreen
        location={location}
        value={{ ...DEFAULT_LAND, shape: 'Corner Plot' }}
        onChange={onChange}
        onBack={jest.fn()}
        onContinue={jest.fn()}
      />,
    );
    expect(screen.getByText('Second road')).toBeTruthy();
    await fireEvent.press(screen.getByText('Right side'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ extraRoadSide: 'right' }),
    );
    await fireEvent.press(screen.getAllByText('Highway (A-Road) (12 m)')[1]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ extraRoadLabel: 'Highway (A-Road)', extraRoadWidth: 12 }),
    );
  });

  it('shows validation errors and blocks continuing with missing land dimensions', async () => {
    const onContinue = jest.fn();
    await render(
      <LandDetailsScreen
        location={location}
        value={{ ...DEFAULT_LAND, length: '0' }}
        onChange={jest.fn()}
        onBack={jest.fn()}
        onContinue={onContinue}
      />,
    );
    await fireEvent.press(screen.getByText('Continue to Room Setup'));
    expect(
      screen.getByText('Please enter a valid land length greater than 0.'),
    ).toBeTruthy();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('rejects land area below the minimum', async () => {
    await renderLand({ ...DEFAULT_LAND, length: '5', width: '5' });
    await fireEvent.press(screen.getByText('Continue to Room Setup'));
    expect(
      screen.getByText('Land area seems too small (minimum ~50 sqm).'),
    ).toBeTruthy();
  });
});

describe('RoomSetupScreen', () => {
  it('enforces floor limits and gives a new custom floor zero rooms', async () => {
    const onChange = jest.fn();
    await render(
      <RoomSetupScreen
        value={{ ...DEFAULT_BUILDING, floors: 1, perFloorRooms: [{ ...zeroRooms }] }}
        onChange={onChange}
        land={{ ...DEFAULT_LAND, length: '20', width: '15' }}
        onLandChange={jest.fn()}
        onBack={jest.fn()}
        onSubmit={jest.fn()}
        loading={false}
        error=""
      />,
    );
    const increaseButtons = screen.getAllByLabelText('Increase');
    await fireEvent.press(increaseButtons[0]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        floors: 2,
        perFloorRooms: [{ ...zeroRooms }, { ...zeroRooms }],
      }),
    );

    const onChangeAtLimit = jest.fn();
    await render(
      <RoomSetupScreen
        value={{
          ...DEFAULT_BUILDING,
          floors: 15,
          perFloorRooms: Array.from({ length: 15 }, () => ({ ...DEFAULT_ROOMS })),
        }}
        onChange={onChangeAtLimit}
        land={{ ...DEFAULT_LAND, length: '20', width: '15' }}
        onLandChange={jest.fn()}
        onBack={jest.fn()}
        onSubmit={jest.fn()}
        loading={false}
        error=""
      />,
    );
    await fireEvent.press(screen.getAllByLabelText('Increase')[0]);
    expect(onChangeAtLimit).not.toHaveBeenCalled();
  });

  it('shows optional frontage after Additional notes and validates positive finite values', async () => {
    const onSubmit = jest.fn();
    await render(
      <RoomSetupScreen
        value={DEFAULT_BUILDING}
        onChange={jest.fn()}
        land={{ ...DEFAULT_LAND, length: '20', width: '15', frontage: '0' }}
        onLandChange={jest.fn()}
        onBack={jest.fn()}
        onSubmit={onSubmit}
        loading={false}
        error=""
      />,
    );
    expect(screen.getByText('Additional notes (optional)')).toBeTruthy();
    expect(screen.getByText('Road Frontage (m) - optional')).toBeTruthy();
    expect(
      screen.getByText('Length of the plot side that touches the road. Leave empty if unsure.'),
    ).toBeTruthy();
    expect(screen.queryByText('Road frontage (m, optional)')).toBeNull();

    await fireEvent.press(screen.getByText('Generate My Building Plan'));
    expect(screen.getByText('Frontage must be more than 0')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows blank frontage and accepts all-zero rooms', async () => {
    const onSubmit = jest.fn();
    await render(
      <RoomSetupScreen
        value={{ ...DEFAULT_BUILDING, standardRooms: { ...zeroRooms } }}
        onChange={jest.fn()}
        land={{ ...DEFAULT_LAND, length: '20', width: '15', frontage: '' }}
        onLandChange={jest.fn()}
        onBack={jest.fn()}
        onSubmit={onSubmit}
        loading={false}
        error=""
      />,
    );
    await fireEvent.press(screen.getByText('Generate My Building Plan'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
