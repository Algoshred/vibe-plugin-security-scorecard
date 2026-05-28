import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ScorecardProvider } from "../src/provider.js";
import { SCORECARD_VERSION } from "../src/tools-manifest.js";

describe("ScorecardProvider", () => {
  test("provider name + stage are stable identifiers", () => {
    const p = new ScorecardProvider();
    expect(p.name).toBe("openssf-scorecard");
    expect(p.stage).toBe("main.merge");
  });

  test("metadata() reports stage + supported profiles + tool version", () => {
    const p = new ScorecardProvider();
    const meta = p.metadata();
    expect(meta.stage).toBe("main.merge");
    expect(meta.supportedProfiles).toContain("backend");
    expect(meta.supportedProfiles).toContain("frontend");
    expect(meta.toolVersion).toBe(`scorecard@${SCORECARD_VERSION}`);
    expect(p.toolVersion).toBe(`scorecard@${SCORECARD_VERSION}`);
  });

  test("cancel() on an unknown run is a no-op", async () => {
    const p = new ScorecardProvider();
    await expect(p.cancel("nonexistent")).resolves.toBeUndefined();
  });

  describe("with a fake scorecard binary", () => {
    let workTmp: string;
    let dataDir: string;
    let scorecardBin: string;
    let originalToken: string | undefined;
    let originalGhToken: string | undefined;

    beforeEach(async () => {
      // Build a tmp data dir matching the resolveToolPath cache layout:
      //   <dataDir>/tools/scorecard/<version>/scorecard
      workTmp = await fs.mkdtemp(path.join(tmpdir(), "scorecard-test-"));
      dataDir = path.join(workTmp, "data");
      const binDir = path.join(dataDir, "tools", "scorecard", SCORECARD_VERSION);
      await fs.mkdir(binDir, { recursive: true });
      scorecardBin = path.join(binDir, "scorecard");

      // Fake scorecard: emit a single low-score check on stdout, exit 0.
      const script = [
        "#!/usr/bin/env bash",
        "cat <<'JSON'",
        JSON.stringify({
          date: "2026-05-28",
          repo: { name: "github.com/test/repo", commit: "deadbeef" },
          scorecard: { version: `v${SCORECARD_VERSION}` },
          score: 4.5,
          checks: [
            {
              name: "Branch-Protection",
              score: 2,
              reason: "branch protection is not enabled on the default branch",
              details: ["dep1", "dep2"],
              documentation: {
                short: "Determines if the default branch is protected.",
                url: "https://github.com/ossf/scorecard/blob/main/docs/checks.md#branch-protection",
              },
            },
            {
              name: "Code-Review",
              score: 8,
              reason: "OK",
              documentation: { url: "https://example.com" },
            },
          ],
        }),
        "JSON",
        "",
      ].join("\n");
      await fs.writeFile(scorecardBin, script, "utf-8");
      await fs.chmod(scorecardBin, 0o755);

      originalToken = process.env.GITHUB_TOKEN;
      originalGhToken = process.env.GH_TOKEN;
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;
    });

    afterEach(async () => {
      if (originalToken !== undefined) process.env.GITHUB_TOKEN = originalToken;
      else delete process.env.GITHUB_TOKEN;
      if (originalGhToken !== undefined) process.env.GH_TOKEN = originalGhToken;
      else delete process.env.GH_TOKEN;
      await fs.rm(workTmp, { recursive: true, force: true });
    });

    test("normalises one low-score check into one high-severity finding", async () => {
      // Pre-flight: sanity-check that bash + the fake binary actually work in
      // this environment. If not, skip rather than fail (CI minimalism).
      const probe = await new Promise<number | null>((resolve) => {
        const c = spawn(scorecardBin, [], { stdio: "ignore" });
        c.on("close", (code) => resolve(code));
        c.on("error", () => resolve(-1));
      });
      if (probe !== 0) {
        // bash not available or exec failed; nothing meaningful to test.
        return;
      }

      const p = new ScorecardProvider();
      await p.init({
        getDataDir: () => dataDir,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        // unused fields are not part of the contract this test exercises.
      } as unknown as Parameters<typeof p.init>[0]);

      // Short-circuit resolveToolPath: the pinned manifest sha256 is
      // a placeholder (all zeros), so the real cache probe would reject
      // the fake binary and try to download. Inject the path directly
      // — production callers always hit ensureToolInstalled() first.
      (p as unknown as { toolPath: string }).toolPath = scorecardBin;

      const workdir = await fs.mkdtemp(path.join(workTmp, "workdir-"));
      const result = await p.run({
        runId: "test-run-1",
        vibeId: "vibe-1",
        workspaceId: "ws-1",
        repoUrl: "https://github.com/test/repo.git",
        repoLocalPath: workTmp,
        commit: "deadbeef",
        stage: "main.merge",
        profile: { kind: "backend", languages: ["ts"], runtimes: ["bun"] },
        policyLevel: "advisory",
        config: {},
        workdir,
      });

      expect(result.status).toBe("succeeded");
      expect(result.findings).toHaveLength(1);
      const finding = result.findings[0];
      expect(finding.severity).toBe("high");
      expect(finding.category).toBe("policy");
      expect(finding.ruleId).toBe("scorecard.branch-protection");
      expect(finding.title).toContain("Branch-Protection");
      expect(finding.title).toContain("2/10");
      expect(finding.remediation).toContain("branch-protection");
      expect(result.evidence).toHaveLength(1);
      expect(result.evidence[0].type).toBe("opa-decision");
      expect(result.summary).toEqual({ critical: 0, high: 1, medium: 0, low: 0, info: 0 });
    });
  });
});
