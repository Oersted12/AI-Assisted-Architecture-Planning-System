import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import type { PredictRequest } from '../src/types/api';
import { validRequest } from './fixtures';

type AxiosInstanceMock = {
  get: Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
  post: Mock<(...args: unknown[]) => Promise<{ data: unknown }>>;
};

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    isAxiosError: jest.fn((error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error &&
      error.isAxiosError === true,
    ),
  },
}));

function loadApi(baseUrl = 'https://api.example.test') {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({
    expoConfig: { extra: { API_BASE_URL: baseUrl } },
  }));
  const axios = require('axios').default as AxiosInstanceMock;
  const api = require('../src/services/api') as typeof import('../src/services/api');
  return { api, axios };
}

function axiosError(status?: number, data?: unknown): Error {
  return Object.assign(new Error('request failed'), {
    isAxiosError: true,
    response: status === undefined ? undefined : { status, data },
  });
}

describe('API service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles a successful location check', async () => {
    const { api, axios } = loadApi();
    axios.get.mockResolvedValue({ data: { ok: true, zone_name: 'Residential' } });

    await expect(api.checkLocation(9.66, 80.02)).resolves.toEqual({
      ok: true,
      zone_name: 'Residential',
    });
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.example.test/check-location',
      { params: { lat: 9.66, lng: 80.02 } },
    );
  });

  it.each([
    'This location is outside Jaffna District.',
    'This point is on a water body.',
  ])('shows the server location error: %s', async (detail) => {
    const { api, axios } = loadApi();
    axios.get.mockRejectedValue(axiosError(400, { detail }));

    await expect(api.checkLocation(9.66, 80.02)).rejects.toThrow(detail);
  });

  it('formats a readable 422 validation message', async () => {
    const { api, axios } = loadApi();
    axios.post.mockRejectedValue(
      axiosError(422, {
        detail: [
          { loc: ['body', 'landLength'], msg: 'Input should be greater than 0' },
          { loc: ['body', 'roadWidth'], msg: 'Input should be greater than 0' },
        ],
      }),
    );

    await expect(api.predictPlan(validRequest)).rejects.toThrow(
      'Invalid data - landLength: Input should be greater than 0; roadWidth: Input should be greater than 0',
    );
  });

  it('reports a readable 500 server error', async () => {
    const { api, axios } = loadApi();
    axios.post.mockRejectedValue(axiosError(500, {}));

    await expect(api.predictPlan(validRequest)).rejects.toThrow('Server error (500).');
  });

  it.each(['network failure', 'timeout'])('reports %s without a response', async (kind) => {
    const { api, axios } = loadApi();
    axios.post.mockRejectedValue(
      Object.assign(axiosError(), { code: kind === 'timeout' ? 'ECONNABORTED' : 'ENETUNREACH' }),
    );

    await expect(api.predictPlan(validRequest)).rejects.toThrow(
      'Cannot reach the backend.',
    );
  });

  it('handles successful prediction, edit, and PDF calls', async () => {
    const { api, axios } = loadApi();
    const predictResponse = { feasibility: 'Feasible' };
    const editResponse = { applied: false, message: 'No changes were applied.' };
    const pdf = new Uint8Array([37, 80, 68, 70, 45, 49]).buffer;
    axios.post
      .mockResolvedValueOnce({ data: predictResponse })
      .mockResolvedValueOnce({ data: editResponse })
      .mockResolvedValueOnce({ data: pdf });

    await expect(api.predictPlan(validRequest)).resolves.toEqual(predictResponse);
    await expect(
      api.editBlueprint({
        instruction: 'Add a door',
        perFloorBreakdown: [validRequest.rooms.type === 'same' ? validRequest.rooms.data : {
          bedrooms: 0,
          bathrooms: 0,
          kitchens: 0,
          visitorHalls: 0,
          extraRooms: 0,
          extraRoomNote: '',
        }],
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
      }),
    ).resolves.toEqual(editResponse);
    await expect(
      api.downloadPdf({ result: {} as never, inputs: validRequest as PredictRequest }),
    ).resolves.toEqual(pdf);
  });

  it('fails clearly when API_BASE_URL is missing and does not issue a localhost request', async () => {
    const { api, axios } = loadApi('');

    await expect(api.checkLocation(9.66, 80.02)).rejects.toThrow(
      'API_BASE_URL is not configured.',
    );
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(() => api.blueprintUrl('/blueprints/floor.png')).toThrow(
      'API_BASE_URL is not configured.',
    );
  });
});
