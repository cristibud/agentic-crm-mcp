import { logger } from './logger.js';
import type { Settings } from './types/types.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const API_KEY = process.env.API_KEY ?? 'crm-secret-key-2024';

let cachedSettings: Settings | null = null;
let settingsCacheTime: number = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, url, body: text }, 'API request failed');
    throw new Error(`API request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const settingsClient = {
  async getSettings(): Promise<Settings> {
    const now = Date.now();
    
    // Return cached settings if still valid
    if (cachedSettings && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
      return cachedSettings;
    }

    const settings = await request<Settings>('/api/settings');
    cachedSettings = settings;
    settingsCacheTime = now;
    return settings;
  },

  clearCache() {
    cachedSettings = null;
    settingsCacheTime = 0;
  },
};

