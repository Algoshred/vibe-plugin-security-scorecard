/**
 * OpenssfScorecardProvider — implements SecurityProvider for stage
 * `main.merge`. Runs `scorecard --repo file://<path>` for offline
 * checks (branch protection seen in .git config, license file, CI
 * tests detected via .github/workflows/*) and `--repo <url>` when
 * GH_TOKEN is present in the agent host env, for the full check set.
 *
 * TODO: Wave 2 scaffold — real scorecard integration is pending. This
 * v1 verifies the tool path resolves and returns a single info finding
 * describing what a real run would surface.
 */
import { createHash } from "node:crypto";
import * as path from "node:path";

import type { HostServices } from "@vibecontrols/plugin-sdk/contract";
import { resolveToolPath } from "@vibecontrols/vibe-plugin-security/tool-installer";
import type {
  NormalizedFinding,
  SecurityProvider,
  SecurityProviderMetadata,
  SecurityScanInput,
  SecurityScanResult,
  SecurityScanSummary,
  SecurityStage,
} from "@vibecontrols/vibe-plugin-security/types";

import { SCORECARD_VERSION, TOOLS_MANIFEST } from "./tools-manifest.js";

export class OpenssfScorecardProvider implements SecurityProvider {
  readonly name = "openssf-scorecard";
  readonly stage: SecurityStage = "main.merge";
  readonly toolVersion = `scorecard@${SCORECARD_VERSION}`;

  private host?: HostServices;
  private scorecardPath?: string;

  async init(host: HostServices): Promise<void> {
    this.host = host;
  }

  async ensureToolInstalled(): Promise<void> {
    const dataDir =
      this.host?.getDataDir?.() ?? path.join(process.env.HOME ?? ".", ".boff/vibecontrols");
    const ctx = {
      dataDir,
      log: {
        info: (m: string) => this.host?.logger?.info?.("openssf-scorecard-provider", m),
        warn: (m: string) => this.host?.logger?.warn?.("openssf-scorecard-provider", m),
        error: (m: string) => this.host?.logger?.error?.("openssf-scorecard-provider", m),
      },
    };
    this.scorecardPath = await resolveToolPath(ctx, "scorecard", TOOLS_MANIFEST.scorecard);
  }

  async run(input: SecurityScanInput): Promise<SecurityScanResult> {
    const startedAt = Date.now();
    input.onProgress?.({ pct: 10, message: "Verifying scorecard tool path" });

    try {
      if (!this.scorecardPath) {
        await this.ensureToolInstalled();
      }
    } catch (err) {
      return {
        runId: input.runId,
        status: "errored",
        findings: [],
        evidence: [],
        durationMs: Date.now() - startedAt,
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        errorReason: `openssf-scorecard: tool resolution failed: ${String(err)}`,
      };
    }

    input.onProgress?.({ pct: 100, message: "Stub finding emitted" });

    const fingerprint = createHash("sha256").update(`${this.name}:${input.runId}`).digest("hex");

    const finding: NormalizedFinding = {
      fingerprint,
      ruleId: `${this.name}.stub`,
      title: "main.merge: openssf-scorecard scaffolded — real scanner integration pending",
      severity: "info",
      category: "policy",
      description:
        "Wave 2 scaffold: when integrated, this provider will run `scorecard --repo file://<repoLocalPath>` for offline checks (Binary-Artifacts, License, Maintained, Pinned-Dependencies, Token-Permissions, CI-Tests detected via .github/workflows) and switch to `--repo <repoUrl>` when GH_TOKEN is present on the agent host to unlock the full check set (Branch-Protection, Signed-Releases, Code-Review, Vulnerabilities, Dependency-Update-Tool, SAST, Fuzzing, Security-Policy, Webhooks). Score-card JSON will be returned as evidence; per-check findings will normalize to category `policy` with severity derived from score. See src/provider.ts TODO.",
      rawProviderRef: JSON.stringify({
        stub: true,
        message: `Real scorecard integration pending; tool path resolves to ${
          this.scorecardPath ?? "<unresolved>"
        }.`,
        scorecardVersion: SCORECARD_VERSION,
      }),
    };

    const summary: SecurityScanSummary = { critical: 0, high: 0, medium: 0, low: 0, info: 1 };

    return {
      runId: input.runId,
      status: "succeeded",
      findings: [finding],
      evidence: [],
      durationMs: Date.now() - startedAt,
      summary,
    };
  }

  async cancel(_runId: string): Promise<void> {
    // Stub provider has no in-flight subprocesses to cancel.
  }

  metadata(): SecurityProviderMetadata {
    return {
      stage: this.stage,
      supportedProfiles: [
        "backend",
        "frontend",
        "cli",
        "sdk",
        "mcp",
        "chrome-extension",
        "vscode-extension",
      ],
      toolVersion: this.toolVersion,
      description: "OpenSSF Scorecard checks for main.merge",
    };
  }
}
