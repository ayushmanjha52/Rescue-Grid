// Unit tests for volunteer intake and mission updates. Run with: bun test
import { describe, expect, it } from "bun:test";
import {
  hasPlaceholderName,
  isNewVolunteer,
  isSkillIdList,
  NEW_VOLUNTEER_WINDOW_MS,
  placeholderVolunteerName,
  toVolunteerType,
  validateVolunteerName,
} from "@/lib/volunteers";
import { formatMissionUpdate, MISSION_NOTE_HEADLINE, missionStatusHeadline } from "@/lib/status";

describe("new volunteers", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");

  it("flags people who joined within the window", () => {
    expect(isNewVolunteer("2026-09-28T11:00:00Z", now)).toBe(true);
    expect(isNewVolunteer(new Date(now - NEW_VOLUNTEER_WINDOW_MS + 60_000).toISOString(), now)).toBe(true);
  });

  it("does not flag older volunteers or rows from before join dates were tracked", () => {
    expect(isNewVolunteer(new Date(now - NEW_VOLUNTEER_WINDOW_MS - 1).toISOString(), now)).toBe(false);
    expect(isNewVolunteer(null, now)).toBe(false);
    expect(isNewVolunteer("not a date", now)).toBe(false);
  });
});

describe("volunteer names", () => {
  it("recognizes the sign-up placeholder", () => {
    const placeholder = placeholderVolunteerName("+919876543210");
    expect(placeholder).toBe("Volunteer 3210");
    expect(hasPlaceholderName(placeholder)).toBe(true);
    expect(hasPlaceholderName("")).toBe(true);
    expect(hasPlaceholderName("Priya Sharma")).toBe(false);
    expect(hasPlaceholderName("Volunteer Corps Leader")).toBe(false);
  });

  it("validates and tidies names", () => {
    expect(validateVolunteerName("  Ravi   Kumar ")).toBe("Ravi Kumar");
    expect(validateVolunteerName("R")).toBeNull();
    expect(validateVolunteerName("x".repeat(81))).toBeNull();
    expect(validateVolunteerName(42)).toBeNull();
  });

  it("maps volunteer types case-insensitively, defaulting to Individual", () => {
    expect(toVolunteerType("ngo")).toBe("NGO");
    expect(toVolunteerType("NDRF")).toBe("NDRF");
    expect(toVolunteerType("astronaut")).toBe("Individual");
    expect(toVolunteerType(undefined)).toBe("Individual");
  });

  it("accepts only integer skill ids", () => {
    expect(isSkillIdList([1, 2, 3])).toBe(true);
    expect(isSkillIdList([])).toBe(true);
    expect(isSkillIdList([1, "2"])).toBe(false);
    expect(isSkillIdList([1.5])).toBe(false);
    expect(isSkillIdList("1,2")).toBe(false);
  });
});

describe("mission updates", () => {
  it("describes each status step", () => {
    expect(missionStatusHeadline("en_route")).toContain("On the way");
    expect(missionStatusHeadline("on_my_way")).toContain("On the way"); // legacy spelling
    expect(missionStatusHeadline("arrived")).toContain("Arrived");
    expect(missionStatusHeadline("completed")).toContain("completed");
    expect(missionStatusHeadline("failed")).toContain("Could not complete");
  });

  it("puts the headline and mission on the first line and the note below", () => {
    expect(formatMissionUpdate("🚗 On the way", "Evacuate ward 4", "  Road blocked  ")).toBe(
      "🚗 On the way · Evacuate ward 4\nRoad blocked"
    );
    expect(formatMissionUpdate(MISSION_NOTE_HEADLINE, "Evacuate ward 4")).toBe(`${MISSION_NOTE_HEADLINE} · Evacuate ward 4`);
    expect(formatMissionUpdate("x", "Evacuate ward 4", "   ")).toBe("x · Evacuate ward 4");
  });

  it("shortens long mission titles", () => {
    const line = formatMissionUpdate("x", "a".repeat(200)).split("\n")[0];
    expect(line.length).toBeLessThan(90);
    expect(line.endsWith("…")).toBe(true);
  });
});
