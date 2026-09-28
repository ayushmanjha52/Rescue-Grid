// Unit tests for the pure business logic. Run with: bun test
import { describe, expect, it, afterEach } from "bun:test";
import { isVolunteerAuthUser, volunteerLoginEmail } from "@/lib/auth/volunteerAccess";
import { generateTempPin, validatePin } from "@/lib/auth/volunteerAccounts";
import { isDmaUser } from "@/lib/auth/dmaAccess";
import { normalizePhone, phoneTail } from "@/lib/phone";
import {
  isAssignmentDone,
  isAssignmentInProgress,
  isSituation,
  normalizeAssignmentStatus,
  reportStatusForAssignment,
  SITUATION_URGENCY,
} from "@/lib/status";
import { AllocationError, computeSettlement } from "@/lib/resources";
import { bboxAround, haversineKm, parseBBox } from "@/lib/geo";
import { cleanMessageContent, MAX_MESSAGE_LENGTH } from "@/lib/messages";
import { sanitizeFilterTerm, parseList } from "@/lib/skills";

describe("normalizePhone", () => {
  it("adds the +91 country code to 10-digit Indian numbers", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("098765-43210")).toBe("+919876543210");
  });

  it("keeps numbers that already have a country code", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+1 (249) 468-3139")).toBe("+12494683139");
  });

  it("rejects input that can't be a phone number", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone(9876543210)).toBeNull();
  });

  it("matches the last 10 digits across formats", () => {
    expect(phoneTail("+91 98765-43210")).toBe("9876543210");
  });
});

describe("status vocabulary", () => {
  it("normalizes legacy assignment statuses", () => {
    expect(normalizeAssignmentStatus("on_my_way")).toBe("en_route");
    expect(normalizeAssignmentStatus("on-mission")).toBe("en_route");
    expect(normalizeAssignmentStatus("arrived")).toBe("arrived");
  });

  it("classifies in-progress vs done", () => {
    for (const s of ["active", "en_route", "on_my_way", "arrived"]) expect(isAssignmentInProgress(s)).toBe(true);
    expect(isAssignmentInProgress("open")).toBe(false);
    expect(isAssignmentDone("completed")).toBe(true);
    expect(isAssignmentDone("failed")).toBe(true);
    expect(isAssignmentDone("active")).toBe(false);
  });

  it("mirrors assignment progress onto the victim report", () => {
    expect(reportStatusForAssignment("active")).toBe("assigned");
    expect(reportStatusForAssignment("on_my_way")).toBe("en_route");
    expect(reportStatusForAssignment("arrived")).toBe("arrived");
    expect(reportStatusForAssignment("completed")).toBe("resolved");
    // A failed mission puts the victim back in the queue.
    expect(reportStatusForAssignment("failed")).toBe("open");
  });

  it("triages life-threatening situations as critical", () => {
    expect(SITUATION_URGENCY.rescue).toBe("critical");
    expect(SITUATION_URGENCY.medical).toBe("critical");
    expect(SITUATION_URGENCY.shelter).toBe("moderate");
    expect(isSituation("rescue")).toBe(true);
    expect(isSituation("pizza")).toBe(false);
  });
});

describe("computeSettlement", () => {
  it("consumed with no quantities uses everything", () => {
    expect(computeSettlement(10, "consumed")).toEqual({ consumed: 10, returned: 0, deduction: 10 });
  });

  it("returned with no quantities puts everything back", () => {
    expect(computeSettlement(10, "returned")).toEqual({ consumed: 0, returned: 10, deduction: 0 });
  });

  it("a partial return records the rest as used", () => {
    expect(computeSettlement(10, "returned", undefined, 4)).toEqual({ consumed: 6, returned: 4, deduction: 6 });
  });

  it("lost writes off whatever wasn't returned", () => {
    expect(computeSettlement(10, "lost")).toEqual({ consumed: 0, returned: 0, deduction: 10 });
    expect(computeSettlement(10, "lost", 2, 3)).toEqual({ consumed: 2, returned: 3, deduction: 7 });
  });

  it("rejects impossible quantities", () => {
    expect(() => computeSettlement(10, "consumed", 8, 5)).toThrow(AllocationError);
    expect(() => computeSettlement(10, "returned", undefined, -1)).toThrow(AllocationError);
    expect(() => computeSettlement(10, "returned", undefined, "abc")).toThrow(AllocationError);
  });
});

describe("geo helpers", () => {
  it("parses a valid bbox and rejects bad ones", () => {
    expect(parseBBox("86.2,23.6,86.6,23.9")).toEqual({ minLng: 86.2, minLat: 23.6, maxLng: 86.6, maxLat: 23.9 });
    expect(parseBBox("86.6,23.9,86.2,23.6")).toBeNull();
    expect(parseBBox("1,2,3")).toBeNull();
    expect(parseBBox(null)).toBeNull();
  });

  it("computes great-circle distance", () => {
    // Dhanbad → Ranchi is roughly 125 km as the crow flies.
    const km = haversineKm(23.7957, 86.4304, 23.3441, 85.3096);
    expect(km).toBeGreaterThan(115);
    expect(km).toBeLessThan(135);
    expect(haversineKm(23.8, 86.4, 23.8, 86.4)).toBe(0);
  });

  it("builds a bbox that contains the search circle", () => {
    const box = bboxAround(23.8, 86.4, 10);
    expect(haversineKm(23.8, 86.4, box.maxLat, 86.4)).toBeCloseTo(10, 0);
    expect(box.minLng).toBeLessThan(86.4);
    expect(box.maxLng).toBeGreaterThan(86.4);
  });
});

describe("input sanitation", () => {
  it("trims and bounds message content", () => {
    expect(cleanMessageContent("  hello  ")).toBe("hello");
    expect(cleanMessageContent("   ")).toBeNull();
    expect(cleanMessageContent(42)).toBeNull();
    expect(cleanMessageContent("x".repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull();
  });

  it("strips PostgREST filter syntax from search terms", () => {
    expect(sanitizeFilterTerm("first_aid")).toBe("first_aid");
    expect(sanitizeFilterTerm("boat),status.eq.offline")).toBe("boatstatuseqoffline");
    expect(sanitizeFilterTerm("Life Jacket")).toBe("Life Jacket");
  });

  it("parses comma separated lists", () => {
    expect(parseList("rope, boat ,, radio")).toEqual(["rope", "boat", "radio"]);
    expect(parseList(["a", " b "])).toEqual(["a", "b"]);
    expect(parseList(null)).toEqual([]);
  });
});


describe("account separation", () => {
  const originalAllowList = process.env.DMA_ALLOWED_EMAILS;
  afterEach(() => {
    process.env.DMA_ALLOWED_EMAILS = originalAllowList;
  });

  it("recognises volunteer logins by their server-granted role", () => {
    expect(isVolunteerAuthUser({ email: "v919876543210@volunteers.rescuegrid.invalid", app_metadata: { role: "volunteer" } })).toBe(true);
    // Legacy phone-only accounts from the SMS sign-in still count.
    expect(isVolunteerAuthUser({ email: undefined, app_metadata: {} })).toBe(true);
    expect(isVolunteerAuthUser({ email: "ops@example.org", app_metadata: { role: "dma_operator" } })).toBe(false);
    expect(isVolunteerAuthUser({ email: "stranger@example.org", app_metadata: {} })).toBe(false);
    expect(isVolunteerAuthUser(null)).toBe(false);
  });

  it("maps a phone number to its volunteer login name", () => {
    expect(volunteerLoginEmail("+919876543210")).toBe("v919876543210@volunteers.rescuegrid.invalid");
  });

  it("makes 6-digit temporary PINs and validates PIN length", () => {
    for (let i = 0; i < 50; i++) expect(generateTempPin()).toMatch(/^\d{6}$/);
    expect(validatePin("12345")).toBeNull();
    expect(validatePin("123456")).toBe("123456");
    expect(validatePin(123456)).toBeNull();
    expect(validatePin("x".repeat(73))).toBeNull();
  });

  const operator = { role: "dma_operator" };

  it("never lets a volunteer account into the DMA dashboard", () => {
    process.env.DMA_ALLOWED_EMAILS = "";
    expect(isDmaUser({ email: undefined, app_metadata: operator })).toBe(false);
    expect(isDmaUser({ email: "", app_metadata: operator })).toBe(false);
    expect(isDmaUser({ email: "ops@example.org", app_metadata: operator })).toBe(true);
  });

  it("requires the server-granted operator role, not just an email sign-up", () => {
    process.env.DMA_ALLOWED_EMAILS = "";
    expect(isDmaUser({ email: "stranger@example.org", app_metadata: {} })).toBe(false);
    expect(isDmaUser({ email: "stranger@example.org", app_metadata: { role: "admin" } })).toBe(false);
    // user_metadata is user-editable and must be ignored.
    expect(isDmaUser({ email: "stranger@example.org", user_metadata: { role: "dma_operator" }, app_metadata: {} } as never)).toBe(false);
  });

  it("honours the DMA allow-list (case-insensitive)", () => {
    process.env.DMA_ALLOWED_EMAILS = "Chief@District.gov.in, second@district.gov.in";
    expect(isDmaUser({ email: "chief@district.gov.in", app_metadata: operator })).toBe(true);
    expect(isDmaUser({ email: "SECOND@district.gov.in", app_metadata: operator })).toBe(true);
    expect(isDmaUser({ email: "intruder@example.org", app_metadata: operator })).toBe(false);
  });
});