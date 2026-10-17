import type { ProfileValues } from './fieldMapper';

export const PROFILE_STORAGE_KEY = 'applaiProfile';
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;

export type StoredResume = {
  name: string;
  type: string;
  dataUrl: string;
};

export type StoredProfile = {
  values: ProfileValues;
  resume?: StoredResume;
};

export async function loadStoredProfile(): Promise<StoredProfile | null> {
  const stored = await browser.storage.local.get(PROFILE_STORAGE_KEY);
  return (stored[PROFILE_STORAGE_KEY] as StoredProfile | undefined) || null;
}

export async function saveStoredProfile(profile: StoredProfile): Promise<void> {
  await browser.storage.local.set({ [PROFILE_STORAGE_KEY]: profile });
}
