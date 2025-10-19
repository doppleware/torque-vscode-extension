/**
 * First-Time Setup Logic
 *
 * Handles first-time installation detection and welcome notifications.
 */

import * as vscode from "vscode";
import { logger } from "../../utils/Logger";
import type { SettingsManager } from "./SettingsManager";

/**
 * Checks if the extension is properly configured
 */
export const isExtensionConfigured = async (
  settingsManager: SettingsManager
): Promise<boolean> => {
  const url = await settingsManager.getSetting<string>("url");
  const token = await settingsManager.getSetting<string>("token");
  const isConfigured = !!(url && token);
  logger.debug(
    `Extension configuration check: ${isConfigured ? "configured" : "not configured"}`
  );
  return isConfigured;
};

/**
 * Checks if this is the first time the extension is being activated
 */
export const isFirstTimeInstallation = (
  context: vscode.ExtensionContext
): boolean => {
  const hasBeenActivatedBefore = context.globalState.get<boolean>(
    "hasBeenActivatedBefore",
    false
  );
  return !hasBeenActivatedBefore;
};

/**
 * Marks the extension as having been activated before
 */
export const markAsActivatedBefore = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  await context.globalState.update("hasBeenActivatedBefore", true);
  logger.debug("Extension marked as activated before");
};

/**
 * Shows first-time installation popup or regular setup notification
 */
export const showSetupNotificationIfNeeded = async (
  settingsManager: SettingsManager,
  context: vscode.ExtensionContext
): Promise<void> => {
  const isConfigured = await isExtensionConfigured(settingsManager);
  const isFirstTime = isFirstTimeInstallation(context);

  // Debug logging
  logger.info(
    `Setup notification check: isConfigured=${isConfigured}, isFirstTime=${isFirstTime}`
  );

  if (!isConfigured) {
    if (isFirstTime) {
      logger.info("First-time installation detected, showing welcome popup");
      const result = await vscode.window.showInformationMessage(
        "The Torque extension has been installed, click below to configure it",
        "Configure",
        "Later"
      );

      if (result === "Configure") {
        logger.info(
          "User selected to configure Torque AI from first-time popup"
        );
        await vscode.commands.executeCommand("torque.setup");
      } else {
        logger.info("User chose to skip first-time configuration");
      }

      // Mark as activated regardless of user choice
      await markAsActivatedBefore(context);
    } else {
      logger.info("Extension not configured, showing setup notification");
      const result = await vscode.window.showInformationMessage(
        "🚀 Torque AI extension is installed but not configured. Set up your API connection to enable MCP tools.",
        "Configure Torque AI",
        "Later"
      );

      if (result === "Configure Torque AI") {
        logger.info("User selected to configure Torque AI");
        await vscode.commands.executeCommand("torque.setup");
      } else {
        logger.info("User chose to skip configuration");
      }
    }
  } else if (isFirstTime) {
    // Extension is configured and this is first time - show welcome message for configured users
    logger.info(
      "First-time installation with existing configuration detected, showing welcome"
    );

    const result = await vscode.window.showInformationMessage(
      "🎉 Welcome to Torque AI! Your extension is already configured and ready to use.",
      "Open Chat",
      "Check Status"
    );

    if (result === "Open Chat") {
      logger.info("User selected to open chat from first-time welcome");
      try {
        await vscode.commands.executeCommand("workbench.action.chat.open");
      } catch {
        vscode.window.showInformationMessage(
          "Could not open chat automatically. Please open Copilot Chat manually and look for Torque tools."
        );
      }
    } else if (result === "Check Status") {
      logger.info("User selected to check status from first-time welcome");
      await vscode.commands.executeCommand("torque.checkMcpStatus");
    }

    // Mark as activated after showing welcome
    await markAsActivatedBefore(context);
  } else {
    logger.info(
      "Extension already configured and not first time - no notification needed"
    );
  }
};
