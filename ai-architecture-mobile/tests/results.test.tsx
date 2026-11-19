import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { ResultsScreen } from '../src/features/planner/ResultsScreen';
import { editBlueprint } from '../src/services/api';
import { validRequest, validResult, zeroRooms } from './fixtures';

jest.mock('expo-image', () => {
  const { Image } = jest.requireActual('react-native') as typeof import('react-native');
  return { Image };
});

jest.mock('../src/services/api', () => ({
  blueprintUrl: (path: string) => path,
  editBlueprint: jest.fn(),
}));

jest.mock('../src/services/pdf', () => ({
  savePdfReport: jest.fn(),
  sharePdfReport: jest.fn(),
}));

const editResponse = (variant: number, image: string) => ({
  applied: true as const,
  variant,
  summary: `Variant ${variant} summary`,
  message: `Variant ${variant} generated.`,
  blueprints: { '1': image },
  perFloorBreakdown: [{ ...zeroRooms, bedrooms: variant }],
  extraDoors: [],
});

describe('ResultsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders feasibility, design, area and zone, per-floor breakdown, and explanation', async () => {
    await render(
      <ResultsScreen
        result={{
          ...validResult,
          area_matched: false,
          rule_warnings: ['Confirm the boundary setback.'],
          per_floor_breakdown: [{ ...zeroRooms, bedrooms: 2 }],
          explanation: 'A **good** layout for this plot.',
        }}
        request={validRequest}
        onEditDetails={jest.fn()}
        onNewPlan={jest.fn()}
      />,
    );

    expect(screen.getByText('Feasible')).toBeTruthy();
    expect(screen.getByText('Linear (88%)')).toBeTruthy();
    expect(screen.getByText('Reinforced Concrete (91%)')).toBeTruthy();
    expect(screen.getByText('Medium Density Mixed Development (R2)')).toBeTruthy();
    expect(screen.getByText(/Area not recognized/)).toBeTruthy();
    expect(screen.getByText(/Confirm the boundary setback/)).toBeTruthy();
    expect(screen.getByText('Per-floor breakdown')).toBeTruthy();
    expect(screen.getByText(/Bedrooms 2/)).toBeTruthy();
    expect(screen.getByText(/good/)).toBeTruthy();
  });

  it('shows rule blockers, warnings, suggestions, and area-match state', async () => {
    await render(
      <ResultsScreen
        result={{
          ...validResult,
          feasibility: 'Not Feasible',
          area_matched: false,
          rule_blockers: ['The road is too narrow for this purpose.'],
          rule_warnings: ['Check the parking requirement.'],
          rule_suggestions: ['Use a different building purpose.'],
        }}
        request={validRequest}
        onEditDetails={jest.fn()}
        onNewPlan={jest.fn()}
      />,
    );

    expect(screen.getByText('Not Feasible')).toBeTruthy();
    expect(screen.getByText(/The road is too narrow/)).toBeTruthy();
    expect(screen.getByText('Try this')).toBeTruthy();
    expect(screen.getByText(/Use a different building purpose/)).toBeTruthy();
    expect(screen.getByText(/Check the parking requirement/)).toBeTruthy();
    expect(screen.getByText(/Area not recognized/)).toBeTruthy();
  });

  it('edits blueprint text, creates variants, and applies the next edit to the active variant', async () => {
    (editBlueprint as unknown as Mock<(...args: unknown[]) => Promise<unknown>>)
      .mockResolvedValueOnce(editResponse(1, '/blueprints/variant-1.png'))
      .mockResolvedValueOnce(editResponse(2, '/blueprints/variant-2.png'));
    await render(
      <ResultsScreen
        result={validResult}
        request={{
          ...validRequest,
          floors: 2,
          layoutMode: 'custom',
          rooms: { type: 'perFloor', data: [zeroRooms, zeroRooms] },
        }}
        onEditDetails={jest.fn()}
        onNewPlan={jest.fn()}
      />,
    );

    await fireEvent.changeText(
      screen.getByPlaceholderText('e.g. Make the kitchen square and add a door on the south wall'),
      'Add a door to the kitchen',
    );
    await fireEvent.press(screen.getByText('Regenerate blueprint'));
    await waitFor(() => expect(screen.getByText('Version 2 of 2')).toBeTruthy());
    expect(editBlueprint).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        instruction: 'Add a door to the kitchen',
        variant: 0,
      }),
    );
    expect(screen.getByText(/Variant 1 summary/)).toBeTruthy();

    await fireEvent.changeText(
      screen.getByPlaceholderText('e.g. Make the kitchen square and add a door on the south wall'),
      'Move that door',
    );
    await fireEvent.press(screen.getByText('Regenerate blueprint'));
    await waitFor(() => expect(screen.getByText('Version 3 of 3')).toBeTruthy());
    expect(editBlueprint).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        instruction: 'Move that door',
        variant: 1,
      }),
    );

    await fireEvent.press(screen.getByText('Previous plan'));
    expect(screen.getByText('Version 2 of 3')).toBeTruthy();
    expect(screen.getByText('Edit 1: Variant 1 summary')).toBeTruthy();
  });
});
