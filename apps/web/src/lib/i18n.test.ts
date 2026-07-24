import { describe, expect, it } from "vitest";
import { appCopy, landingCopy, normalizeLocale } from "./i18n";

describe("i18n", () => {
  it("normalizes unsupported locales to Vietnamese", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("vi")).toBe("vi");
    expect(normalizeLocale("fr")).toBe("vi");
    expect(normalizeLocale(["en", "vi"])).toBe("en");
  });

  it("keeps required bilingual landing and app copy available", () => {
    for (const locale of ["vi", "en"] as const) {
      expect(landingCopy[locale].headline).toBeTruthy();
      expect(landingCopy[locale].useCases).toHaveLength(3);
      expect(landingCopy[locale].flowSignals).toHaveLength(3);
      expect(appCopy[locale].shell.nav.dashboard).toBeTruthy();
      expect(appCopy[locale].dashboard.title).toBeTruthy();
    }
  });
});
