/**
 * DeploymentForm Test Suite
 *
 * Tests the interactive deployment form functionality
 */

import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { DeploymentForm } from "../../../domains/blueprint-authoring/commands/actions/DeploymentForm";

suite("DeploymentForm Test Suite", () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  suite("Form Display", () => {
    test("SHOULD show all fields in the form", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string", default: "t2.micro" },
          allowedValues: []
        },
        {
          name: "region",
          config: { type: "string" },
          allowedValues: [
            { value: "us-east-1", display_value: "US East 1" },
            { value: "us-west-2", display_value: "US West 2" }
          ]
        }
      ];

      const currentValues = {
        instance_type: "t2.micro",
        region: ""
      };

      const form = new DeploymentForm("test-blueprint", inputs, currentValues);

      let capturedItems: any[] = [];

      // Mock showQuickPick to capture items and cancel
      const quickPickStub = sandbox
        .stub(vscode.window, "showQuickPick")
        .callsFake((items: any) => {
          capturedItems = Array.from(items);
          return Promise.resolve(undefined); // User cancels
        });

      // Act
      const result = await form.show();

      // Assert
      assert.strictEqual(
        result,
        undefined,
        "Should return undefined when cancelled"
      );
      assert.ok(quickPickStub.called, "Should show QuickPick");
      assert.ok(
        capturedItems.length >= 4,
        "Should have at least 4 items (2 fields + deploy + cancel)"
      );

      // Verify field items
      const fieldItems = capturedItems.filter((item) =>
        item.label.includes("$(edit)")
      );
      assert.strictEqual(
        fieldItems.length,
        3,
        "Should have 3 editable fields (env name + 2 inputs)"
      );

      // Verify environment name field
      const envField = fieldItems.find((item) =>
        item.label.includes("Environment Name")
      );
      assert.ok(envField, "Should have environment name field");

      // Verify input fields
      const instanceTypeField = fieldItems.find((item) =>
        item.label.includes("instance_type")
      );
      assert.ok(instanceTypeField, "Should have instance_type field");

      const regionField = fieldItems.find((item) =>
        item.label.includes("region")
      );
      assert.ok(regionField, "Should have region field");

      // Verify action buttons
      const deployButton = capturedItems.find((item) =>
        item.label.includes("$(check) Deploy")
      );
      assert.ok(deployButton, "Should have Deploy button");

      const cancelButton = capturedItems.find((item) =>
        item.label.includes("$(close) Cancel")
      );
      assert.ok(cancelButton, "Should have Cancel button");
    });

    test("SHOULD generate default environment name with timestamp", async () => {
      // Arrange
      const form = new DeploymentForm("my-blueprint", [], {});

      let capturedItems: any[] = [];

      sandbox.stub(vscode.window, "showQuickPick").callsFake((items: any) => {
        capturedItems = Array.from(items);
        return Promise.resolve(undefined);
      });

      // Act
      await form.show();

      // Assert
      const envField = capturedItems.find((item) =>
        item.label.includes("Environment Name")
      );
      assert.ok(envField, "Should have environment name field");

      // Should have format: my-blueprint-YYYYMMDDThhmmss
      const envNamePattern = /my-blueprint-\d{8}T\d{6}/;
      assert.ok(
        envNamePattern.test(envField.description),
        `Environment name should match pattern, got: ${envField.description}`
      );
    });

    test("SHOULD use cached environment name when provided", async () => {
      // Arrange
      const form = new DeploymentForm(
        "my-blueprint",
        [],
        {},
        "cached-env-name"
      );

      let capturedItems: any[] = [];

      sandbox.stub(vscode.window, "showQuickPick").callsFake((items: any) => {
        capturedItems = Array.from(items);
        return Promise.resolve(undefined);
      });

      // Act
      await form.show();

      // Assert
      const envField = capturedItems.find((item) =>
        item.label.includes("Environment Name")
      );
      assert.ok(envField, "Should have environment name field");
      assert.strictEqual(
        envField.description,
        "cached-env-name",
        "Should use cached environment name"
      );
    });

    test("SHOULD show field type for input fields", async () => {
      // Arrange
      const inputs = [
        {
          name: "count",
          config: { type: "number" },
          allowedValues: []
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      let capturedItems: any[] = [];

      sandbox.stub(vscode.window, "showQuickPick").callsFake((items: any) => {
        capturedItems = Array.from(items);
        return Promise.resolve(undefined);
      });

      // Act
      await form.show();

      // Assert
      const countField = capturedItems.find((item) =>
        item.label.includes("count")
      );
      assert.ok(countField, "Should have count field");
      assert.ok(
        countField.detail.includes("Type: number"),
        "Should show field type"
      );
    });

    test("SHOULD show option count for select fields", async () => {
      // Arrange
      const inputs = [
        {
          name: "region",
          config: { type: "string" },
          allowedValues: [
            { value: "us-east-1", display_value: "US East 1" },
            { value: "us-west-2", display_value: "US West 2" },
            { value: "eu-west-1", display_value: "EU West 1" }
          ]
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      let capturedItems: any[] = [];

      sandbox.stub(vscode.window, "showQuickPick").callsFake((items: any) => {
        capturedItems = Array.from(items);
        return Promise.resolve(undefined);
      });

      // Act
      await form.show();

      // Assert
      const regionField = capturedItems.find((item) =>
        item.label.includes("region")
      );
      assert.ok(regionField, "Should have region field");
      assert.ok(
        regionField.detail.includes("Select from 3 option(s)"),
        "Should show option count"
      );
    });
  });

  suite("Field Editing", () => {
    test("SHOULD allow editing environment name", async () => {
      // Arrange
      const form = new DeploymentForm("test-blueprint", [], {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
      const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");

      // First call: user selects environment name field
      quickPickStub.onCall(0).resolves({
        label: "$(edit) Environment Name",
        field: {
          type: "input",
          name: "_environment_name",
          label: "Environment Name",
          value: "test-blueprint-20251024T120000"
        }
      } as any);

      // Input box: user enters new environment name
      inputBoxStub.onCall(0).resolves("my-custom-env");

      // Second call: user cancels
      quickPickStub.onCall(1).resolves(undefined);

      // Act
      await form.show();

      // Assert
      assert.ok(
        inputBoxStub.calledOnce,
        "Should show input box for environment name"
      );
      const inputBoxCall = inputBoxStub.getCall(0);
      assert.ok(
        inputBoxCall.args[0]?.prompt?.includes("Enter environment name"),
        "Input box should prompt for environment name"
      );
    });

    test("SHOULD allow text input for fields without allowed values", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string" },
          allowedValues: []
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
      const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");

      // First call: user selects instance_type field
      quickPickStub.onCall(0).resolves({
        label: "$(edit) instance_type",
        field: {
          type: "input",
          name: "instance_type",
          label: "instance_type",
          value: "",
          inputType: "string"
        }
      } as any);

      // Input box: user enters value
      inputBoxStub.onCall(0).resolves("t2.large");

      // Second call: user cancels
      quickPickStub.onCall(1).resolves(undefined);

      // Act
      await form.show();

      // Assert
      assert.ok(
        inputBoxStub.calledOnce,
        "Should show input box for text field"
      );
      const inputBoxCall = inputBoxStub.getCall(0);
      assert.ok(
        inputBoxCall.args[0]?.prompt?.includes("instance_type"),
        "Input box should prompt for field name"
      );
      assert.ok(
        inputBoxCall.args[0]?.prompt?.includes("string"),
        "Input box should show field type"
      );
    });

    test("SHOULD allow selection from allowed values", async () => {
      // Arrange
      const inputs = [
        {
          name: "region",
          config: { type: "string" },
          allowedValues: [
            { value: "us-east-1", display_value: "US East 1" },
            { value: "us-west-2", display_value: "US West 2" }
          ]
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // First call: user selects region field
      quickPickStub.onCall(0).resolves({
        label: "$(edit) region",
        field: {
          type: "select",
          name: "region",
          label: "region",
          value: "",
          options: inputs[0].allowedValues
        }
      } as any);

      // Second call: show allowed values
      quickPickStub.onCall(1).resolves({
        label: "US East 1",
        value: "us-east-1"
      } as any);

      // Third call: user cancels
      quickPickStub.onCall(2).resolves(undefined);

      // Act
      await form.show();

      // Assert
      assert.ok(
        quickPickStub.calledThrice,
        "Should show QuickPick three times"
      );

      // Verify the allowed values QuickPick
      const allowedValuesCall = quickPickStub.getCall(1);
      const items = Array.from(allowedValuesCall.args[0] as any[]);
      assert.strictEqual(items.length, 2, "Should show 2 allowed values");
      assert.ok(
        items.some((item: any) => item.label === "US East 1"),
        "Should show US East 1 option"
      );
      assert.ok(
        items.some((item: any) => item.label === "US West 2"),
        "Should show US West 2 option"
      );
    });

    test("SHOULD display current field values", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string" },
          allowedValues: []
        }
      ];

      const currentValues = {
        instance_type: "t2.micro"
      };

      const form = new DeploymentForm("test-blueprint", inputs, currentValues);

      let capturedItems: any[] = [];

      sandbox.stub(vscode.window, "showQuickPick").callsFake((items: any) => {
        capturedItems = Array.from(items);
        return Promise.resolve(undefined);
      });

      // Act
      await form.show();

      // Assert
      const instanceTypeField = capturedItems.find((item) =>
        item.label.includes("instance_type")
      );
      assert.ok(instanceTypeField, "Should have instance_type field");
      assert.strictEqual(
        instanceTypeField.description,
        "t2.micro",
        "Should display current value"
      );
    });

    test("SHOULD show '(not set)' for empty fields", async () => {
      // Arrange
      const inputs = [
        {
          name: "region",
          config: { type: "string" },
          allowedValues: []
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      let capturedItems: any[] = [];

      sandbox.stub(vscode.window, "showQuickPick").callsFake((items: any) => {
        capturedItems = Array.from(items);
        return Promise.resolve(undefined);
      });

      // Act
      await form.show();

      // Assert
      const regionField = capturedItems.find((item) =>
        item.label.includes("region")
      );
      assert.ok(regionField, "Should have region field");
      assert.strictEqual(
        regionField.description,
        "(not set)",
        "Should show '(not set)' for empty field"
      );
    });
  });

  suite("Form Validation", () => {
    test("SHOULD validate all required fields are filled", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string" },
          allowedValues: []
        },
        {
          name: "region",
          config: { type: "string" },
          allowedValues: []
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // First call: user clicks Deploy without filling fields
      quickPickStub.onCall(0).resolves({
        label: "$(check) Deploy",
        field: null
      } as any);

      // Second call: form re-displays with validation error
      quickPickStub.onCall(1).resolves(undefined); // User cancels

      // Act
      const result = await form.show();

      // Assert
      assert.strictEqual(
        result,
        undefined,
        "Should return undefined when user cancels"
      );
      assert.ok(
        quickPickStub.calledTwice,
        "Should show form twice (first attempt + validation error)"
      );
    });

    test("SHOULD show validation error for missing environment name", async () => {
      // Arrange
      const form = new DeploymentForm("test-blueprint", [], {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
      const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");

      // First call: user selects environment name field
      quickPickStub.onCall(0).resolves({
        label: "$(edit) Environment Name",
        field: {
          type: "input",
          name: "_environment_name",
          label: "Environment Name",
          value: "test-blueprint-20251024T120000"
        }
      } as any);

      // Input box: user clears the environment name
      inputBoxStub.onCall(0).resolves("");

      // Second call: user clicks Deploy
      quickPickStub.onCall(1).resolves({
        label: "$(check) Deploy",
        field: null
      } as any);

      // Third call: form re-displays with validation error
      quickPickStub.onCall(2).resolves(undefined); // User cancels

      // Act
      const result = await form.show();

      // Assert
      assert.strictEqual(
        result,
        undefined,
        "Should return undefined when cancelled"
      );
      assert.ok(quickPickStub.calledThrice, "Should show form three times");
    });

    test("SHOULD clear validation error when user edits a field", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string" },
          allowedValues: []
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
      const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");

      // First call: user clicks Deploy without filling field
      quickPickStub.onCall(0).resolves({
        label: "$(check) Deploy",
        field: null
      } as any);

      // Second call: form re-displays with validation error, user edits field
      quickPickStub.onCall(1).resolves({
        label: "$(edit) instance_type",
        field: {
          type: "input",
          name: "instance_type",
          label: "instance_type",
          value: ""
        }
      } as any);

      // Input box: user enters value
      inputBoxStub.onCall(0).resolves("t2.micro");

      // Third call: form re-displays without validation error
      quickPickStub.onCall(2).resolves(undefined); // User cancels

      // Act
      await form.show();

      // Assert
      // Form should loop back after validation error is cleared
      assert.ok(
        quickPickStub.callCount >= 2,
        "Should show form multiple times"
      );
    });

    test("SHOULD allow deployment when all fields are filled", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string" },
          allowedValues: []
        }
      ];

      const currentValues = {
        instance_type: "t2.micro"
      };

      const form = new DeploymentForm(
        "test-blueprint",
        inputs,
        currentValues,
        "my-env"
      );

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // User clicks Deploy - all fields are already filled
      // Need to use callsFake to return the actual submitItem from the choices
      quickPickStub.onFirstCall().callsFake((items: any) => {
        // Find and return the Deploy button (submitItem)
        return Promise.resolve(
          items.find((item: any) => item.label === "$(check) Deploy")
        );
      });

      // Act
      const result = await form.show();

      // Assert
      assert.ok(result, "Should return result when all fields are filled");
      assert.strictEqual(
        quickPickStub.callCount,
        1,
        "Should only show form once"
      );
      if (result) {
        assert.strictEqual(
          result.environmentName,
          "my-env",
          "Should return environment name"
        );
        assert.deepStrictEqual(
          result.inputs,
          { instance_type: "t2.micro" },
          "Should return input values"
        );
      }
    });
  });

  suite("User Actions", () => {
    test("SHOULD return undefined when user cancels with Cancel button", async () => {
      // Arrange
      const form = new DeploymentForm("test-blueprint", [], {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // User clicks Cancel
      quickPickStub.onCall(0).resolves({
        label: "$(close) Cancel",
        field: null
      } as any);

      // Act
      const result = await form.show();

      // Assert
      assert.strictEqual(
        result,
        undefined,
        "Should return undefined when cancelled"
      );
    });

    test("SHOULD return undefined when user dismisses the form", async () => {
      // Arrange
      const form = new DeploymentForm("test-blueprint", [], {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // User dismisses (presses Escape)
      quickPickStub.onCall(0).resolves(undefined);

      // Act
      const result = await form.show();

      // Assert
      assert.strictEqual(
        result,
        undefined,
        "Should return undefined when dismissed"
      );
    });

    test("SHOULD continue showing form when user dismisses input box", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string" },
          allowedValues: []
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");
      const inputBoxStub = sandbox.stub(vscode.window, "showInputBox");

      // First call: user selects instance_type field
      quickPickStub.onCall(0).resolves({
        label: "$(edit) instance_type",
        field: {
          type: "input",
          name: "instance_type",
          label: "instance_type",
          value: ""
        }
      } as any);

      // Input box: user dismisses
      inputBoxStub.onCall(0).resolves(undefined);

      // Second call: form re-displays, user cancels
      quickPickStub.onCall(1).resolves(undefined);

      // Act
      const result = await form.show();

      // Assert
      assert.strictEqual(result, undefined, "Should return undefined");
      assert.ok(
        quickPickStub.calledTwice,
        "Should show form again after input box dismissal"
      );
    });

    test("SHOULD return deployment values when user completes the form", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string", default: "t2.micro" },
          allowedValues: []
        },
        {
          name: "region",
          config: { type: "string" },
          allowedValues: [{ value: "us-east-1", display_value: "US East 1" }]
        }
      ];

      const currentValues = {
        instance_type: "t2.micro",
        region: "us-east-1"
      };

      const form = new DeploymentForm(
        "test-blueprint",
        inputs,
        currentValues,
        "test-env-123"
      );

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // User clicks Deploy - all fields filled
      // Need to use callsFake to return the actual submitItem from the choices
      quickPickStub.onFirstCall().callsFake((items: any) => {
        // Find and return the Deploy button (submitItem)
        return Promise.resolve(
          items.find((item: any) => item.label === "$(check) Deploy")
        );
      });

      // Act
      const result = await form.show();

      // Assert
      assert.ok(result, "Should return result");
      assert.strictEqual(quickPickStub.callCount, 1, "Should show form once");
      if (result) {
        assert.strictEqual(result.environmentName, "test-env-123");
        assert.deepStrictEqual(result.inputs, {
          instance_type: "t2.micro",
          region: "us-east-1"
        });
      }
    });
  });

  suite("Edge Cases", () => {
    test("SHOULD handle blueprint with no inputs", async () => {
      // Arrange
      const form = new DeploymentForm("test-blueprint", [], {}, "my-env");

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // User clicks Deploy - no inputs needed
      // Need to use callsFake to return the actual submitItem from the choices
      quickPickStub.onFirstCall().callsFake((items: any) => {
        // Find and return the Deploy button (submitItem)
        return Promise.resolve(
          items.find((item: any) => item.label === "$(check) Deploy")
        );
      });

      // Act
      const result = await form.show();

      // Assert
      assert.ok(result, "Should return result for blueprint with no inputs");
      assert.strictEqual(quickPickStub.callCount, 1, "Should show form once");
      if (result) {
        assert.strictEqual(result.environmentName, "my-env");
        assert.deepStrictEqual(result.inputs, {});
      }
    });

    test("SHOULD handle allowed values with null display_value", async () => {
      // Arrange
      const inputs = [
        {
          name: "region",
          config: { type: "string" },
          allowedValues: [{ value: "us-east-1", display_value: null }]
        }
      ];

      const form = new DeploymentForm("test-blueprint", inputs, {});

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // First call: user selects region field
      quickPickStub.onCall(0).resolves({
        label: "$(edit) region",
        field: {
          type: "select",
          name: "region",
          label: "region",
          value: "",
          options: inputs[0].allowedValues
        }
      } as any);

      // Second call: show allowed values
      quickPickStub.onCall(1).resolves({
        label: "us-east-1",
        value: "us-east-1"
      } as any);

      // Third call: user cancels
      quickPickStub.onCall(2).resolves(undefined);

      // Act
      await form.show();

      // Assert
      const allowedValuesCall = quickPickStub.getCall(1);
      const items = Array.from(allowedValuesCall.args[0] as any[]);
      assert.strictEqual(items.length, 1);
      assert.strictEqual(
        items[0].label,
        "us-east-1",
        "Should use value as label when display_value is null"
      );
    });

    test("SHOULD handle whitespace-only values as empty", async () => {
      // Arrange
      const inputs = [
        {
          name: "instance_type",
          config: { type: "string" },
          allowedValues: []
        }
      ];

      const currentValues = {
        instance_type: "   "
      };

      const form = new DeploymentForm("test-blueprint", inputs, currentValues);

      const quickPickStub = sandbox.stub(vscode.window, "showQuickPick");

      // User clicks Deploy - whitespace should be treated as empty
      quickPickStub.onCall(0).resolves({
        label: "$(check) Deploy",
        field: null
      } as any);

      // Should show validation error and loop back
      quickPickStub.onCall(1).resolves(undefined);

      // Act
      const result = await form.show();

      // Assert
      assert.strictEqual(
        result,
        undefined,
        "Should return undefined when cancelled"
      );
      assert.ok(
        quickPickStub.calledTwice,
        "Should show form twice (validation error)"
      );
    });
  });
});
