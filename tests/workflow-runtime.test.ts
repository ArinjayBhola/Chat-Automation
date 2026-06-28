import { describe, expect, it } from "vitest";
import {
  convertToMs,
  evaluateCondition,
  evaluateConditions,
  getPath,
  resolveParameters,
  resolveValue,
  runTransform,
} from "@/lib/workflows/runtime-helpers";

describe("getPath", () => {
  const vars = { a: { b: { c: 42 } }, list: [1, 2, 3] };
  it("reads nested paths", () => {
    expect(getPath(vars, "a.b.c")).toBe(42);
  });
  it("returns undefined for missing paths", () => {
    expect(getPath(vars, "a.x.y")).toBeUndefined();
    expect(getPath(vars, "")).toBeUndefined();
  });
});

describe("resolveValue / resolveParameters", () => {
  const vars = { name: "Ada", count: 3, user: { email: "ada@x.com" } };
  it("returns the raw typed value for a full reference", () => {
    expect(resolveValue("{{count}}", vars)).toBe(3);
    expect(resolveValue("{{user}}", vars)).toEqual({ email: "ada@x.com" });
  });
  it("substitutes inline references as strings", () => {
    expect(resolveValue("Hi {{name}} ({{user.email}})", vars)).toBe(
      "Hi Ada (ada@x.com)",
    );
  });
  it("passes through non-references and non-strings", () => {
    expect(resolveValue("plain", vars)).toBe("plain");
    expect(resolveValue(7, vars)).toBe(7);
  });
  it("resolves a parameter object", () => {
    expect(
      resolveParameters({ to: "{{user.email}}", subject: "Hello {{name}}" }, vars),
    ).toEqual({ to: "ada@x.com", subject: "Hello Ada" });
  });
});

describe("evaluateCondition", () => {
  it("handles equality loosely", () => {
    expect(evaluateCondition(5, "==", "5")).toBe(true);
    expect(evaluateCondition(5, "!=", 6)).toBe(true);
  });
  it("compares numerically for > and <", () => {
    expect(evaluateCondition("10", ">", "9")).toBe(true);
    expect(evaluateCondition(2, "<", 3)).toBe(true);
  });
  it("supports includes and exists", () => {
    expect(evaluateCondition([1, 2, 3], "includes", 2)).toBe(true);
    expect(evaluateCondition("hello world", "includes", "world")).toBe(true);
    expect(evaluateCondition(null, "exists", null)).toBe(false);
    expect(evaluateCondition("x", "exists", null)).toBe(true);
  });
});

describe("evaluateConditions", () => {
  const vars = { a: 5, b: 0, name: "test" };
  it("combines with AND", () => {
    expect(
      evaluateConditions(
        [
          { variable: "a", operator: ">", value: 3 },
          { variable: "name", operator: "==", value: "test" },
        ],
        "AND",
        vars,
      ),
    ).toBe(true);
  });
  it("combines with OR", () => {
    expect(
      evaluateConditions(
        [
          { variable: "a", operator: "<", value: 1 },
          { variable: "name", operator: "==", value: "test" },
        ],
        "OR",
        vars,
      ),
    ).toBe(true);
  });
  it("empty conditions are vacuously true", () => {
    expect(evaluateConditions([], "AND", vars)).toBe(true);
  });
});

describe("convertToMs", () => {
  it("converts each unit", () => {
    expect(convertToMs(2, "seconds")).toBe(2000);
    expect(convertToMs(1, "minutes")).toBe(60_000);
    expect(convertToMs(1, "hours")).toBe(3_600_000);
    expect(convertToMs(1, "days")).toBe(86_400_000);
  });
  it("clamps negatives to zero", () => {
    expect(convertToMs(-5, "seconds")).toBe(0);
  });
});

describe("runTransform", () => {
  const vars = { emails: [{ unread: true }, { unread: false }], n: 10 };
  it("evaluates expressions against the data bag", () => {
    expect(runTransform("data.emails.filter(e => e.unread).length", vars)).toBe(
      1,
    );
    expect(runTransform("data.n * 2", vars)).toBe(20);
  });
  it("throws on invalid expressions", () => {
    expect(() => runTransform("data.nope.bad.deep()", vars)).toThrow();
  });
});
