/**
 * Grain Script CodeLens Provider Test Suite
 *
 * Tests the CodeLens functionality for adding scripts to grains in blueprint YAML files
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { GrainScriptCodeLensProvider } from "../../../domains/blueprint-authoring";

suite("Grain Script CodeLens Provider Test Suite", () => {
  let codeLensProvider: GrainScriptCodeLensProvider;

  suiteSetup(async () => {
    // Get the extension and activate it
    const ext = vscode.extensions.getExtension("quali.torque-ai");
    assert.ok(ext, "Extension should be available");

    await ext.activate();
    assert.strictEqual(ext.isActive, true, "Extension should be active");

    codeLensProvider = new GrainScriptCodeLensProvider();
  });

  test("Should identify blueprint file with schema", async () => {
    const content = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: 'Test blueprint'
grains:
  nginx:
    kind: helm
    spec:
      source:
        store: my-repo
        path: my-asset`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.ok(
      codeLenses.length > 0,
      "Should provide CodeLens for blueprint file"
    );
  });

  test("Should not provide CodeLens for non-blueprint YAML file", async () => {
    const content = `version: '3'
services:
  web:
    image: nginx`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.strictEqual(
      codeLenses.length,
      0,
      "Should not provide CodeLens for non-blueprint file"
    );
  });

  test("Should find single grain definition", async () => {
    const content = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: 'Test blueprint'
grains:
  nginx:
    kind: helm
    spec:
      source:
        store: my-repo
        path: my-asset`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.strictEqual(codeLenses.length, 1, "Should find one grain");
    assert.ok(
      codeLenses[0].command?.title.includes("Add Script"),
      "CodeLens should have 'Add Script' title"
    );
    assert.strictEqual(
      codeLenses[0].command?.command,
      "torque.addGrainScript",
      "CodeLens should trigger addGrainScript command"
    );
  });

  test("Should find multiple grain definitions", async () => {
    const content = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: 'Test blueprint'
grains:
  nginx:
    kind: helm
    spec:
      source:
        store: my-repo
        path: nginx-chart
  postgres:
    kind: terraform
    spec:
      source:
        store: my-repo
        path: postgres-module
  redis:
    kind: helm
    spec:
      source:
        store: my-repo
        path: redis-chart`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.strictEqual(codeLenses.length, 3, "Should find three grains");

    // Verify all CodeLenses have the correct command
    codeLenses.forEach((codeLens, index) => {
      assert.ok(
        codeLens.command?.title.includes("Add Script"),
        `CodeLens ${index} should have 'Add Script' title`
      );
      assert.strictEqual(
        codeLens.command?.command,
        "torque.addGrainScript",
        `CodeLens ${index} should trigger addGrainScript command`
      );
    });

    // Verify grain names are passed as arguments
    const grainNames = codeLenses
      .map((cl) => cl.command?.arguments?.[1] as string)
      .filter(Boolean);
    assert.deepStrictEqual(
      grainNames,
      ["nginx", "postgres", "redis"],
      "Should pass correct grain names as arguments"
    );
  });

  test("Should place CodeLens on correct line for grain", async () => {
    const content = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: 'Test blueprint'
grains:
  nginx:
    kind: helm`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.strictEqual(codeLenses.length, 1, "Should find one grain");

    // The grain "nginx:" is on line 4 (0-indexed)
    assert.strictEqual(
      codeLenses[0].range.start.line,
      4,
      "CodeLens should be on line 4 (grain definition line)"
    );
  });

  test("Should handle blueprint with no grains", async () => {
    const content = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: 'Test blueprint with no grains'
inputs:
  - region: us-east-1`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.strictEqual(
      codeLenses.length,
      0,
      "Should not provide CodeLens when no grains present"
    );
  });

  test("Should handle blueprint with empty grains section", async () => {
    const content = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: 'Test blueprint'
grains:
outputs:
  - url: '{{.grains.nginx.url}}'`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.strictEqual(
      codeLenses.length,
      0,
      "Should not provide CodeLens for empty grains section"
    );
  });

  test("Should pass correct arguments to command", async () => {
    const content = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: 'Test blueprint'
grains:
  my-service:
    kind: helm
    spec:
      source:
        store: my-repo
        path: my-asset`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.strictEqual(codeLenses.length, 1, "Should find one grain");

    const command = codeLenses[0].command;
    assert.ok(command, "CodeLens should have a command");
    assert.ok(command.arguments, "Command should have arguments");
    assert.strictEqual(
      command.arguments.length,
      3,
      "Command should have 3 arguments"
    );

    // First argument: document URI
    assert.ok(
      command.arguments[0] instanceof vscode.Uri,
      "First argument should be URI"
    );

    // Second argument: grain name
    assert.strictEqual(
      command.arguments[1],
      "my-service",
      "Second argument should be grain name"
    );

    // Third argument: line number
    assert.strictEqual(
      typeof command.arguments[2],
      "number",
      "Third argument should be line number"
    );
    assert.strictEqual(
      command.arguments[2],
      4,
      "Third argument should be the grain line number (4)"
    );
  });

  test("Should handle grains with hyphens and underscores in names", async () => {
    const content = `# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: 'Test blueprint'
grains:
  my-nginx-service:
    kind: helm
  postgres_db:
    kind: terraform
  redis-cache_v2:
    kind: helm`;

    const doc = await vscode.workspace.openTextDocument({
      language: "yaml",
      content
    });

    const codeLenses = codeLensProvider.provideCodeLenses(doc);

    assert.strictEqual(codeLenses.length, 3, "Should find all three grains");

    const grainNames = codeLenses
      .map((cl) => cl.command?.arguments?.[1] as string)
      .filter(Boolean);
    assert.deepStrictEqual(
      grainNames,
      ["my-nginx-service", "postgres_db", "redis-cache_v2"],
      "Should correctly parse grain names with hyphens and underscores"
    );
  });
});
