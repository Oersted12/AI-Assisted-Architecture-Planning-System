import axios from 'axios';
import Constants from 'expo-constants';

import type {
  CheckLocationResponse,
  DownloadPdfRequest,
  EditBlueprintRequest,
  EditBlueprintResponse,
  PredictRequest,
  PredictResponse,
} from '@/types/api';
import {
  assertValidEditBlueprintRequest,
  assertValidPredictRequest,
} from '@/utils/validation';

interface ApiErrorBody {
  detail?: unknown;
}

const configuredBaseUrl: unknown = Constants.expoConfig?.extra?.API_BASE_URL;
const API_BASE_URL =
  typeof configuredBaseUrl === 'string'
    ? configuredBaseUrl.trim().replace(/\/+$/, '')
    : '';

function getApiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      'API_BASE_URL is not configured. Set it in the mobile .env file and restart Expo.',
    );
  }
  return `${API_BASE_URL}${path}`;
}

function errorMessage(error: unknown): Error {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return error instanceof Error ? error : new Error('Unexpected API error.');
  }

  if (!error.response) {
    return new Error(
      'Cannot reach the backend. Check API_BASE_URL and make sure the backend is reachable from this phone.',
    );
  }

  const { status, data } = error.response;
  if (typeof data?.detail === 'string') {
    return new Error(data.detail);
  }
  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    const problems = data.detail.slice(0, 3).map((item: unknown) => {
      if (typeof item !== 'object' || item === null) {
        return 'Invalid request data.';
      }
      const location =
        'loc' in item && Array.isArray(item.loc) ? item.loc : [];
      const field = location
        .filter((part) => part !== 'body')
        .join('.');
      const message =
        'msg' in item && typeof item.msg === 'string' ? item.msg : 'invalid value';
      return `${field || 'request'}: ${message}`;
    });
    return new Error(`Invalid data - ${problems.join('; ')}`);
  }
  return new Error(`Server error (${status}).`);
}

async function request<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw errorMessage(error);
  }
}

export function checkLocation(
  lat: number,
  lng: number,
): Promise<CheckLocationResponse> {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('lat must be finite and between -90 and 90.');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('lng must be finite and between -180 and 180.');
  }

  return request(async () => {
    const response = await axios.get<CheckLocationResponse>(
      getApiUrl('/check-location'),
      { params: { lat, lng } },
    );
    return response.data;
  });
}

export function predictPlan(
  payload: PredictRequest,
): Promise<PredictResponse> {
  assertValidPredictRequest(payload);
  return request(async () => {
    const response = await axios.post<PredictResponse>(
      getApiUrl('/predict'),
      payload,
    );
    return response.data;
  });
}

export function editBlueprint(
  payload: EditBlueprintRequest,
): Promise<EditBlueprintResponse> {
  assertValidEditBlueprintRequest(payload);
  return request(async () => {
    const response = await axios.post<EditBlueprintResponse>(
      getApiUrl('/edit-blueprint'),
      payload,
    );
    return response.data;
  });
}

export function downloadPdf(
  payload: DownloadPdfRequest,
): Promise<ArrayBuffer> {
  return request(async () => {
    const response = await axios.post<ArrayBuffer>(
      getApiUrl('/download-pdf'),
      payload,
      { responseType: 'arraybuffer' },
    );
    return response.data;
  });
}

export function blueprintUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return getApiUrl(path.startsWith('/') ? path : `/${path}`);
}
