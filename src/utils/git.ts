/**
 * Git Utilities
 *
 * Helper functions for working with Git repositories
 */

import * as vscode from "vscode";
import { logger } from "./Logger";

// Types for VS Code Git Extension API
interface GitExtension {
  getAPI(version: 1): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
}

interface Repository {
  rootUri: vscode.Uri;
  state: RepositoryState;
}

interface RepositoryState {
  remotes: Remote[];
}

interface Remote {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

/**
 * Gets the remote URL for the current workspace's Git repository
 *
 * @param workspaceFolder The workspace folder to check (defaults to first workspace)
 * @returns The Git remote URL or null if not a Git repository
 */
export async function getGitRemoteUrl(
  workspaceFolder?: vscode.WorkspaceFolder
): Promise<string | null> {
  try {
    // Get the workspace folder
    const folder = workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];

    if (!folder) {
      logger.debug("No workspace folder found");
      return null;
    }

    // Get the Git extension
    const gitExtension =
      vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!gitExtension) {
      logger.debug("Git extension not found");
      return null;
    }

    // Activate the Git extension if not already active
    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }

    const git: GitAPI = gitExtension.exports.getAPI(1);
    if (!git) {
      logger.debug("Git API not available");
      return null;
    }

    // Get the repository for this workspace folder
    const repository: Repository | undefined = git.repositories.find(
      (repo: Repository) => repo.rootUri.toString() === folder.uri.toString()
    );

    if (!repository) {
      logger.debug("No Git repository found for workspace");
      return null;
    }

    // Get the remote URL (typically from 'origin')
    const remotes: Remote[] = repository.state.remotes;
    if (!remotes || remotes.length === 0) {
      logger.debug("No Git remotes found");
      return null;
    }

    // Try to get 'origin' remote first, otherwise use the first remote
    const originRemote: Remote | undefined = remotes.find(
      (remote: Remote) => remote.name === "origin"
    );
    const remote: Remote | undefined = originRemote ?? remotes[0];

    if (!remote?.fetchUrl) {
      logger.debug("No fetch URL found for remote");
      return null;
    }

    logger.debug(`Found Git remote URL: ${remote.fetchUrl}`);
    return normalizeGitUrl(remote.fetchUrl);
  } catch (error) {
    logger.error("Error getting Git remote URL", error as Error);
    return null;
  }
}

/**
 * Normalizes a Git URL to a consistent format for comparison
 * Converts SSH URLs to HTTPS format and removes .git suffix
 *
 * @param url The Git URL to normalize
 * @returns Normalized URL
 */
export function normalizeGitUrl(url: string): string {
  let normalized = url.trim();

  // Convert SSH URL to HTTPS
  // git@github.com:user/repo.git -> https://github.com/user/repo
  const sshRegex = /git@([^:]+):(.+)/;
  const sshMatch = sshRegex.exec(normalized);
  if (sshMatch) {
    normalized = `https://${sshMatch[1]}/${sshMatch[2]}`;
  }

  // Remove .git suffix
  if (normalized.endsWith(".git")) {
    normalized = normalized.slice(0, -4);
  }

  // Remove trailing slash
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.toLowerCase();
}

/**
 * Checks if two Git URLs refer to the same repository
 *
 * @param url1 First URL
 * @param url2 Second URL
 * @returns true if URLs match
 */
export function isSameRepository(url1: string, url2: string): boolean {
  return normalizeGitUrl(url1) === normalizeGitUrl(url2);
}
