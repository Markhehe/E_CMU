import { describe, expect, it } from "vitest";
import { canUpdateAssignedRequest } from "./request-ownership.js";

describe("request assignment access", () => {
  it("allows the assigned staff member and blocks other staff", () => {
    expect(canUpdateAssignedRequest(12, "processing", 12, false)).toBe(true);
    expect(canUpdateAssignedRequest("12", "processing", 13, false)).toBe(false);
  });

  it("allows any staff member to take over unassigned requests, including overdue ones", () => {
    expect(canUpdateAssignedRequest(12, "overdue", 13, false)).toBe(false);
    expect(canUpdateAssignedRequest(null, "processing", 13, false)).toBe(true);
    expect(canUpdateAssignedRequest(null, "overdue", 13, false)).toBe(true);
  });

  it("allows registrar admins to override assignment", () => {
    expect(canUpdateAssignedRequest(12, "processing", 13, true)).toBe(true);
  });
});
