import {
  buildLanBaseUrl,
  getBaseUrlCandidates,
  rememberBaseUrlResolution,
  normalizeBaseUrl,
  probeLan,
  resolveBaseUrl,
  invalidateBaseUrlCache,
  getCachedResolution,
  LAN_PORT,
  LAN_PROBE_PATH,
} from "../resolveBaseUrl";

const device = (overrides: Partial<{ deviceId: string; url: string; deviceIp: string | null }> = {}) => ({
  deviceId: "dev-1",
  url: "https://iris-example.cfargotunnel.com",
  deviceIp: "192.168.1.42",
  ...overrides,
});

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeBaseUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeBaseUrl("https://example.com///")).toBe("https://example.com");
  });
  it("trims whitespace", () => {
    expect(normalizeBaseUrl("  https://example.com  ")).toBe("https://example.com");
  });
});

describe("buildLanBaseUrl", () => {
  it("returns http://ip:8000 for a plain IPv4", () => {
    expect(buildLanBaseUrl("192.168.1.42")).toBe(`http://192.168.1.42:${LAN_PORT}`);
  });
  it("strips any accidental scheme or trailing slash", () => {
    expect(buildLanBaseUrl("http://192.168.1.42/")).toBe(`http://192.168.1.42:${LAN_PORT}`);
  });
  it("returns null for empty/invalid input", () => {
    expect(buildLanBaseUrl(undefined)).toBeNull();
    expect(buildLanBaseUrl(null)).toBeNull();
    expect(buildLanBaseUrl("")).toBeNull();
    expect(buildLanBaseUrl("bad ip with space")).toBeNull();
  });
});

describe("probeLan", () => {
  it("returns true on a 2xx", async () => {
    const ok = await probeLan("http://192.168.1.42:8000", 500, async () => ({ ok: true } as Response));
    expect(ok).toBe(true);
  });
  it("returns false on a non-2xx", async () => {
    const ok = await probeLan("http://192.168.1.42:8000", 500, async () => ({ ok: false } as Response));
    expect(ok).toBe(false);
  });
  it("returns false on timeout/reject", async () => {
    const ok = await probeLan("http://192.168.1.42:8000", 500, async () => {
      throw new Error("aborted");
    });
    expect(ok).toBe(false);
  });
  it("appends the probe path", async () => {
    let seenUrl = "";
    await probeLan("http://192.168.1.42:8000", 500, async (u) => {
      seenUrl = u;
      return { ok: true } as Response;
    });
    expect(seenUrl).toBe(`http://192.168.1.42:8000${LAN_PROBE_PATH}`);
  });
});

describe("resolveBaseUrl", () => {
  beforeEach(() => {
    invalidateBaseUrlCache();
  });

  it("uses LAN when the probe succeeds", async () => {
    const base = await resolveBaseUrl(device(), async () => true);
    expect(base).toBe(`http://192.168.1.42:${LAN_PORT}`);
    expect(getCachedResolution("dev-1")?.isLan).toBe(true);
  });

  it("falls back to tunnel when the probe fails", async () => {
    const base = await resolveBaseUrl(device(), async () => false);
    expect(base).toBe("https://iris-example.cfargotunnel.com");
    expect(getCachedResolution("dev-1")?.isLan).toBe(false);
  });

  it("falls back to tunnel when deviceIp is missing", async () => {
    let probeCalls = 0;
    const base = await resolveBaseUrl(device({ deviceIp: null }), async () => {
      probeCalls += 1;
      return true;
    });
    expect(base).toBe("https://iris-example.cfargotunnel.com");
    expect(probeCalls).toBe(0);
  });

  it("falls back to LAN when the tunnel is missing", async () => {
    const base = await resolveBaseUrl(
      device({ url: "", deviceIp: "192.168.1.42" }),
      async () => false,
    );
    expect(base).toBe(`http://192.168.1.42:${LAN_PORT}`);
    expect(getCachedResolution("dev-1")?.isLan).toBe(true);
  });

  it("caches: second call does not re-probe", async () => {
    let probeCalls = 0;
    const probe = async () => {
      probeCalls += 1;
      return true;
    };
    await resolveBaseUrl(device(), probe);
    await resolveBaseUrl(device(), probe);
    expect(probeCalls).toBe(1);
  });

  it("invalidateBaseUrlCache() clears and forces re-probe", async () => {
    let probeCalls = 0;
    const probe = async () => {
      probeCalls += 1;
      return true;
    };
    await resolveBaseUrl(device(), probe);
    invalidateBaseUrlCache();
    await resolveBaseUrl(device(), probe);
    expect(probeCalls).toBe(2);
  });

  it("invalidateBaseUrlCache(deviceId) only clears that device", async () => {
    let probeCalls = 0;
    const probe = async () => {
      probeCalls += 1;
      return true;
    };
    await resolveBaseUrl(device({ deviceId: "a", deviceIp: "10.0.0.1" }), probe);
    await resolveBaseUrl(device({ deviceId: "b", deviceIp: "10.0.0.2" }), probe);
    expect(probeCalls).toBe(2);
    invalidateBaseUrlCache("a");
    await resolveBaseUrl(device({ deviceId: "a", deviceIp: "10.0.0.1" }), probe);
    await resolveBaseUrl(device({ deviceId: "b", deviceIp: "10.0.0.2" }), probe);
    expect(probeCalls).toBe(3);
  });

  it("normalizes the tunnel fallback URL (trims trailing slash)", async () => {
    const base = await resolveBaseUrl(
      device({ url: "https://iris-example.cfargotunnel.com/" }),
      async () => false,
    );
    expect(base).toBe("https://iris-example.cfargotunnel.com");
  });
});

describe("getBaseUrlCandidates", () => {
  beforeEach(() => {
    invalidateBaseUrlCache();
  });

  it("returns cached, LAN, then tunnel candidates without duplicates", () => {
    rememberBaseUrlResolution("dev-1", "http://192.168.1.42:8000", true);

    expect(getBaseUrlCandidates(device())).toEqual([
      `http://192.168.1.42:${LAN_PORT}`,
      "https://iris-example.cfargotunnel.com",
    ]);
  });

  it("skips empty candidates", () => {
    expect(getBaseUrlCandidates(device({ url: "", deviceIp: null }))).toEqual([]);
  });
});
