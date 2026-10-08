import { describe, expect, it } from "vitest";
import { captureOp } from "../src/captureRules";

describe("captureOp", () => {
  it("matches wanted graphql operations whatever the hash", () => {
    expect(captureOp("https://x.com/i/api/graphql/AbC123_-x/UserByScreenName?variables=%7B%7D")).toBe("UserByScreenName");
    expect(captureOp("/i/api/graphql/zzz/UserOriginalsTimeline")).toBe("UserOriginalsTimeline");
    expect(captureOp("https://x.com/i/api/graphql/h/UserRepliesTimeline?x=1#frag")).toBe("UserRepliesTimeline");
    expect(captureOp("https://x.com/i/api/graphql/h/TweetDetail")).toBe("TweetDetail");
  });

  it("matches notifications", () => {
    expect(captureOp("https://x.com/i/api/2/notifications/all.json?include_profile_interstitial_type=1")).toBe("notifications");
  });

  it("ignores everything else", () => {
    expect(captureOp("https://x.com/i/api/graphql/h/SidebarUserRecommendations")).toBeNull();
    expect(captureOp("https://x.com/i/api/graphql/h/ViewerBadgeCounts")).toBeNull();
    expect(captureOp("https://x.com/home")).toBeNull();
    expect(captureOp("https://example.com/i/api/1.1/flow/timeline.json")).toBeNull();
  });
});
