import { describe, expect, it } from "vitest";
import { allText, extractJson, runChain, unknownNames, type ChainProvider } from "@/lib/llm/check";
import { DEFAULT_SETTINGS, parseSettings } from "@/lib/llm/settings";

const vocab = [
  "Slark",
  "Tiny",
  "Axe",
  "Black King Bar",
  "Blade Mail",
  "Force Staff",
  "Observer Ward",
];

describe("unknownNames", () => {
  it("flags heroes and items that aren't in the facts", () => {
    const text = "Slark killed you often. Buy Force Staff, and Blade Mail helps too.";
    expect(unknownNames(text, ["Slark", "Force Staff"], vocab)).toEqual(["Blade Mail"]);
  });

  it("matches whole, capitalised words only", () => {
    expect(unknownNames("tiny mistakes add up, relax", [], vocab)).toEqual([]);
    expect(unknownNames("Maxed out", [], vocab)).toEqual([]);
  });

  it("does not count a short name inside a longer one", () => {
    expect(unknownNames("Get Black King Bar early", ["Black King Bar"], [...vocab, "Bar"])).toEqual(
      [],
    );
  });

  it("always allows common consumables", () => {
    expect(unknownNames("Place an Observer Ward there", [], vocab)).toEqual([]);
  });
});

describe("extractJson", () => {
  it("reads JSON wrapped in a code fence or text", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a": {"b": 2}} Hope this helps')).toEqual({ a: { b: 2 } });
  });

  it("returns null for broken answers", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("{ broken")).toBeNull();
  });
});

describe("allText", () => {
  it("joins every string in an object", () => {
    expect(allText({ a: "one", b: ["two", { c: "three" }], d: 4 })).toBe("one\ntwo\nthree");
  });
});

function fake(answer: string | Error, configured = true): ChainProvider & { calls: number } {
  return {
    calls: 0,
    isConfigured: () => configured,
    async generate() {
      this.calls++;
      if (answer instanceof Error) throw answer;
      return { text: answer, inputTokens: 100, outputTokens: 20 };
    },
  };
}

describe("runChain", () => {
  const request = { system: "s", prompt: "p", maxTokens: 10 };
  const accept = (text: string) =>
    text.includes("good") ? { value: text } : { error: "not good" };

  it("falls through failing and unconfigured providers", async () => {
    const providers = {
      a: fake(new Error("500")),
      b: fake("good answer", false),
      c: fake("bad answer"),
      d: fake("good answer"),
    };
    const attempts: string[] = [];
    const res = await runChain({
      chain: ["a", "b", "c", "d"].map((p) => ({
        provider: p as keyof typeof providers,
        model: "m",
      })),
      providers,
      request,
      accept,
      timeoutMs: 1000,
      onAttempt: (a) => {
        attempts.push(`${a.provider}:${a.ok ? "ok" : a.error}`);
      },
    });
    expect(res?.entry.provider).toBe("d");
    expect(providers.b.calls).toBe(0);
    expect(attempts).toEqual(["a:500", "c:not good", "d:ok"]);
  });

  it("returns null when nothing works", async () => {
    const providers = { a: fake("bad") };
    const res = await runChain({
      chain: [{ provider: "a", model: "m" }],
      providers,
      request,
      accept,
      timeoutMs: 1000,
    });
    expect(res).toBeNull();
  });
});

describe("parseSettings", () => {
  it("uses Claude Haiku first by default", () => {
    expect(DEFAULT_SETTINGS.chain[0]).toEqual({
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
    });
    expect(DEFAULT_SETTINGS.perUserPerDay).toBe(10);
    expect(DEFAULT_SETTINGS.globalPerDay).toBe(200);
  });

  it("falls back to defaults for broken settings", () => {
    expect(parseSettings({ enabled: "yes" })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid saved settings", () => {
    const saved = { ...DEFAULT_SETTINGS, perUserPerDay: 3 };
    expect(parseSettings(saved).perUserPerDay).toBe(3);
  });
});
