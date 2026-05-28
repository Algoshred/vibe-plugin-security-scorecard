/**
 * OpenSSF Scorecard manifest. v5.0.0 ships prebuilt linux + darwin
 * binaries at https://github.com/ossf/scorecard/releases/tag/v5.0.0
 *
 * TODO: backfill real sha256 values from the upstream
 * scorecard_5.0.0_checksums.txt before promoting this plugin out of
 * scaffold status.
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
        sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        binaryWithinArchive: "scorecard",
        archive: "tar.gz",
      },
      "linux-arm64": {
        url: `https://github.com/ossf/scorecard/releases/download/v${SCORECARD_VERSION}/scorecard_${SCORECARD_VERSION}_linux_arm64.tar.gz`,
        sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        binaryWithinArchive: "scorecard",
        archive: "tar.gz",
      },
      "darwin-x64": {
        url: `https://github.com/ossf/scorecard/releases/download/v${SCORECARD_VERSION}/scorecard_${SCORECARD_VERSION}_darwin_amd64.tar.gz`,
        sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        binaryWithinArchive: "scorecard",
        archive: "tar.gz",
      },
      "darwin-arm64": {
        url: `https://github.com/ossf/scorecard/releases/download/v${SCORECARD_VERSION}/scorecard_${SCORECARD_VERSION}_darwin_arm64.tar.gz`,
        sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        binaryWithinArchive: "scorecard",
        archive: "tar.gz",
      },
    },
  },
};
