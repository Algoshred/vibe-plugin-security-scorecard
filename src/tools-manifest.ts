/**
 * OpenSSF Scorecard manifest. v5.0.0 ships prebuilt linux + darwin
 * binaries at https://github.com/ossf/scorecard/releases/tag/v5.0.0
 *
 * sha256 values pinned from
 *   https://github.com/ossf/scorecard/releases/download/v5.0.0/scorecard_checksums.txt
 *
 * Updating the version is a deliberate audited operation: bump the
 * version + sha256 here, re-run sanity, publish a new CalVer release.
 */
import type { ToolManifest } from "@vibecontrols/vibe-plugin-security/tool-installer";

export const SCORECARD_VERSION = "5.0.0";

export const TOOLS_MANIFEST: ToolManifest = {
  scorecard: {
    version: SCORECARD_VERSION,
    binaryName: "scorecard",
    versionMatcher: SCORECARD_VERSION.replace(/\./g, "\\."),
    downloads: {
      "linux-x64": {
        url: `https://github.com/ossf/scorecard/releases/download/v${SCORECARD_VERSION}/scorecard_${SCORECARD_VERSION}_linux_amd64.tar.gz`,
        sha256: "c2c66209330afe53d2e5457f4834d73cae480ffad76cfedde8186c3862205962",
        binaryWithinArchive: "scorecard",
        archive: "tar.gz",
      },
      "linux-arm64": {
        url: `https://github.com/ossf/scorecard/releases/download/v${SCORECARD_VERSION}/scorecard_${SCORECARD_VERSION}_linux_arm64.tar.gz`,
        sha256: "963bd6161168c6b4a43af523062e19473aa655d3521148bc94a1119e91e5ecf4",
        binaryWithinArchive: "scorecard",
        archive: "tar.gz",
      },
      "darwin-x64": {
        url: `https://github.com/ossf/scorecard/releases/download/v${SCORECARD_VERSION}/scorecard_${SCORECARD_VERSION}_darwin_amd64.tar.gz`,
        sha256: "98fa698ece014519e3e4ffd206c629b4d8f1ef2c816aac262092367f3be52712",
        binaryWithinArchive: "scorecard",
        archive: "tar.gz",
      },
      "darwin-arm64": {
        url: `https://github.com/ossf/scorecard/releases/download/v${SCORECARD_VERSION}/scorecard_${SCORECARD_VERSION}_darwin_arm64.tar.gz`,
        sha256: "39e6f6c0d60b2fac832eda1ffb0ea75624c8fc06e41089a75635ac88faa3fada",
        binaryWithinArchive: "scorecard",
        archive: "tar.gz",
      },
    },
  },
};
