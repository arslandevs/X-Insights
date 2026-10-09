import { getMeta, setMeta } from "./db";
import type { Settings } from "./types";

export const defaultSettings = (): Settings => ({ meHandle: null, timezone: "local", feedHandles: [] });

const area = () => (typeof chrome !== "undefined" ? chrome.storage?.local : undefined);

/** Settings live in IndexedDB and are mirrored to chrome.storage.local, so feed accounts survive a database reset or an import. */
export async function loadSettings(): Promise<Settings> {
  const fromDb = await getMeta<Partial<Settings>>("settings");
  if (fromDb) return { ...defaultSettings(), ...fromDb };
  try {
    const mirrored = (await area()?.get("xi-settings"))?.["xi-settings"] as Partial<Settings> | undefined;
    if (mirrored) return { ...defaultSettings(), ...mirrored };
  } catch {
    /* no storage in this context */
  }
  return defaultSettings();
}

export async function saveSettings(s: Settings) {
  await setMeta("settings", s);
  try {
    await area()?.set({ "xi-settings": s });
  } catch {
    /* ignore */
  }
}

/** Handle of the logged-in user: the manual setting wins over what the page told us. */
export async function effectiveMeHandle(s: Settings): Promise<string | null> {
  return s.meHandle || (await getMeta<string>("meHandleDetected")) || null;
}
