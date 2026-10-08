import { allInteractions, allTweets, allUsers, counts, getMeta, tweetsByAuthor, userByHandle } from "../db";
import { effectiveMeHandle, loadSettings } from "../settings";
import { resolveTz } from "../tz";
import type { CaptureStat, InteractionRow, Settings, TweetRow, UserRow } from "../types";

export interface Core {
  settings: Settings;
  tz: string;
  meHandle: string | null;
  me: UserRow | undefined;
  /** the profile being shown: the active tab's, or mine */
  handle: string | null;
  user: UserRow | undefined;
  isMe: boolean;
  /** everything captured that this user wrote */
  tweets: TweetRow[];
  stats: Record<string, CaptureStat>;
  counts: { users: number; tweets: number; interactions: number };
}

export async function loadCore(tabHandle: string | null): Promise<Core> {
  const settings = await loadSettings();
  const meHandle = await effectiveMeHandle(settings);
  const me = meHandle ? await userByHandle(meHandle) : undefined;
  const handle = tabHandle ?? meHandle;
  const isMe = !!handle && !!meHandle && handle.toLowerCase() === meHandle.toLowerCase();
  const user = handle ? (isMe ? me : await userByHandle(handle)) : undefined;
  const tweets = user ? await tweetsByAuthor(user.id) : [];
  return {
    settings,
    tz: resolveTz(settings.timezone),
    meHandle,
    me,
    handle,
    user,
    isMe,
    tweets,
    stats: (await getMeta<Record<string, CaptureStat>>("captureStats")) ?? {},
    counts: await counts(),
  };
}

export interface Social {
  tweets: TweetRow[];
  users: Map<string, UserRow>;
  interactions: InteractionRow[];
}

export async function loadSocial(): Promise<Social> {
  const [tweets, users, interactions] = await Promise.all([allTweets(), allUsers(), allInteractions()]);
  return { tweets, users: new Map(users.map((u) => [u.id, u])), interactions };
}
