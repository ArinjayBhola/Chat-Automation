import type { ConditionOperator } from "@/lib/types/workflow";

/**
 * Pure runtime helpers for the workflow execution engine. These have no I/O and
 * no server-only imports, so they are unit-testable and shared by the executor.
 */

export type Variables = Record<string, unknown>;

/** Read a (possibly nested, dotted) path from the variable bag. */
export function getPath(vars: Variables, path: string): unknown {
  if (!path) return undefined;
  let value: unknown = vars;
  for (const part of path.split(".")) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

const FULL_REF = /^\{\{\s*([^}]+?)\s*\}\}$/;
const INLINE_REF = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Resolve a single value. If it's a string that is exactly `{{path}}` the raw
 * (typed) variable is returned; if it contains inline `{{path}}` references they
 * are substituted as strings. Non-strings pass through unchanged.
 */
export function resolveValue(value: unknown, vars: Variables): unknown {
  if (typeof value !== "string") return value;

  const full = value.match(FULL_REF);
  if (full) return getPath(vars, full[1].trim());

  if (value.includes("{{")) {
    return value.replace(INLINE_REF, (_m, path: string) => {
      const v = getPath(vars, path.trim());
      return v == null ? "" : String(v);
    });
  }
  return value;
}

/** Resolve every value in a parameter object (one level deep). */
export function resolveParameters(
  parameters: Record<string, unknown> | undefined,
  vars: Variables,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameters ?? {})) {
    out[key] = resolveValue(value, vars);
  }
  return out;
}

function toComparable(a: unknown): number | string {
  if (typeof a === "number") return a;
  const n = Number(a);
  return Number.isFinite(n) && a !== "" && a != null ? n : String(a);
}

/** Evaluate a single comparison. */
export function evaluateCondition(
  value: unknown,
  operator: ConditionOperator,
  expected: unknown,
): boolean {
  switch (operator) {
    case "==":
      // Intentionally loose, mirroring user expectations ("5" == 5).
      // eslint-disable-next-line eqeqeq
      return value == expected;
    case "!=":
      // eslint-disable-next-line eqeqeq
      return value != expected;
    case ">":
      return toComparable(value) > toComparable(expected);
    case "<":
      return toComparable(value) < toComparable(expected);
    case "includes":
      if (Array.isArray(value)) return value.includes(expected);
      if (typeof value === "string") return value.includes(String(expected));
      return false;
    case "exists":
      return value !== null && value !== undefined && value !== "";
    default:
      return false;
  }
}

export interface RuntimeCondition {
  variable: string;
  operator: ConditionOperator;
  value: unknown;
}

/** Evaluate a list of conditions combined with AND/OR. */
export function evaluateConditions(
  conditions: RuntimeCondition[],
  combineWith: "AND" | "OR",
  vars: Variables,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  const results = conditions.map((c) =>
    evaluateCondition(getPath(vars, c.variable), c.operator, c.value),
  );
  return combineWith === "OR"
    ? results.some(Boolean)
    : results.every(Boolean);
}

/** Convert a duration + unit into milliseconds. */
export function convertToMs(
  duration: number,
  unit: "seconds" | "minutes" | "hours" | "days",
): number {
  const factors: Record<string, number> = {
    seconds: 1000,
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
  };
  return Math.max(0, duration) * (factors[unit] ?? 1000);
}

/**
 * Evaluate a transform expression against the variable bag. The expression runs
 * in a constrained scope (no access to `globalThis`, `require`, `process`, etc.)
 * with a curated set of safe globals. Throws if the expression errors.
 */
export function runTransform(expression: string, vars: Variables): unknown {
  const scope = {
    data: vars,
    vars,
    Math,
    JSON,
    Date,
    Array,
    String,
    Number,
    Boolean,
    Object,
  };
  const fn = new Function(
    ...Object.keys(scope),
    `"use strict"; return ( ${expression} );`,
  );
  return fn(...Object.values(scope));
}
