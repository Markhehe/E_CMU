import { describe, expect, it } from "vitest";
import {
  studentDirectoryRecordSchema,
  studentIdPrefixSchema,
} from "./directory-routes.js";

describe("student directory record validation", () => {
  it("accepts valid records and normalizes an empty middle name", () => {
    expect(studentDirectoryRecordSchema.parse({
      studentId: "20230554",
      firstName: "Mark",
      middleName: "",
      lastName: "E",
      birthdate: "2004-05-23",
    })).toEqual({
      studentId: "20230554",
      firstName: "Mark",
      middleName: null,
      lastName: "E",
      birthdate: "2004-05-23",
    });
  });

  it("rejects invalid and non-ISO birthdates", () => {
    for (const birthdate of ["2004-02-30", "05/23/2004", "2004-5-23"]) {
      expect(studentDirectoryRecordSchema.safeParse({
        studentId: "20230554",
        firstName: "Mark",
        lastName: "E",
        birthdate,
      }).success).toBe(false);
    }
  });

  it("accepts exactly four digits for bulk account suspension", () => {
    expect(studentIdPrefixSchema.safeParse("2023").success).toBe(true);
    for (const prefix of ["202", "20230", "20A3", " 2023"]) {
      expect(studentIdPrefixSchema.safeParse(prefix).success).toBe(false);
    }
  });
});
