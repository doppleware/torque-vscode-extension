import * as assert from "assert";
import { ApiClient } from "../../api/ApiClient";

suite("ApiClient Test Suite", () => {
  let apiClient: ApiClient;

  setup(() => {
    // Create API client with test configuration
    apiClient = new ApiClient("https://localhost:5051", "test-token");
  });

  test("Should initialize ApiClient", () => {
    assert.ok(apiClient);
    assert.ok(apiClient.client);
  });

  test("Should have authentication service", () => {
    assert.ok(apiClient.authentication);
  });

  test("Should have agentic service", () => {
    assert.ok(apiClient.agentic);
  });

  test("Should update config", () => {
    const newUrl = "https://test.example.com";
    const newToken = "new-test-token";

    // Should not throw
    apiClient.updateConfig(newUrl, newToken);

    // Verify the base URL was updated
    assert.strictEqual(apiClient.client.defaults.baseURL, newUrl);
    assert.strictEqual(
      apiClient.client.defaults.headers["X-API-Token"],
      `Token ${newToken}`
    );
  });

  test("Should clear session", () => {
    // Should not throw
    apiClient.clearSession();

    // Session should be cleared (no auth header)
    assert.strictEqual(
      apiClient.client.defaults.headers.authorization,
      undefined
    );
  });
});
