import { getMeta, setMeta } from "./db";
import type { Settings } from "./types";

export const defaultSettings = (): Settings => ({ meHandle: null, timezone: "local", feedHandles: [] });

export async function loadSettings(): Promise<Settings> {
  return { ...defaultSettings(), ...((await getMeta<Partial<Settings>>("settings")) ?? {}) };
}

export async function saveSettings(s: Settings) {
  await setMeta("settings", s);
}

/** Handle of the logged-in user: the manual setting wins over what the page told us. */
export async function effectiveMeHandle(s: Settings): Promise<string | null> {
  return s.meHandle || (await getMeta<string>("meHandleDetected")) || null;
}
