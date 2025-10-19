/**
 * Blueprint YAML Template
 *
 * This template is injected when creating a new Torque Blueprint YAML file.
 * It includes the YAML language server schema directive for validation and IntelliSense.
 */

export const BLUEPRINT_SCHEMA_URL =
  "https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json";

export const BLUEPRINT_TEMPLATE = `# yaml-language-server: $schema=${BLUEPRINT_SCHEMA_URL}
spec_version: 2
description: ''
inputs:
grains:
`;
