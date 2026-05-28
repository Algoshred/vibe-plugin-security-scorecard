/**
 * @vibecontrols/vibe-plugin-security-scorecard
 *
 * OpenSSF Scorecard provider for main.merge. Registers as a
 * `security.scorecard` provider with @vibecontrols/vibe-plugin-security
 * on the host's ServiceRegistry. When the user picks
 * "openssf-scorecard" as their default provider for the `main.merge`
 * stage, the security meta plugin dispatches scan runs to this provider.
 */
import { ProviderRegistry, TelemetryEmitter, createLifecycleHooks } from "@vibecontrols/plugin-sdk";
import type {
  HostServices,
  ProfileContext,
  VibePlugin,
  VibePluginFactory,
} from "@vibecontrols/plugin-sdk/contract";

import { ScorecardProvider } from "./provider.js";

const PLUGIN_NAME = "security-scorecard";
const PLUGIN_VERSION = "2026.528.4";

export const createPlugin: VibePluginFactory = (_ctx: ProfileContext): VibePlugin => {
  const provider = new ScorecardProvider();
  const telemetry = new TelemetryEmitter(PLUGIN_NAME, PLUGIN_VERSION);

  const lifecycle = createLifecycleHooks({
    name: PLUGIN_NAME,
    telemetryEventName: "security.scorecard.ready",
    onInit: async (host: HostServices) => {
      await provider.init(host);
      const registry = new ProviderRegistry(host);
      registry.registerProvider("security.scorecard", "openssf-scorecard", provider);
      telemetry.emit("security.scorecard.registered", {
        provider: "openssf-scorecard",
        toolVersion: provider.toolVersion,
      });
    },
  });

  return {
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: "OpenSSF Scorecard checks at the main.merge lifecycle stage.",
    tags: ["backend", "provider", "integration"],
    capabilities: {
      storage: "rw",
      subprocess: true,
      audit: true,
      telemetry: true,
    },
    onServerStart: lifecycle.onServerStart,
    onServerStop: lifecycle.onServerStop,
  };
};

export default createPlugin;
export { ScorecardProvider, OpenssfScorecardProvider } from "./provider.js";
