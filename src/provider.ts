/**
 * OpenssfScorecardProvider — implements SecurityProvider for stage
 * `main.merge`.
 *
 * Spawns the pinned OpenSSF Scorecard binary with `--format json`,
 * normalises each per-check entry whose score < 7 into a
 * NormalizedFinding (category: "policy"), and returns the full JSON
 * payload as an evidence artifact.
 *
 * Behaviour:
 *   - If `GITHUB_TOKEN` (or `GH_TOKEN`) is present in the agent host
 *     env, runs the full online check set via `--repo <url>`.
 *   - Otherwise runs the offline subset via `--local <repoLocalPath>`.
 *
 * SSH-style repo URLs (`git@github.com:foo/bar.git`) are normalised to
 * the `github.com/foo/bar` form Scorecard expects.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";

import type { HostServices } from "@vibecontrols/plugin-sdk/contract";
import { resolveToolPath } from "@vibecontrols/vibe-plugin-security/tool-installer";
import type {
  NormalizedFinding,
  ScanEvidenceArtifact,
  SecurityProvider,
  SecurityProviderMetadata,
  SecurityScanInput,
  SecurityScanResult,
  SecurityScanSummary,
  SecuritySeverity,
  SecurityStage,
} from "@vibecontrols/vibe-plugin-security/types";

import { SCORECARD_VERSION, TOOLS_MANIFEST } from "./tools-manifest.js";

interface ScorecardCheckDocumentation {
  short?: string;
  url?: string;
}

interface ScorecardCheck {
  name: string;
  score: number;
  reason?: string;
  details?: string[];
  documentation?: ScorecardCheckDocumentation;
}

interface ScorecardJson {
  date?: string;
  repo?: { name?: string; commit?: string };
  scorecard?: { version?: string };
  score?: number;
  checks?: ScorecardCheck[];
}

export class ScorecardProvider implements SecurityProvider {
  readonly name = "openssf-scorecard";
  readonly stage: SecurityStage = "main.merge";
  readonly toolVersion = `scorecard@${SCORECARD_VERSION}`;

  private host?: HostServices;
  private toolPath?: string;
  private active = new Map<string, ChildProcess>();

  async init(host: HostServices): Promise<void> {
    this.host = host;
  }

  async ensureToolInstalled(): Promise<void> {
    const dataDir =
      this.host?.getDataDir?.() ?? path.join(process.env.HOME ?? ".", ".boff/vibecontrols");
    this.toolPath = await resolveToolPath(
      {
        dataDir,
        log: {
          info: (m) => this.host?.logger?.info?.("openssf-scorecard-provider", m),
          warn: (m) => this.host?.logger?.warn?.("openssf-scorecard-provider", m),
          error: (m) => this.host?.logger?.error?.("openssf-scorecard-provider", m),
        },
      },
      "scorecard",
      TOOLS_MANIFEST.scorecard,
    );
  }

  async run(input: SecurityScanInput): Promise<SecurityScanResult> {
    if (!this.toolPath) {
      await this.ensureToolInstalled();
    }
    if (!this.toolPath) throw new Error("openssf-scorecard-provider: toolPath unavailable");

    const startedAt = Date.now();
    input.onProgress?.({ pct: 5, message: "Starting Scorecard scan" });

    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    const normalizedRepo = normalizeRepoUrl(input.repoUrl);
    const args: string[] =
      token && normalizedRepo
        ? ["--repo", normalizedRepo, "--format", "json"]
        : ["--local", input.repoLocalPath, "--format", "json"];

    const result = await this.spawnAndWait(input.runId, args);
    if (result.code !== 0) {
      return {
        runId: input.runId,
        status: "errored",
        findings: [],
        evidence: [],
        durationMs: Date.now() - startedAt,
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        errorReason: `scorecard exited ${result.code}: ${result.stderr.slice(0, 500)}`,
      };
    }

    input.onProgress?.({ pct: 80, message: "Parsing Scorecard JSON" });

    let findings: NormalizedFinding[] = [];
    let evidence: ScanEvidenceArtifact[] = [];
    try {
      const parsed = JSON.parse(result.stdout) as ScorecardJson;
      findings = normalizeScorecard(parsed, normalizedRepo ?? input.repoUrl);

      const jsonPath = path.join(input.workdir, "scorecard.json");
      await fs.writeFile(jsonPath, result.stdout, "utf-8");
      const sha256 = createHash("sha256").update(result.stdout).digest("hex");
      const stat = await fs.stat(jsonPath);
      evidence = [
        {
          // TODO: a dedicated `scorecard-json` evidence type does not exist in the
          // shared meta yet — reuse `opa-decision` (policy-shaped JSON) until it does.
          type: "opa-decision",
          localPath: jsonPath,
          sha256,
          sizeBytes: stat.size,
        },
      ];
    } catch (err) {
      this.host?.logger?.warn?.(
        "openssf-scorecard-provider",
        `failed to parse Scorecard JSON: ${String(err)}`,
      );
    }

    input.onProgress?.({ pct: 100, message: "Scan complete" });
    const summary: SecurityScanSummary = summarize(findings);

    return {
      runId: input.runId,
      status: "succeeded",
      findings,
      evidence,
      durationMs: Date.now() - startedAt,
      summary,
    };
  }

  async cancel(runId: string): Promise<void> {
    const child = this.active.get(runId);
    if (!child) return;
    try {
      child.kill("SIGTERM");
      // Best-effort SIGKILL after 5s.
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }, 5000);
    } finally {
      this.active.delete(runId);
    }
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

  private spawnAndWait(
    runId: string,
    args: string[],
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    if (!this.toolPath) throw new Error("openssf-scorecard-provider: toolPath unavailable");
    return new Promise((resolve) => {
      const child = spawn(this.toolPath as string, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.active.set(runId, child);
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (b: Buffer) => (stdout += b.toString()));
      child.stderr?.on("data", (b: Buffer) => (stderr += b.toString()));
      child.on("close", (code) => {
        this.active.delete(runId);
        resolve({ code, stdout, stderr });
      });
      child.on("error", (err) => {
        this.active.delete(runId);
        resolve({ code: -1, stdout, stderr: err.message });
      });
    });
  }
}

// Back-compat alias: prior to the real implementation the class was
// exported as `OpenssfScorecardProvider`. Keep the old name available so
// downstream consumers don't break on the version bump.
export { ScorecardProvider as OpenssfScorecardProvider };

function summarize(findings: NormalizedFinding[]): SecurityScanSummary {
  const s: SecurityScanSummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) s[f.severity]++;
  return s;
}

function severityForScore(score: number): SecuritySeverity {
  if (score < 3) return "high";
  if (score < 5) return "medium";
  return "low";
}

/**
 * Normalises a `repoUrl` from the scan input into the
 * `github.com/owner/repo` form that the Scorecard CLI accepts.
 *
 * Accepts:
 *   - `https://github.com/foo/bar` / `https://github.com/foo/bar.git`
 *   - `git@github.com:foo/bar.git`
 *   - `github.com/foo/bar`
 *
 * Returns `undefined` if no recognisable shape can be derived (callers
 * will fall back to `--local`).
 */
function normalizeRepoUrl(repoUrl: string | undefined): string | undefined {
  if (!repoUrl) return undefined;
  let url = repoUrl.trim();
  if (!url) return undefined;

  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  url = url.replace(/^https?:\/\//, "");
  url = url.replace(/\.git$/, "");
  url = url.replace(/\/+$/, "");
  return url || undefined;
}

function normalizeScorecard(parsed: ScorecardJson, repoUrl: string): NormalizedFinding[] {
  if (!parsed.checks || !Array.isArray(parsed.checks)) return [];
  const findings: NormalizedFinding[] = [];
  for (const check of parsed.checks) {
    if (typeof check.score !== "number" || check.score >= 7) continue;
    const severity = severityForScore(check.score);
    const ruleId = `scorecard.${check.name.toLowerCase().replace(/_/g, "-")}`;
    const fingerprint = createHash("sha256")
      .update(`scorecard:${check.name}:${repoUrl}`)
      .digest("hex");
    findings.push({
      fingerprint,
      ruleId,
      title: `Scorecard: ${check.name} = ${check.score}/10`,
      severity,
      category: "policy",
      description: check.reason,
      remediation: check.documentation?.url ?? check.documentation?.short,
      rawProviderRef: JSON.stringify(check),
    });
  }
  return findings;
}
