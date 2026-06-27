import { describe, expect, it } from "vitest";
import { planFromMessage } from "@/lib/ai/mock-agent";

describe("planFromMessage", () => {
  it("selects gmail + drive and builds steps", () => {
    const plan = planFromMessage(
      "show me unread emails and save important ones to drive",
    );
    expect(plan.toolsUsed).toContain("gmail");
    expect(plan.toolsUsed).toContain("drive");
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it("raises a send_email approval when asked to send", () => {
    const plan = planFromMessage("email a summary to bob and send it");
    expect(plan.approval).toBeDefined();
    expect(plan.approval?.actionType).toBe("send_email");
    expect(plan.approval?.status).toBe("pending");
  });

  it("asks for clarification when no tool is implied", () => {
    const plan = planFromMessage("hello there");
    expect(plan.toolsUsed).toHaveLength(0);
    expect(plan.steps).toHaveLength(0);
    expect(plan.approval).toBeUndefined();
    expect(plan.content.toLowerCase()).toContain("which");
  });
});
