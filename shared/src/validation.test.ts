import { describe, expect, it } from "vitest";
import { createEmptyDraft } from "./place";
import { normalizeUrl, toNormalizedPlaceRecord, validateDraft } from "./validation";

describe("validation", () => {
  it("normalizes URLs by adding https", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("validates required fields", () => {
    const draft = createEmptyDraft();
    expect(validateDraft(draft)).toEqual([
      "name is required",
      "address is required",
      "google_maps_url is required"
    ]);
  });

  it("creates an approved normalized record", () => {
    const draft = createEmptyDraft();
    draft.name = "Example Coffee";
    draft.address = "1 Example Street";
    draft.google_maps_url = "https://maps.google.com/example";
    const record = toNormalizedPlaceRecord(draft);
    expect(record.approval).toBe(true);
    expect(record.name).toBe("Example Coffee");
  });

  it("validates opening_hours values as strings", () => {
    const draft = createEmptyDraft();
    draft.name = "Example Coffee";
    draft.address = "1 Example Street";
    draft.google_maps_url = "https://maps.google.com/example";
    draft.opening_hours = { monday: 123 as unknown as string };
    expect(validateDraft(draft)).toEqual(["opening_hours.monday must be a string"]);
  });
});
