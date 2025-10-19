/**
 * Environment Context Injection Domain
 *
 * Handles injection of Torque environment details into chat context.
 */

export { TorqueEnvironmentDetailsTool } from "./tools/TorqueEnvironmentDetailsTool";
export {
  handleEnvironmentContextUrl,
  attachEnvironmentFileToChatContext
} from "./handlers/environmentContextHandler";
