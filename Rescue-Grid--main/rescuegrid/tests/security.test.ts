// Unit tests for rate limiting and victim report privacy helpers. Run with: bun test
import { describe, expect, it } from "bun:test";
import { createMemoryLimiter } from "@/lib/rateLimit";
import { addReportId, extractReportId, isReportId, MAX_REMEMBERED_REPORTS, parseReportIds } from "@/lib/myReports";
import { reportReference } from "@/lib/status";

const ID_A = "3f2a9c1e-1111-4a2b-8c3d-000000000001";
const ID_B = "3f2a9c1e-2222-4a2b-8c3d-000000000002";

describe("memory rate limiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    let now = 0;
    const hit = createMemoryLimiter(() => now);
    expect(hit("k", 3, 1000)).toBe(true);
    expect(hit("k", 3, 1000)).toBe(true);
    expect(hit("k", 3, 1000)).toBe(true);
    expect(hit("k", 3, 1000)).toBe(false);
    now = 999;
    expect(hit("k", 3, 1000)).toBe(false);
  });

  it("starts a fresh window after it expires, and keeps keys separate", () => {
    let now = 0;
    const hit = createMemoryLimiter(() => now);
    hit("a", 1, 1000);
    expect(hit("a", 1, 1000)).toBe(false);
    expect(hit("b", 1, 1000)).toBe(true);
    now = 1000;
    expect(hit("a", 1, 1000)).toBe(true);
  });
});

describe("my reports (device-stored ids)", () => {
  it("accepts only UUIDs", () => {
    expect(isReportId(ID_A)).toBe(true);
    expect(isReportId("9876543210")).toBe(false);
    expect(isReportId("id.eq.x,phone_no.like.*")).toBe(false);
    expect(isReportId(null)).toBe(false);
  });

  it("parses stored lists defensively", () => {
    expect(parseReportIds(JSON.stringify([ID_A, "junk", ID_A, ID_B]))).toEqual([ID_A, ID_B]);
    expect(parseReportIds("not json")).toEqual([]);
    expect(parseReportIds(JSON.stringify({ id: ID_A }))).toEqual([]);
    expect(parseReportIds(null)).toEqual([]);
  });

  it("adds newest first, without duplicates, capped", () => {
    expect(addReportId([ID_A], ID_B)).toEqual([ID_B, ID_A]);
    expect(addReportId([ID_A, ID_B], ID_B)).toEqual([ID_B, ID_A]);
    expect(addReportId([ID_A], "bad")).toEqual([ID_A]);
    const many = Array.from({ length: MAX_REMEMBERED_REPORTS }, (_, i) => `3f2a9c1e-1111-4a2b-8c3d-${String(i).padStart(12, "0")}`);
    expect(addReportId(many, ID_B)).toHaveLength(MAX_REMEMBERED_REPORTS);
  });

  it("pulls the report id out of a pasted status link", () => {
    expect(extractReportId(`https://rescuegrid.example/report/status/${ID_A}`)).toBe(ID_A);
    expect(extractReportId(`  ${ID_A.toUpperCase()} `)).toBe(ID_A);
    expect(extractReportId("https://rescuegrid.example/report/my")).toBeNull();
  });
});

describe("report reference", () => {
  it("uses a neutral RG prefix with the year and short id", () => {
    expect(reportReference(ID_A, "2026-09-28T10:00:00Z")).toBe("RG-2026-3F2A");
  });
});
