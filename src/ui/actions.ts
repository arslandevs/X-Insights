import { allUsers, clearAll, exportAll, importAll, type Backup } from "../db";
import { download, handleMap, tweetsToCsv } from "../export";
import type { TweetRow } from "../types";

const stamp = () => new Date().toISOString().slice(0, 10);
const notify = () => new BroadcastChannel("xi").postMessage({ type: "updated" });

export async function exportJson() {
  download(`x-insights-${stamp()}.json`, JSON.stringify(await exportAll()));
}

export async function exportCsv(tweets: TweetRow[], label: string) {
  const csv = tweetsToCsv(tweets, handleMap(await allUsers()));
  download(`x-insights-${label}-${stamp()}.csv`, csv, "text/csv");
}

export async function importJsonFile(file: File): Promise<string> {
  let parsed: Backup;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const r = await importAll(parsed);
  notify();
  return `Imported ${r.tweets} tweets, ${r.users} accounts and ${r.interactions} interactions.`;
}

export async function clearData() {
  await clearAll();
  notify();
}
