import { describe, expect, it } from "vitest";
import { imageDataUrlSchema, paymentProofImagesSchema } from "./validation.js";

const toDataUrl = (mimeType: string, image: Buffer) =>
  `data:${mimeType};base64,${image.toString("base64")}`;

describe("paymentProofImagesSchema", () => {
  it.each([
    [{ receiptDataUrl: "receipt" }, "printed request missing"],
    [{ requestCopyDataUrl: "request copy" }, "cash receipt missing"],
    [{}, "both files missing"],
    [{ receiptDataUrl: " ", requestCopyDataUrl: "request copy" }, "blank receipt"],
  ])("rejects when a required file is missing or blank (%s)", (files) => {
    expect(paymentProofImagesSchema.safeParse(files).success).toBe(false);
  });

  it("accepts both nonblank proof image fields", () => {
    expect(
      paymentProofImagesSchema.safeParse({
        receiptDataUrl: "receipt",
        requestCopyDataUrl: "printed request",
      }).success,
    ).toBe(true);
  });
});

describe("imageDataUrlSchema", () => {
  it.each([
    ["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff])],
    ["image/webp", Buffer.from("RIFF0000WEBP")],
  ])("accepts a valid %s image", (mimeType, image) => {
    expect(imageDataUrlSchema.safeParse(toDataUrl(mimeType, image)).success).toBe(true);
  });

  it("rejects MIME types outside the allowed image formats", () => {
    expect(
      imageDataUrlSchema.safeParse(toDataUrl("application/pdf", Buffer.from("%PDF"))).success,
    ).toBe(false);
  });

  it("rejects image content that does not match the declared MIME type", () => {
    expect(
      imageDataUrlSchema.safeParse(
        toDataUrl("image/png", Buffer.from([0xff, 0xd8, 0xff])),
      ).success,
    ).toBe(false);
  });

  it("rejects decoded images larger than 3 MiB", () => {
    const image = Buffer.alloc(3 * 1024 * 1024 + 1);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image);

    expect(imageDataUrlSchema.safeParse(toDataUrl("image/png", image)).success).toBe(false);
  });
});