import { describe, expect, test } from "bun:test";

import { OpenssfScorecardProvider } from "../src/provider.js";
import { SCORECARD_VERSION } from "../src/tools-manifest.js";

describe("OpenssfScorecardProvider", () => {
  test("provider name + stage are stable identifiers", () => {
    const p = new OpenssfScorecardProvider();
    expect(p.name).toBe("openssf-scorecard");
    expect(p.stage).toBe("main.merge");
  });

  test("metadata() reports stage + supported profiles + tool version", () => {
    const p = new OpenssfScorecardProvider();
    const meta = p.metadata();
    expect(meta.stage).toBe("main.merge");
    expect(meta.supportedProfiles).toContain("backend");
    expect(meta.supportedProfiles).toContain("frontend");
    expect(meta.toolVersion).toBe(`scorecard@${SCORECARD_VERSION}`);
    expect(p.toolVersion).toBe(`scorecard@${SCORECARD_VERSION}`);
  });

  test("cancel() on an unknown run is a no-op", async () => {
    const p = new OpenssfScorecardProvider();
    await expect(p.cancel("nonexistent")).resolves.toBeUndefined();
  });
});
