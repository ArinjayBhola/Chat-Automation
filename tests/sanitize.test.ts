import { describe, expect, it } from "vitest";
import { sanitizeLine, sanitizeMessage } from "@/lib/sanitize";

const CTRL = String.fromCharCode(1); // a C0 control character

describe("sanitizeMessage", () => {
  it("trims and preserves normal text", () => {
    expect(sanitizeMessage("  hello world  ")).toBe("hello world");
  });

  it("strips control characters but keeps newlines and tabs", () => {
    const input = `a${CTRL}bc\nd\te`;
    expect(sanitizeMessage(input)).toBe("abc\nd\te");
  });

  it("collapses excessive blank lines", () => {
    expect(sanitizeMessage("a\n\n\n\n\nb")).toBe("a\n\n\nb");
  });

  it("caps length at 8000 chars", () => {
    expect(sanitizeMessage("x".repeat(9000)).length).toBe(8000);
  });
});

describe("sanitizeLine", () => {
  it("collapses internal whitespace", () => {
    expect(sanitizeLine("  to   me\tnow ")).toBe("to me now");
  });
});
