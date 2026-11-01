import { describe, expect, it } from "vitest";
import { isDarkAt, sunTimes } from "../src-www/lib/sun";

describe("sun", () => {
  it("puts sunrise before sunset at mid latitudes", () => {
    const { sunrise, sunset } = sunTimes(new Date(2026, 5, 21, 12), 50, 10);
    expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
  });
  it("is dark at midnight and light at noon in summer", () => {
    expect(isDarkAt(new Date(2026, 5, 21, 0, 30), 50, 10)).toBe(true);
    expect(isDarkAt(new Date(2026, 5, 21, 13, 0), 50, 10)).toBe(false);
  });
});
