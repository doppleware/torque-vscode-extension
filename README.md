# Torque AI

[![Release](https://img.shields.io/github/v/release/doppleware/torque-vscode-extension)](https://github.com/doppleware/torque-vscode-extension/releases)
[![Tests](https://github.com/doppleware/torque-vscode-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/doppleware/torque-vscode-extension/actions/workflows/ci.yml)

The Torque platform provides self-service automation and governance of IaC assets for a variety of use cases. The Torque VS Code extension helps in the authoring of Torque blueprints and grains, operation and troubleshooting of environments.

For more info check out our [website](https://quali.com)

## Main Features

### 1. Environment Details Injection into Chat

Get AI-powered insights by injecting live environment context directly into your IDE's chat interface.

#### a. From URL Handler

Deep link from external applications to automatically attach environment details to chat context. Simply open a URL like `vscode://quali.torque-ai/chat/context/add/environment/{SPACE_NAME}/{ENVIRONMENT_ID}` to fetch environment introspection data and inject it into the chat.

**Learn more:** [URI Handling Specification](spec/uri_handling.md) | [Environment Context Injection](spec/environment_context_injection.md)

#### b. From Running Environment List

View all running environments for a blueprint via CodeLens and QuickPick menu. Click "Add to chat" to instantly inject environment details into your conversation.

**Learn more:** [Blueprint Running Environments Specification](spec/blueprint_running_environments.md)

### 2. Blueprint Actions

Powerful actions for authoring and managing Torque blueprints, accessible via CodeLens or command palette.

#### a. Sync Blueprint

Synchronize local blueprint files with the Torque platform catalog. Keep your blueprints up-to-date across development and production.

**Learn more:** [Blueprint YAML Support Specification](spec/blueprint_yaml_support.md)

#### b. Validate Blueprint

Validate blueprint syntax and structure against Torque platform rules. Errors and warnings appear in VS Code's Problems panel with precise line/column locations.

**Learn more:** [Environment Validation Specification](spec/environment_validation.md)

#### c. Deploy Blueprint

Launch environments directly from VS Code with an interactive deployment form. The form intelligently fetches allowed values for inputs, caches previous selections, and provides real-time validation.

**Learn more:** [Environment Deployment Specification](spec/environment_deployment.md)

### 3. Autocomplete

Intelligent autocomplete for faster blueprint authoring.

#### a. Grains Autocomplete

Context-aware autocomplete for grain references in blueprint YAML files. Auto-suggests available grains based on your Torque space configuration.

**Learn more:** [Blueprint Autocomplete Specification](spec/blueprint_autocomplete.md)

#### b. Blueprints Autocomplete (TBD)

Coming soon: Autocomplete support for blueprint references.

### 4. Create New Blueprint Action

Quickly scaffold new blueprints with a pre-configured template. Use the File > New File menu or command palette to create `blueprint.yaml` files with proper schema and structure.

**Learn more:** [Blueprint YAML Support Specification](spec/blueprint_yaml_support.md)

## Getting Started

### Installation

1. Install the extension from the VS Code marketplace
2. Run the command "Configure Torque AI" from the command palette
3. Enter your Torque platform URL and API token
4. Select your active space

**Learn more:** [Extension Configuration Specification](spec/extension_configuration.md) | [Torque Space Selection](spec/torque_space_selection.md)

### MCP Integration

The extension automatically registers as an MCP (Model Context Protocol) server for AI chat systems like Claude, Cursor, and Windsurf. This enables AI assistants to access Torque environment data and help with troubleshooting.

**Learn more:** [MCP Auto Installation Specification](spec/mcp_auto_installation.md)

## Configuration

| Setting              | Type   | Default                  | Description                   |
| -------------------- | ------ | ------------------------ | ----------------------------- |
| `torque.url`         | string | `https://localhost:5051` | Torque platform API URL       |
| `torque.token`       | string | -                        | API authentication token      |
| `torque.activeSpace` | string | -                        | Currently active Torque space |

Settings can be configured at global, workspace, or workspace folder scope.

## Architecture Overview

The extension integrates with VS Code through multiple touchpoints:

- **CodeLens Providers**: Display inline actions above blueprint files
- **Completion Providers**: Intelligent autocomplete for YAML authoring
- **Diagnostic Provider**: Validation errors in Problems panel
- **URI Handler**: Deep linking from external applications
- **Language Model Tools**: MCP server integration for AI chat
- **Commands**: Command palette and context menu actions

### Key Components

- **Extension Host** - Main activation and lifecycle management
- **URI Router** - Pattern-based routing for deep links (`vscode://quali.torque-ai/`)
- **API Client** - Authenticated HTTP client with token management
- **Settings Manager** - Multi-scope configuration with secret storage
- **Express Server** - Local HTTP server (ports 33100-33199) for external integrations

### Data Flow Example: Environment Context Injection

1. User clicks deep link: `vscode://quali.torque-ai/chat/context/add/environment/my-space/env-123`
2. URI Router matches pattern and extracts space name and environment ID
3. API Client fetches environment details and introspection data from Torque platform
4. Temporary JSON file created with environment context and workflows
5. VS Code chat command opens with file attached
6. AI assistant analyzes environment data to help troubleshoot issues

**Learn more:** [URI Handling Specification](spec/uri_handling.md) | [Environment Context Injection](spec/environment_context_injection.md)

## Development

### Build Commands

```shell
# Install dependencies
npm ci

# Development build with watch mode
npm run watch

# Type checking
npm run check-types

# Run tests
npm test

# Lint code
npm run lint

# Create extension package
npm run package
```

### Project Structure

- `src/` - TypeScript source code
  - `api/` - API client and service layer
  - `commands/` - VS Code command implementations
  - `domains/` - Feature domains (blueprints, environments, etc.)
  - `providers/` - VS Code providers (CodeLens, Completion, etc.)
  - `uris/` - URI routing and handlers
- `spec/` - Feature specifications and documentation
- `test/` - Integration and unit tests
- `test-workspace/` - Test workspace for development

**Learn more:** See [CLAUDE.md](CLAUDE.md) for detailed development guidelines

## Documentation

Complete feature specifications are available in the [spec/](spec/) directory:

- [Blueprint YAML Support](spec/blueprint_yaml_support.md)
- [Blueprint Autocomplete](spec/blueprint_autocomplete.md)
- [Environment Context Injection](spec/environment_context_injection.md)
- [Environment Deployment](spec/environment_deployment.md)
- [Environment Validation](spec/environment_validation.md)
- [Blueprint Running Environments](spec/blueprint_running_environments.md)
- [URI Handling](spec/uri_handling.md)
- [Extension Configuration](spec/extension_configuration.md)
- [Torque Space Selection](spec/torque_space_selection.md)
- [MCP Auto Installation](spec/mcp_auto_installation.md)
- [Spec to Code Mapping](spec/SPEC_TO_CODE_MAPPING.md)

## License

[MIT](/LICENSE)
