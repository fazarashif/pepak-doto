import { describe, expect, it, vi } from "vitest";
import {
  buildLoginUrl,
  checkAssertion,
  STEAM_OPENID_ENDPOINT,
  verifyWithSteam,
} from "@/lib/steam/openid";

const RETURN_TO = "https://pepak-doto.vercel.app/api/auth/steam/callback?state=abc";
const STEAM_ID = "76561198047011640";

function validParams(overrides: Record<string, string | null> = {}) {
  const claimed = `https://steamcommunity.com/openid/id/${STEAM_ID}`;
  const base: Record<string, string> = {
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": STEAM_OPENID_ENDPOINT,
    "openid.claimed_id": claimed,
    "openid.identity": claimed,
    "openid.return_to": RETURN_TO,
    "openid.response_nonce": "2026-09-27T10:00:00Zabc",
    "openid.assoc_handle": "1234567890",
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "c2lnbmF0dXJl",
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete base[key];
    else base[key] = value;
  }
  return new URLSearchParams(base);
}

describe("buildLoginUrl", () => {
  it("points at Steam with identifier_select and our return URL", () => {
    const url = new URL(buildLoginUrl(RETURN_TO, "https://pepak-doto.vercel.app"));
    expect(url.origin + url.pathname).toBe(STEAM_OPENID_ENDPOINT);
    expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
    expect(url.searchParams.get("openid.return_to")).toBe(RETURN_TO);
    expect(url.searchParams.get("openid.claimed_id")).toBe(
      "http://specs.openid.net/auth/2.0/identifier_select",
    );
  });
});

describe("checkAssertion", () => {
  it("accepts a well-formed Steam response", () => {
    expect(checkAssertion(validParams(), RETURN_TO)).toEqual({ ok: true, steamId: STEAM_ID });
  });

  it("rejects a response meant for another return URL", () => {
    const params = validParams({ "openid.return_to": "https://evil.example/callback" });
    expect(checkAssertion(params, RETURN_TO)).toMatchObject({ ok: false, reason: "return_to" });
  });

  it("rejects a provider other than Steam", () => {
    const params = validParams({ "openid.op_endpoint": "https://evil.example/openid" });
    expect(checkAssertion(params, RETURN_TO)).toMatchObject({ ok: false });
  });

  it("rejects a claimed ID that is not a Steam ID", () => {
    const claimed = "https://steamcommunity.com/openid/id/123";
    const params = validParams({ "openid.claimed_id": claimed, "openid.identity": claimed });
    expect(checkAssertion(params, RETURN_TO)).toMatchObject({ ok: false, reason: "claimed_id" });
  });

  it("rejects when identity and claimed_id differ", () => {
    const params = validParams({
      "openid.identity": "https://steamcommunity.com/openid/id/76561190000000000",
    });
    expect(checkAssertion(params, RETURN_TO)).toMatchObject({ ok: false });
  });

  it("rejects when return_to was not signed", () => {
    const params = validParams({ "openid.signed": "op_endpoint,claimed_id,identity" });
    expect(checkAssertion(params, RETURN_TO)).toMatchObject({ ok: false });
  });

  it("rejects a cancelled sign-in", () => {
    const params = validParams({ "openid.mode": "cancel" });
    expect(checkAssertion(params, RETURN_TO)).toMatchObject({ ok: false, reason: "mode" });
  });
});

describe("verifyWithSteam", () => {
  it("sends check_authentication and trusts is_valid:true", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n"),
    );
    const ok = await verifyWithSteam(validParams(), fetchMock);
    expect(ok).toBe(true);

    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get("openid.mode")).toBe("check_authentication");
    expect(body.get("openid.sig")).toBe("c2lnbmF0dXJl");
  });

  it("returns false when Steam says the signature is invalid", async () => {
    const fetchMock = vi.fn(async () => new Response("is_valid:false\n"));
    expect(await verifyWithSteam(validParams(), fetchMock as unknown as typeof fetch)).toBe(false);
  });
});
