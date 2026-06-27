import { describe, expect, it } from "vitest";
import { OP_TOOL, type ApprovalOp } from "@/lib/agent/ops";

describe("OP_TOOL mapping", () => {
  const cases: [ApprovalOp, string][] = [
    ["gmail.send", "gmail"],
    ["calendar.create", "calendar"],
    ["docs.create", "docs"],
    ["docs.append", "docs"],
    ["notion.create", "notion"],
    ["notion.update", "notion"],
  ];

  it.each(cases)("%s maps to %s", (op, tool) => {
    expect(OP_TOOL[op]).toBe(tool);
  });
});
