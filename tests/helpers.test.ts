import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";
import { parseAccountId, rankTierLabel, steamIdToAccountId } from "@/lib/dota";
import { toStratzBracket } from "@/lib/stratz/brackets";

describe("Steam and account IDs", () => {
  it("converts SteamID64 to the 32-bit Dota account ID", () => {
    expect(steamIdToAccountId("76561198047011640")).toBe(86745912);
  });

  it("accepts either format when parsing user input", () => {
    expect(parseAccountId("86745912")).toBe(86745912);
    expect(parseAccountId(" 76561198047011640 ")).toBe(86745912);
    expect(parseAccountId("abc")).toBeNull();
    expect(parseAccountId("0")).toBeNull();
  });
});

describe("rankTierLabel", () => {
  it("names the medal and stars", () => {
    expect(rankTierLabel(53)).toBe("Legend 3");
    expect(rankTierLabel(80)).toBe("Immortal");
    expect(rankTierLabel(null)).toBe("Unranked");
  });
});

describe("safeNextPath", () => {
  it("keeps internal paths", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("/heroes?hero=1")).toBe("/heroes?hero=1");
  });

  it("falls back for external or protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example")).toBe("/profile");
    expect(safeNextPath("//evil.example")).toBe("/profile");
    expect(safeNextPath("/\\evil.example")).toBe("/profile");
    expect(safeNextPath(null)).toBe("/profile");
  });
});

describe("toStratzBracket", () => {
  it("groups ranks in pairs like STRATZ does", () => {
    expect(toStratzBracket(1)).toBe("HERALD_GUARDIAN");
    expect(toStratzBracket(4)).toBe("CRUSADER_ARCHON");
    expect(toStratzBracket(6)).toBe("LEGEND_ANCIENT");
    expect(toStratzBracket(8)).toBe("DIVINE_IMMORTAL");
    expect(toStratzBracket(0)).toBe("ALL");
  });
});
