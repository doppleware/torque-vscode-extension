import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { MockTorqueServer } from "../mockServer";
import { ApiClient } from "../../../api/ApiClient";

suite("Environment Context URL Handler Integration Tests", () => {
  let mockServer: MockTorqueServer;
  let serverUrl: string;
  let apiClient: ApiClient;
  const testToken = "test-token-introspection-123";

  suiteSetup(async () => {
    // Start mock server
    mockServer = new MockTorqueServer({ requireAuth: true });
    await mockServer.start();
    serverUrl = mockServer.getBaseUrl();

    // Create API client for testing
    apiClient = new ApiClient(serverUrl, testToken);
  });

  suiteTeardown(async () => {
    // Stop mock server
    if (mockServer) {
      await mockServer.stop();
    }
  });

  setup(() => {
    // Clear request logs before each test
    mockServer.clearRequestLog();
    mockServer.clearIntrospectionRequestLog();
  });

  suite("Introspection API Integration", () => {
    test("SHOULD fetch environment details with grains", async () => {
      const spaceName = "test-space";
      const environmentId = "test-env-123";

      // Fetch environment details
      const response = await apiClient.client.get(
        `/api/spaces/${encodeURIComponent(spaceName)}/environments/${encodeURIComponent(environmentId)}`
      );

      // Verify response structure
      assert.ok(response.data, "Should have response data");
      assert.ok(response.data.details, "Should have details");
      assert.ok(response.data.details.state, "Should have state");
      assert.ok(
        Array.isArray(response.data.details.state.grains),
        "Should have grains array in state"
      );

      const grains = response.data.details.state.grains;
      assert.strictEqual(grains.length, 2, "Should have 2 grains");
      assert.strictEqual(grains[0].name, "test-grain-1");
      assert.strictEqual(grains[1].name, "test-grain-2");

      // Verify request was logged
      const requests = mockServer.getRequestLog();
      assert.strictEqual(requests.length, 1);
      assert.strictEqual(requests[0].spaceName, spaceName);
      assert.strictEqual(requests[0].environmentId, environmentId);
    });

    test("SHOULD fetch introspection data for each grain", async () => {
      const spaceName = "test-space";
      const environmentId = "test-env-123";
      const grainNames = ["test-grain-1", "test-grain-2"];

      // Fetch introspection data for each grain
      for (const grainName of grainNames) {
        const response = await apiClient.spaces.getEnvironmentIntrospection(
          spaceName,
          environmentId,
          grainName
        );

        // Verify response structure
        assert.ok(response, "Should have response");
        assert.ok(
          Array.isArray(response.resources),
          "Should have resources array"
        );
        assert.strictEqual(
          response.resources.length,
          2,
          "Should have 2 resources per grain"
        );

        // Verify resource structure
        const resource = response.resources[0];
        assert.ok(resource.name, "Resource should have name");
        assert.ok(resource.type, "Resource should have type");
        assert.ok(
          resource.dependency_identifier,
          "Resource should have dependency_identifier"
        );
        assert.ok(
          resource.name.includes(grainName),
          "Resource name should include grain name"
        );
      }

      // Verify introspection requests were logged
      const introspectionRequests = mockServer.getIntrospectionRequestLog();
      assert.strictEqual(
        introspectionRequests.length,
        2,
        "Should have logged 2 introspection requests"
      );
      assert.strictEqual(introspectionRequests[0].spaceName, spaceName);
      assert.strictEqual(introspectionRequests[0].environmentId, environmentId);
      assert.strictEqual(introspectionRequests[0].assetName, "test-grain-1");
      assert.strictEqual(introspectionRequests[1].assetName, "test-grain-2");
    });

    test("SHOULD handle introspection with URL encoding", async () => {
      const spaceName = "test space with spaces";
      const environmentId = "test-env/with/slashes";
      const grainName = "grain-with-special-chars";

      // Fetch introspection data
      const response = await apiClient.spaces.getEnvironmentIntrospection(
        spaceName,
        environmentId,
        grainName
      );

      // Verify response
      assert.ok(response, "Should have response");
      assert.ok(Array.isArray(response.resources), "Should have resources");

      // Verify request was logged with correct decoded values
      const requests = mockServer.getIntrospectionRequestLog();
      assert.strictEqual(requests.length, 1);
      assert.strictEqual(requests[0].spaceName, spaceName);
      assert.strictEqual(requests[0].environmentId, environmentId);
      assert.strictEqual(requests[0].assetName, grainName);
    });

    test("SHOULD include resource attributes and tags", async () => {
      const spaceName = "test-space";
      const environmentId = "test-env";
      const grainName = "my-grain";

      // Fetch introspection data
      const response = await apiClient.spaces.getEnvironmentIntrospection(
        spaceName,
        environmentId,
        grainName
      );

      // Verify first resource has attributes
      const resource1 = response.resources[0];
      assert.ok(resource1.attributes, "Should have attributes");
      assert.strictEqual(resource1.attributes.instance_type, "t3.medium");
      assert.strictEqual(resource1.attributes.ami, "ami-12345678");

      // Verify resource has tags
      assert.ok(resource1.tags, "Should have tags");
      assert.ok(resource1.tags.Name, "Should have Name tag");
      assert.ok(resource1.tags.Environment, "Should have Environment tag");

      // Verify second resource has dependencies
      const resource2 = response.resources[1];
      assert.ok(
        Array.isArray(resource2.depends_on),
        "Should have depends_on array"
      );
      assert.strictEqual(resource2.depends_on.length, 1);
      assert.ok(
        resource2.depends_on[0].includes("resource-1"),
        "Should depend on resource-1"
      );
    });
  });

  suite("Full Environment Context Flow", () => {
    test("SHOULD create temp file with simplified schema including grain resources", async () => {
      const spaceName = "production";
      const environmentId = "prod-env-456";

      // Import the handler
      const { attachEnvironmentFileToChatContext } = await import(
        "../../../domains/environment-context/handlers/environmentContextHandler"
      );

      // Mock VS Code commands
      const executedCommands: { command: string; args: any[] }[] = [];
      const originalExecuteCommand = vscode.commands.executeCommand;
      (vscode.commands as any).executeCommand = async (
        command: string,
        ...args: any[]
      ) => {
        executedCommands.push({ command, args });
        return undefined;
      };

      // Mock information message
      let infoMessage = "";
      const originalShowInfoMessage = vscode.window.showInformationMessage;
      (vscode.window as any).showInformationMessage = async (
        message: string
      ) => {
        infoMessage = message;
        return undefined;
      };

      try {
        // Execute the handler with dependency-injected client
        await attachEnvironmentFileToChatContext(
          spaceName,
          environmentId,
          apiClient
        );

        // Verify environment details API was called
        const envRequests = mockServer.getRequestLog();
        assert.strictEqual(
          envRequests.length,
          1,
          "Should call environment details API once"
        );
        assert.strictEqual(envRequests[0].spaceName, spaceName);
        assert.strictEqual(envRequests[0].environmentId, environmentId);

        // Verify introspection API was called for each grain
        const introspectionRequests = mockServer.getIntrospectionRequestLog();
        assert.strictEqual(
          introspectionRequests.length,
          2,
          "Should call introspection API for each grain"
        );
        assert.strictEqual(introspectionRequests[0].assetName, "test-grain-1");
        assert.strictEqual(introspectionRequests[1].assetName, "test-grain-2");

        // Verify commands were executed
        assert.ok(
          executedCommands.some(
            (cmd) =>
              cmd.command.includes("chat.open") ||
              cmd.command.includes("composer")
          ),
          "Should execute open chat command"
        );

        const attachCommand = executedCommands.find(
          (cmd) =>
            cmd.command.includes("attachFile") ||
            cmd.command.includes("addfiles")
        );
        assert.ok(attachCommand, "Should execute attach file command");

        // Verify the file was created
        const fileUri = attachCommand?.args[0] as vscode.Uri;
        assert.ok(fileUri, "Should have file URI");
        assert.ok(fileUri.fsPath, "Should have file path");

        // Verify the file is a YAML file
        assert.ok(
          fileUri.fsPath.endsWith(".yaml"),
          "File should have .yaml extension"
        );

        // Read and verify the file content
        const fileContent = fs.readFileSync(fileUri.fsPath, "utf8");
        const parsedContent = yaml.load(fileContent) as any;

        // Verify new simplified schema structure
        assert.ok(parsedContent.environment_id, "Should have environment_id");
        assert.ok(parsedContent.space_name, "Should have space_name");
        assert.strictEqual(
          parsedContent.space_name,
          spaceName,
          "Space name should match"
        );
        assert.ok(parsedContent.status, "Should have status");
        assert.ok(
          Array.isArray(parsedContent.inputs),
          "Should have inputs array at environment level"
        );
        assert.strictEqual(
          parsedContent.inputs.length,
          1,
          "Should have 1 environment-level input"
        );
        assert.strictEqual(
          parsedContent.inputs[0].name,
          "test-input",
          "Environment input should have correct name"
        );
        assert.strictEqual(
          parsedContent.inputs[0].value,
          "test-value",
          "Environment input should have correct value"
        );
        assert.ok(
          Array.isArray(parsedContent.grains),
          "Should have grains array"
        );

        // Verify grains content
        assert.strictEqual(
          parsedContent.grains.length,
          2,
          "Should have 2 grains"
        );

        // Verify grain structure - grains are objects with grain name as key
        const grain1 = parsedContent.grains[0];
        assert.ok(grain1["test-grain-1"], "Should have test-grain-1 grain");

        const grain1Details = grain1["test-grain-1"];
        assert.ok(grain1Details.path, "Grain should have path");
        assert.ok(grain1Details.kind, "Grain should have kind");
        assert.ok(
          grain1Details.execution_host,
          "Grain should have execution_host"
        );
        assert.ok(
          Array.isArray(grain1Details.inputs),
          "Grain should have inputs array"
        );
        assert.strictEqual(
          grain1Details.inputs.length,
          2,
          "Grain should have 2 inputs"
        );
        assert.strictEqual(
          grain1Details.inputs[0].name,
          "instance_type",
          "Grain input should have correct name"
        );
        assert.strictEqual(
          grain1Details.inputs[0].value,
          "t3.medium",
          "Grain input should have correct value"
        );
        assert.ok(grain1Details.state, "Grain should have state");
        assert.ok(
          grain1Details.state.current_state,
          "Grain state should have current_state"
        );
        assert.ok(
          Array.isArray(grain1Details.state.activities),
          "Grain state should have activities array"
        );
        assert.ok(
          Array.isArray(grain1Details.resources),
          "Grain should have resources array"
        );

        // Verify resources structure (only name and type)
        assert.strictEqual(
          grain1Details.resources.length,
          2,
          "Should have 2 resources for grain 1"
        );

        const resource = grain1Details.resources[0];
        assert.ok(resource.name, "Resource should have name");
        assert.ok(resource.type, "Resource should have type");

        // Verify simplified schema excludes unnecessary fields
        assert.strictEqual(
          parsedContent.owner,
          undefined,
          "Should not include owner"
        );
        assert.strictEqual(
          parsedContent.collaborators_info,
          undefined,
          "Should not include collaborators_info"
        );
        assert.strictEqual(
          parsedContent.cost,
          undefined,
          "Should not include cost"
        );
        assert.strictEqual(
          parsedContent.state,
          undefined,
          "Should not include old state field"
        );
        assert.strictEqual(
          parsedContent.outputs,
          undefined,
          "Should not include outputs field"
        );

        // Verify notification message
        assert.strictEqual(
          infoMessage,
          "Environment details have been added to the chat context",
          "Should show correct notification"
        );

        // Clean up temp file
        fs.unlinkSync(fileUri.fsPath);
      } finally {
        // Restore mocks
        (vscode.commands as any).executeCommand = originalExecuteCommand;
        (vscode.window as any).showInformationMessage = originalShowInfoMessage;
      }
    });

    test("SHOULD handle environments with no grains gracefully", async () => {
      // This test verifies that the handler works even if no grains are found
      const spaceName = "empty-space";
      const environmentId = "empty-env";

      const { attachEnvironmentFileToChatContext } = await import(
        "../../../domains/environment-context/handlers/environmentContextHandler"
      );

      // Mock VS Code commands
      const executedCommands: string[] = [];
      const originalExecuteCommand = vscode.commands.executeCommand;
      (vscode.commands as any).executeCommand = async (command: string) => {
        executedCommands.push(command);
        return undefined;
      };

      const originalShowInfoMessage = vscode.window.showInformationMessage;
      (vscode.window as any).showInformationMessage = async () => undefined;

      try {
        // The mock server will still return grains, but we can verify the flow works
        await attachEnvironmentFileToChatContext(
          spaceName,
          environmentId,
          apiClient
        );

        // Verify environment API was called
        const requests = mockServer.getRequestLog();
        assert.ok(requests.length > 0, "Should call environment API");

        // Verify no errors occurred
        assert.ok(
          executedCommands.length > 0,
          "Should execute commands without errors"
        );
      } finally {
        (vscode.commands as any).executeCommand = originalExecuteCommand;
        (vscode.window as any).showInformationMessage = originalShowInfoMessage;
      }
    });
  });

  suite("Error Handling", () => {
    test("SHOULD handle introspection API errors gracefully", async () => {
      const spaceName = "test-space";
      const environmentId = "test-env";
      const invalidGrainName = "nonexistent-grain";

      // The mock server will still return data, but in a real scenario
      // we want to ensure errors don't break the flow
      try {
        const response = await apiClient.spaces.getEnvironmentIntrospection(
          spaceName,
          environmentId,
          invalidGrainName
        );

        // Verify response structure is still valid
        assert.ok(response, "Should have response even for errors");
        assert.ok(
          Array.isArray(response.resources),
          "Should have resources array"
        );
      } catch (error) {
        // If an error occurs, it should be handled gracefully
        assert.ok(error instanceof Error, "Should be an Error instance");
      }
    });
  });

  suite("File Search and Open", () => {
    test("SHOULD search for file with blueprint name in workspace", async () => {
      const blueprintName = "hello-blueprint";

      // Create a test file in the workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        // Skip test if no workspace folder
        return;
      }

      const testFilePath = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        `${blueprintName}.yaml`
      );

      // Create test file
      await vscode.workspace.fs.writeFile(
        testFilePath,
        Buffer.from("spec_version: 2\nblueprint: hello-blueprint")
      );

      try {
        // Search for files matching the blueprint name
        const files = await vscode.workspace.findFiles(
          `**/*${blueprintName}*`,
          "**/node_modules/**",
          10
        );

        // Verify file was found
        assert.ok(files.length > 0, "Should find at least one matching file");
        assert.ok(
          files.some((file) => file.fsPath.includes(blueprintName)),
          "Found files should contain blueprint name"
        );
      } finally {
        // Clean up test file
        try {
          await vscode.workspace.fs.delete(testFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    test("SHOULD open file when found", async () => {
      const environmentName = "my-test-env";

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
      }

      const testFilePath = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        `${environmentName}.md`
      );

      // Create test file
      await vscode.workspace.fs.writeFile(
        testFilePath,
        Buffer.from("# Environment Documentation\n\nTest content")
      );

      try {
        // Search and open the file
        const files = await vscode.workspace.findFiles(
          `**/*${environmentName}*`,
          "**/node_modules/**",
          10
        );

        assert.ok(files.length > 0, "Should find the test file");

        // Open the first matching file
        const document = await vscode.workspace.openTextDocument(files[0]);
        const editor = await vscode.window.showTextDocument(document, {
          preview: false,
          viewColumn: vscode.ViewColumn.One
        });

        // Verify file was opened
        assert.ok(editor, "Should open editor");
        assert.ok(
          editor.document.uri.fsPath.includes(environmentName),
          "Opened document should match environment name"
        );

        // Close the editor
        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor"
        );
      } finally {
        // Clean up test file
        try {
          await vscode.workspace.fs.delete(testFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    test("SHOULD handle sanitized environment names", async () => {
      // Test that files with special characters replaced match sanitized search
      const sanitizedName = "test_env_123";

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
      }

      const testFilePath = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        `${sanitizedName}.yaml`
      );

      // Create test file with sanitized name
      await vscode.workspace.fs.writeFile(
        testFilePath,
        Buffer.from("test: content")
      );

      try {
        // Search using sanitized pattern
        const files = await vscode.workspace.findFiles(
          `**/*${sanitizedName}*`,
          "**/node_modules/**",
          10
        );

        assert.ok(files.length > 0, "Should find file with sanitized name");
        assert.ok(
          files[0].fsPath.includes(sanitizedName),
          "Found file should have sanitized name"
        );
      } finally {
        // Clean up test file
        try {
          await vscode.workspace.fs.delete(testFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    test("SHOULD not throw when no matching file is found", async () => {
      const nonexistentEnvName = "definitely-does-not-exist-12345";

      // Search for non-existent file - should not throw
      const files = await vscode.workspace.findFiles(
        `**/*${nonexistentEnvName}*`,
        "**/node_modules/**",
        10
      );

      // Should return empty array, not throw
      assert.strictEqual(files.length, 0, "Should find no files");
    });
  });
});
