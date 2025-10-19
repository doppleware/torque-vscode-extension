/**
 * Setup and Configuration Domain
 *
 * Handles extension configuration, settings management, and first-time setup.
 */

export { SettingsManager } from "./SettingsManager";
export { registerSetupCommand } from "./commands/setupCommand";
export { registerSetActiveSpaceCommand } from "./commands/setActiveSpaceCommand";
export { registerSetDefaultSpaceCommand } from "./commands/setDefaultSpaceCommand";
export { registerResetFirstTimeCommand } from "./commands/resetCommand";
export {
  isExtensionConfigured,
  isFirstTimeInstallation,
  markAsActivatedBefore,
  showSetupNotificationIfNeeded
} from "./firstTimeSetup";
