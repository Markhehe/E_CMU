import { describe, expect, it } from "vitest";
import { requiresStudentLoginVerification } from "./login-policy.js";

describe("student login verification policy", () => {
    it("requires verification for student accounts", () => {
        expect(requiresStudentLoginVerification(["student"])).toBe(true);
    });

    it("does not require verification for registrar staff or admins", () => {
        for (const role of ["registrar", "registrar_staff", "admin", "administrator"]) {
            expect(requiresStudentLoginVerification([role])).toBe(false);
            expect(requiresStudentLoginVerification(["student", role])).toBe(false);
        }
    });

    it("does not require student verification for unrelated roles", () => {
        expect(requiresStudentLoginVerification(["professor"])).toBe(false);
    });
});
