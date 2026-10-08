// Finds Tweet and User objects anywhere in a response, so we never depend on a fixed path.
// X changes the wrapping (timeline_v2 -> timeline, TweetWithVisibilityResults, modules...) far more often than the objects themselves.
type Obj = Record<string, unknown>;

export interface Found {
  tweets: Obj[];
  users: Obj[];
}

// Real responses show that the tweet inside TweetWithVisibilityResults carries no __typename, so also recognise objects by shape.
const isTweetLike = (o: Obj) => typeof o.rest_id === "string" && !!o.legacy && typeof (o.legacy as Obj).full_text === "string";
const isUserLike = (o: Obj) => {
  if (typeof o.rest_id !== "string") return false;
  const core = o.core as Obj | undefined;
  const legacy = o.legacy as Obj | undefined;
  return typeof core?.screen_name === "string" || typeof legacy?.screen_name === "string";
};

export function walk(root: unknown): Found {
  const tweets: Obj[] = [];
  const users: Obj[] = [];
  const stack: unknown[] = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (let i = cur.length - 1; i >= 0; i--) stack.push(cur[i]);
      continue;
    }
    const o = cur as Obj;
    if (o.__typename === "Tweet" || (o.__typename === undefined && isTweetLike(o))) tweets.push(o);
    else if (o.__typename === "User" || (o.__typename === undefined && isUserLike(o))) users.push(o);
    for (const v of Object.values(o)) if (v && typeof v === "object") stack.push(v);
  }
  return { tweets, users };
}
