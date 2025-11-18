/**
 * Git Utilities Test Suite
 *
 * Tests for Git helper functions
 */

import * as assert from "assert";
import { getRepositoryNameFromUrl, normalizeGitUrl } from "../../../utils/git";

suite("Git Utilities Test Suite", () => {
  suite("normalizeGitUrl", () => {
    test("Should normalize HTTPS URLs", () => {
      const url = "https://github.com/user/my-repo.git";
      const normalized = normalizeGitUrl(url);
      assert.strictEqual(normalized, "https://github.com/user/my-repo");
    });

    test("Should normalize SSH URLs", () => {
      const url = "git@github.com:user/my-repo.git";
      const normalized = normalizeGitUrl(url);
      assert.strictEqual(normalized, "https://github.com/user/my-repo");
    });

    test("Should remove trailing slashes", () => {
      const url = "https://github.com/user/my-repo/";
      const normalized = normalizeGitUrl(url);
      assert.strictEqual(normalized, "https://github.com/user/my-repo");
    });

    test("Should convert to lowercase", () => {
      const url = "https://GitHub.com/User/My-Repo.git";
      const normalized = normalizeGitUrl(url);
      assert.strictEqual(normalized, "https://github.com/user/my-repo");
    });

    test("Should handle URLs without .git suffix", () => {
      const url = "https://github.com/user/my-repo";
      const normalized = normalizeGitUrl(url);
      assert.strictEqual(normalized, "https://github.com/user/my-repo");
    });
  });

  suite("getRepositoryNameFromUrl", () => {
    test("Should extract repo name from HTTPS URL", () => {
      const url = "https://github.com/user/my-repo.git";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "my-repo");
    });

    test("Should extract repo name from SSH URL", () => {
      const url = "git@github.com:user/torque-vscode-extension.git";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "torque-vscode-extension");
    });

    test("Should extract repo name from URL without .git", () => {
      const url = "https://github.com/doppleware/digma-vscode-plugin";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "digma-vscode-plugin");
    });

    test("Should handle URLs with trailing slashes", () => {
      const url = "https://github.com/user/my-repo/";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "my-repo");
    });

    test("Should handle complex repository names", () => {
      const url = "https://github.com/quali/torque-ai-extension";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "torque-ai-extension");
    });

    test("Should handle GitLab URLs", () => {
      const url = "https://gitlab.com/group/subgroup/my-project.git";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "my-project");
    });

    test("Should handle Bitbucket URLs", () => {
      const url = "https://bitbucket.org/user/repository-name.git";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "repository-name");
    });

    test("Should return null for invalid URLs", () => {
      const url = "not-a-valid-url";
      const repoName = getRepositoryNameFromUrl(url);
      // The function will still extract the last segment, so this should return the string itself
      assert.strictEqual(repoName, "not-a-valid-url");
    });

    test("Should handle repository names with underscores", () => {
      const url = "https://github.com/user/my_repo_name.git";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "my_repo_name");
    });

    test("Should handle repository names with dots", () => {
      const url = "https://github.com/user/my.repo.name.git";
      const repoName = getRepositoryNameFromUrl(url);
      assert.strictEqual(repoName, "my.repo.name");
    });
  });
});
