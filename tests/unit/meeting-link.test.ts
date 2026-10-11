import { afterEach, describe, expect, it, vi } from "vitest";
import { validateMeetingLink } from "@/lib/validation/meeting-link";

// Synthetic format fixtures only. Never open these URLs or use real invitations.
const zoom = "https://zoom.us/j/12345678901";
const meet = "https://meet.google.com/abc-defg-hij";
const invalid = { ok: false, code: "INVALID_MEETING_LINK" };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("supported meeting-link formats", () => {
  it.each([
    [zoom, "zoom"],
    ["https://zoom.us/j/123456789", "zoom"],
    ["https://zoom.us/j/1234567890", "zoom"],
    ["https://us02web.zoom.us/j/12345678901", "zoom"],
    ["https://example-school.zoom.us/j/12345678901", "zoom"],
    [`${zoom}?pwd=Synthetic_A-b.C~9`, "zoom"],
    [`${zoom}?pwd=${"a".repeat(256)}`, "zoom"],
    [`https://${"a".repeat(63)}.zoom.us/j/12345678901`, "zoom"],
    [meet, "google_meet"],
    ["https://meet.google.com/a-b-c", "google_meet"],
    [`https://meet.google.com/${"a".repeat(124)}-b-c`, "google_meet"],
  ])("accepts supported fixture %#", (url, provider) => {
    const result = validateMeetingLink(url);
    expect(result).toEqual({ ok: true, provider, url });
    if (result.ok) expect(validateMeetingLink(result.url)).toEqual(result);
  });

  it("normalizes only scheme/host case and preserves passcode bytes", () => {
    expect(
      validateMeetingLink(
        "HTTPS://US02WEB.ZOOM.US/j/12345678901?pwd=AbC_d-E.1",
      ),
    ).toEqual({
      ok: true,
      provider: "zoom",
      url: "https://us02web.zoom.us/j/12345678901?pwd=AbC_d-E.1",
    });
    expect(validateMeetingLink("HTTPS://MEET.GOOGLE.COM/abc-defg-hij")).toEqual(
      {
        ok: true,
        provider: "google_meet",
        url: meet,
      },
    );
  });
});

describe("host and protocol attacks", () => {
  it.each([
    "http://zoom.us/j/12345678901",
    "javascript:alert(1)",
    "data:text/html,https://meet.google.com/abc-defg-hij",
    "zoommtg://zoom.us/j/12345678901",
    "//meet.google.com/abc-defg-hij",
    "https:meet.google.com/abc-defg-hij",
    "https:/meet.google.com/abc-defg-hij",
    "https:///meet.google.com/abc-defg-hij",
    "/abc-defg-hij",
    "https://meet.google.com.evil.example/abc-defg-hij",
    "https://evilmeet.google.com/abc-defg-hij",
    "https://sub.meet.google.com/abc-defg-hij",
    "https://zoom.us.evil.example/j/12345678901",
    "https://evilzoom.us/j/12345678901",
    "https://a.b.zoom.us/j/12345678901",
    "https://-bad.zoom.us/j/12345678901",
    "https://bad-.zoom.us/j/12345678901",
    "https://bad_name.zoom.us/j/12345678901",
    "https://xn--example.zoom.us/j/12345678901",
    `https://${"a".repeat(64)}.zoom.us/j/12345678901`,
    "https://zoom.us./j/12345678901",
    "https://zoom..us/j/12345678901",
    "https://zoom.us:443/j/12345678901",
    "https://zoom.us:8443/j/12345678901",
    "https://zoom.us:/j/12345678901",
    "https://zoom.us@evil.example/j/12345678901",
    "https://evil.example@zoom.us/j/12345678901",
    "https://user:pass@zoom.us/j/12345678901",
    "https://@zoom.us/j/12345678901",
    "https://127.0.0.1/j/12345678901",
    "https://2130706433/j/12345678901",
    "https://[::1]/j/12345678901",
    "https://localhost/j/12345678901",
    "https://zоom.us/j/12345678901", // Cyrillic o
    "https://ｚｏｏｍ.us/j/12345678901", // URL would normalize fullwidth ASCII
    "https://zoom。us/j/12345678901",
    "https://%7Aoom.us/j/12345678901",
    "https://zoom.us\\@evil.example/j/12345678901",
    "https:\\\\zoom.us/j/12345678901",
  ])("rejects deceptive authority fixture %#", (input) => {
    expect(validateMeetingLink(input)).toEqual(invalid);
  });
});

describe("paths, queries and normalization attacks", () => {
  it.each([
    `${zoom}/`,
    `${zoom}/extra`,
    `${zoom};extra`,
    `${zoom}.html`,
    "https://zoom.us/j/12345678",
    "https://zoom.us/j/123456789012",
    "https://zoom.us/j/123-456-789",
    "https://zoom.us/j/12345678a",
    "https://zoom.us/J/12345678901",
    "https://zoom.us/j/%31%32%33%34%35%36%37%38%39",
    "https://zoom.us/other/../j/12345678901",
    "https://zoom.us/./j/12345678901",
    "https://zoom.us/%2e%2e/j/12345678901",
    "https://zoom.us//j/12345678901",
    "https://zoom.us",
    "https://zoom.us/",
    "https://zoom.us/my/example",
    "https://zoom.us/s/12345678901",
    "https://zoom.us/wc/12345678901/join",
    "https://zoom.us/meeting/register/example",
    "https://zoom.us/rec/share/example",
    "https://zoom.com/j/12345678901",
    "https://zoomgov.com/j/12345678901",
    `${zoom}?`,
    `${zoom}#`,
    `${zoom}#success`,
    `${zoom}?pwd=abc#secret`,
    `${zoom}?pwd=`,
    `${zoom}?PWD=abc`,
    `${zoom}?pwd=a&pwd=b`,
    `${zoom}?%70wd=abc`,
    `${zoom}?pwd=%41`,
    `${zoom}?pwd=a+b`,
    `${zoom}?pwd=a=b`,
    `${zoom}?pwd=abc&next=https://evil.example`,
    `${zoom}?next=https://evil.example`,
    `${zoom}?pwd=abc&`,
    `${zoom}?pwd=abc;next=evil`,
    `${zoom}?pwd=abc?omn=123`,
    `${zoom}?pwd=${"a".repeat(257)}`,
    `${zoom}?pwd=%0a`,
    `${zoom}?pwd=%252f`,
    `${meet}?authuser=1`,
    `${meet}?`,
    `${meet}#`,
    `${meet}/`,
    "https://meet.google.com/ABC-defg-hij",
    "https://meet.google.com/abc-d3fg-hij",
    "https://meet.google.com/abc--hij",
    "https://meet.google.com/abc-defg-hij-klm",
    "https://meet.google.com/lookup/example",
    "https://meet.google.com/new",
    "https://meet.google.com/landing",
    "https://meet.google.com/",
    "https://meet.google.com/other/../abc-defg-hij",
    `https://meet.google.com/${"a".repeat(125)}-b-c`,
    ` ${zoom}`,
    `${zoom} `,
    `${zoom}\n`,
    `\t${zoom}`,
    "https://zo\nom.us/j/12345678901",
    `${meet}\u0000`,
    `${meet}\u007f`,
    `${meet}\u200b`,
    `${meet}\u202e`,
    `${zoom}?pwd=<script>`,
    "x".repeat(2049),
  ])("rejects unsupported or ambiguous fixture %#", (input) => {
    expect(validateMeetingLink(input)).toEqual(invalid);
  });

  it("rejects every ASCII control even where URL parsing would strip it", () => {
    for (let code = 0; code <= 32; code++) {
      const character = String.fromCharCode(code);
      for (const input of [
        character + zoom,
        zoom + character,
        zoom.replace("zoom", `zo${character}om`),
      ]) {
        expect(validateMeetingLink(input)).toEqual(invalid);
      }
    }
  });

  it("rejects non-strings without invoking coercion", () => {
    const toString = vi.fn(() => {
      throw new Error("Must not coerce");
    });
    for (const input of [
      undefined,
      null,
      false,
      123,
      [],
      {},
      new URL(meet),
      { toString },
      Symbol("input"),
    ]) {
      expect(validateMeetingLink(input)).toEqual(invalid);
    }
    expect(toString).not.toHaveBeenCalled();
  });

  it("does not fetch or log inputs, results or parser errors", () => {
    const fetch = vi.fn(() => {
      throw new Error("Network forbidden");
    });
    vi.stubGlobal("fetch", fetch);
    const logs = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const spies = logs.map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    for (const input of [
      zoom,
      meet,
      `${zoom}?pwd=SyntheticPrivateToken`,
      "https://../j/12345678901",
      `${zoom}?pwd=SyntheticPrivateToken&next=bad`,
    ]) {
      validateMeetingLink(input);
    }
    expect(fetch).not.toHaveBeenCalled();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(
      validateMeetingLink(`${zoom}?pwd=SyntheticPrivateToken&next=bad`),
    ).toEqual(invalid);
  });
});
