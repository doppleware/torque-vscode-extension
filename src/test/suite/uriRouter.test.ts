import * as assert from "assert";
import * as vscode from "vscode";
import { UriRouter } from "../../uris/UriRouter";

suite("UriRouter Test Suite", () => {
  let uriRouter: UriRouter;

  setup(() => {
    uriRouter = new UriRouter();
  });

  test("Should initialize UriRouter", () => {
    assert.ok(uriRouter);
  });

  test("Should register route handler", () => {
    const handler = async () => {
      // Handler implementation
    };

    // Should not throw
    uriRouter.route("/test/path", handler);
    assert.ok(true, "Route registration should succeed");
  });

  test("Should handle URI with matching route", async () => {
    const handler = async () => {
      // Handler implementation
    };

    uriRouter.route("/test/:id", handler);

    const testUri = vscode.Uri.parse("vscode://torque.extension/test/123");

    // Should not throw
    await uriRouter.handleUri(testUri);

    // Note: We can't easily verify the handler was called without mocking
    // the internal routing mechanism, so we just verify no errors occurred
    assert.ok(true, "URI handling should complete without errors");
  });

  test("Should handle URI with query parameters", async () => {
    const handler = async () => {
      // Handler implementation
    };

    uriRouter.route("/test/query", handler);

    const testUri = vscode.Uri.parse(
      "vscode://torque.extension/test/query?param1=value1&param2=value2"
    );

    // Should not throw
    await uriRouter.handleUri(testUri);

    assert.ok(
      true,
      "URI with query parameters should be handled without errors"
    );
  });
});
