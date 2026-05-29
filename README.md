# @vibecontrols/vibe-plugin-security-scorecard

<!-- VIBECONTROLS_OSS_HEADER_START -->

> **License**: MIT — see [LICENSE](./LICENSE).
> **Note**: This plugin is open source. The `@vibecontrols/agent` runtime that loads it is **not** open source — it is a proprietary product of Burdenoff Consultancy Services Pvt. Ltd. See [vibecontrols.com](https://vibecontrols.com) for the agent.

<!-- VIBECONTROLS_OSS_HEADER_END -->

`@vibecontrols/vibe-plugin-security-scorecard` serves the `main.merge` lifecycle stage. It registers itself with [`@vibecontrols/vibe-plugin-security`](https://www.npmjs.com/package/@vibecontrols/vibe-plugin-security) under the per-stage provider type `security.scorecard` and the provider name `openssf-scorecard`. It wraps the [OpenSSF Scorecard](https://github.com/ossf/scorecard) checks — running offline against a local clone for the file-only checks, and switching to the remote repo URL when `GH_TOKEN` is available on the agent host so the full check set runs (branch protection, signed commits, CI tests, etc.).

Wave 2 scaffold — real tool integration is pending; see `src/provider.ts` TODO.

## Install

```bash
vibe plugin install @vibecontrols/vibe-plugin-security-scorecard
vibe security providers set-default --stage main.merge --provider openssf-scorecard
```

The scorecard binary is downloaded automatically on first use (sha256-verified per platform) into `~/.boff/vibecontrols/agents/<profile>/tools/scorecard/`.

## Behavior (planned)

Offline mode (no `GH_TOKEN`):

- `scorecard --repo file://<repoLocalPath> --format json` — runs the file-only checks: Binary-Artifacts, License, Maintained, Pinned-Dependencies, Token-Permissions, CI-Tests (detected via `.github/workflows/*`).

Online mode (`GH_TOKEN` set):

- `scorecard --repo <repoUrl> --format json` — runs the full check set: Branch-Protection, Signed-Releases, Code-Review, Vulnerabilities, Dependency-Update-Tool, SAST, Fuzzing, Security-Policy, Webhooks.

Per-check findings are normalized to `category: "policy"` with severity derived from the score (0-3 = `high`, 4-6 = `medium`, 7-8 = `low`, 9-10 = `info`). The raw scorecard JSON is returned as evidence.

## Configuration

Per-vibe config (stored in `RepositorySecurityConfig.pluginAssignments["main.merge"].config`):

```yaml
provider: openssf-scorecard
config:
  checks: [] # subset of scorecard checks to run; empty = all
  online: auto # auto = use GH_TOKEN if present; force-offline / force-online overrides
```

<!-- VIBECONTROLS_OSS_FOOTER_START -->

---

## License

Released under the [MIT License](./LICENSE).

Copyright (c) 2026 Burdenoff Consultancy Services Private Limited, Algoshred Technologies Private Limited, and all its sister companies.

Maintainer: **Vignesh T.V** — <https://github.com/tvvignesh>

## Credits

This plugin builds on the following upstream open-source projects. All trademarks and copyrights remain with their respective owners.

- **OpenSSF Scorecard** — <https://github.com/ossf/scorecard>

## About VibeControls

**VibeControls** is the agentic engineering mission control for AI-native teams. Vibe-plugins extend the VibeControls agent with new providers, tools, sessions, tunnels, storage backends, and security stages.

- Website: <https://vibecontrols.com>
- Documentation: <https://docs.vibecontrols.com>
- Plugin SDK: <https://github.com/algoshred/vibecontrols-plugin-sdk>
- All plugins: <https://github.com/algoshred?q=vibe-plugin-&type=all>

## Important: agent is not open source

The `@vibecontrols/agent` runtime that loads and orchestrates these plugins is **closed source** and proprietary to Burdenoff Consultancy Services Pvt. Ltd. Only the plugin contract and the plugins themselves are released under MIT. If you want a fully self-hostable agent, please open an issue or contact the maintainer.

<!-- VIBECONTROLS_OSS_FOOTER_END -->
