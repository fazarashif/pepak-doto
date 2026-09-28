import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/opendota/types";
import { parsePlayerInput } from "@/lib/players/id";
import {
  isCountable,
  percentileOf,
  replayStatsFrom,
  summarizeMatch,
  type HeroBenchmarks,
  type RawPlayerMatch,
} from "@/lib/players/summary";

const points = (values: number[]) =>
  [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99].map((percentile, i) => ({
    percentile,
    value: values[i],
  }));

const bench: HeroBenchmarks = {
  gold_per_min: points([300, 350, 380, 400, 420, 440, 470, 500, 550, 600, 700]),
  xp_per_min: points([400, 450, 480, 500, 520, 540, 570, 600, 650, 700, 800]),
  last_hits_per_min: points([2, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9]),
  // Di /benchmarks persentil kematian naik seiring jumlah kematian.
  deaths_per_min: points([0.05, 0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.22, 0.25, 0.3, 0.4]),
  hero_damage_per_min: points([300, 400, 450, 500, 550, 600, 650, 700, 800, 900, 1100]),
};

const raw = (over: Partial<RawPlayerMatch> = {}): RawPlayerMatch => ({
  match_id: 1,
  player_slot: 130,
  radiant_win: false,
  hero_id: 1,
  start_time: 1_790_000_000,
  duration: 40 * 60,
  game_mode: 22,
  lobby_type: 7,
  kills: 10,
  deaths: 6, // 0.15/menit = persentil 0.5
  assists: 8,
  gold_per_min: 420,
  xp_per_min: 520,
  last_hits: 180, // 4.5/menit
  denies: 10,
  hero_damage: 22000, // 550/menit
  tower_damage: 3000,
  hero_healing: 0,
  lane_role: null,
  is_roaming: null,
  version: null,
  party_size: 1,
  average_rank: 52,
  leaver_status: 0,
  ...over,
});

describe("percentileOf", () => {
  const p = points([100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 990]);

  it("interpolates between benchmark points", () => {
    expect(percentileOf(p, 250)).toBeCloseTo(0.25);
    expect(percentileOf(p, 500)).toBeCloseTo(0.5);
  });

  it("clamps outside the range", () => {
    expect(percentileOf(p, 50)).toBeCloseTo(0.05);
    expect(percentileOf(p, 5000)).toBe(1);
  });

  it("returns null without data", () => {
    expect(percentileOf([], 10)).toBeNull();
    expect(percentileOf(p, NaN)).toBeNull();
  });
});

describe("summarizeMatch", () => {
  const s = summarizeMatch(raw(), bench);

  it("works out side and result", () => {
    expect(s.isRadiant).toBe(false);
    expect(s.win).toBe(true);
  });

  it("computes percentiles with deaths flipped so higher is better", () => {
    expect(s.pct.gpm).toBeCloseTo(0.5);
    expect(s.pct.lhPerMin).toBeCloseTo(0.5);
    expect(s.pct.damagePerMin).toBeCloseTo(0.5);
    expect(s.pct.deathsPerMin).toBeCloseTo(0.5);
    const fewDeaths = summarizeMatch(raw({ deaths: 2 }), bench); // 0.05/menit
    expect(fewDeaths.pct.deathsPerMin).toBeCloseTo(0.9);
  });

  it("guesses the role from last hits when the match isn't parsed", () => {
    expect(s.role).toBe("core");
    expect(summarizeMatch(raw({ last_hits: 40 }), bench).role).toBe("support");
    expect(summarizeMatch(raw({ lane_role: 2, last_hits: 40 }), bench).role).toBe("core");
  });

  it("leaves percentiles empty without benchmarks", () => {
    expect(summarizeMatch(raw(), null).pct).toEqual({});
  });
});

describe("isCountable", () => {
  it("skips Turbo, remakes and abandons", () => {
    expect(isCountable(raw())).toBe(true);
    expect(isCountable(raw({ game_mode: 23 }))).toBe(false);
    expect(isCountable(raw({ duration: 5 * 60 }))).toBe(false);
    expect(isCountable(raw({ leaver_status: 3 }))).toBe(false);
    expect(isCountable(raw({ leaver_status: 1 }))).toBe(true);
  });
});

describe("replayStatsFrom", () => {
  const match = {
    match_id: 1,
    duration: 2400,
    radiant_win: true,
    game_mode: 22,
    lobby_type: 7,
    start_time: 0,
    od_data: { has_parsed: true },
    players: [
      {
        account_id: 42,
        player_slot: 4,
        hero_id: 86,
        lh_t: Array.from({ length: 30 }, (_, i) => i * 3),
        dn_t: Array.from({ length: 30 }, (_, i) => i),
        obs_placed: 3,
        sen_placed: 5,
        position_est: 4,
        obs_log: [
          { time: 100, ehandle: 1 },
          { time: 200, ehandle: 2 },
          { time: 300, ehandle: 3 },
        ],
        obs_left_log: [
          // habis waktunya: dicatat dengan hero sendiri
          { time: 460, ehandle: 1, attackername: "npc_dota_hero_rubick" },
          // di-deward musuh
          { time: 260, ehandle: 2, attackername: "npc_dota_hero_slark" },
        ],
      },
    ],
  } as unknown as Match;

  it("reads laning numbers and ward life from the replay", () => {
    expect(replayStatsFrom(match, 42, "npc_dota_hero_rubick")).toEqual({
      lh10: 30,
      dn10: 10,
      obsPlaced: 3,
      senPlaced: 5,
      obsLifetime: 210, // (360 + 60) / 2
      obsDewarded: 1,
      position: 4,
    });
  });

  it("returns null for another player or an unparsed match", () => {
    expect(replayStatsFrom(match, 7, "x")).toBeNull();
    expect(replayStatsFrom({ ...match, od_data: null }, 42, "x")).toBeNull();
  });
});

describe("parsePlayerInput", () => {
  it("reads IDs and profile links", () => {
    expect(parsePlayerInput("291447476")).toBe(291447476);
    expect(parsePlayerInput("76561198251713204")).toBe(291447476);
    expect(parsePlayerInput("https://www.opendota.com/players/291447476/matches")).toBe(291447476);
    expect(parsePlayerInput("dotabuff.com/players/291447476")).toBe(291447476);
    expect(parsePlayerInput("https://stratz.com/players/291447476")).toBe(291447476);
    expect(parsePlayerInput("https://steamcommunity.com/profiles/76561198251713204/")).toBe(
      291447476,
    );
  });

  it("rejects things it can't read", () => {
    expect(parsePlayerInput("https://steamcommunity.com/id/somename")).toBeNull();
    expect(parsePlayerInput("hello")).toBeNull();
  });
});
