import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import type { BuildingDraft } from '../src/features/planner/types';
import PlannerFlow from '../src/features/planner/PlannerFlow';

jest.mock('../src/features/planner/LocationScreen', () => {
  const { Pressable, Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    LocationScreen: ({ onConfirmed }: { onConfirmed: (location: unknown) => void }) => (
      <Pressable
        onPress={() =>
          onConfirmed({
            lat: 9.66,
            lng: 80.02,
            address: 'Chunnakam, Jaffna, Sri Lanka',
          })
        }>
        <Text>Confirm mock location</Text>
      </Pressable>
    ),
  };
});

jest.mock('../src/features/planner/LandDetailsScreen', () => {
  const { Pressable, Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    LandDetailsScreen: ({ onContinue }: { onContinue: () => void }) => (
      <Pressable onPress={onContinue}>
        <Text>Continue mock land</Text>
      </Pressable>
    ),
  };
});

jest.mock('../src/features/planner/RoomSetupScreen', () => {
  const { Fragment } = jest.requireActual('react') as typeof import('react');
  const { Pressable, Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
  RoomSetupScreen: ({
    value,
    onChange,
    onBack,
  }: {
    value: BuildingDraft;
    onChange: (value: BuildingDraft) => void;
    onBack: () => void;
  }) => (
    <Fragment>
      <Text>Bedrooms: {value.standardRooms.bedrooms}</Text>
      <Pressable
        onPress={() =>
          onChange({
            ...value,
            standardRooms: { ...value.standardRooms, bedrooms: 3 },
          })
        }>
        <Text>Set bedrooms</Text>
      </Pressable>
      <Pressable onPress={onBack}>
        <Text>Back to land</Text>
      </Pressable>
    </Fragment>
  ),
  };
});

jest.mock('../src/features/planner/ResultsScreen', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return { ResultsScreen: () => <Text>Mock results</Text> };
});

describe('PlannerFlow state retention', () => {
  it('retains user-entered room values when navigating Back and Forward', async () => {
    await render(<PlannerFlow />);
    await fireEvent.press(screen.getByText('Confirm mock location'));
    await fireEvent.press(screen.getByText('Continue mock land'));
    expect(screen.getByText('Bedrooms: 0')).toBeTruthy();

    await fireEvent.press(screen.getByText('Set bedrooms'));
    expect(screen.getByText('Bedrooms: 3')).toBeTruthy();
    await fireEvent.press(screen.getByText('Back to land'));
    await fireEvent.press(screen.getByText('Continue mock land'));

    expect(screen.getByText('Bedrooms: 3')).toBeTruthy();
  });
});
