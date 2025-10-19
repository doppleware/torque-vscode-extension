# Refactoring Plan: Domain-Based Structure

## Overview

Refactor the Torque VS Code extension to create clear separation around four main domains:

1. Blueprint Authoring
2. MCP Installation
3. Setup and Configuration
4. Environment Context Injection

## Current Structure Issues

- `extension.ts` is 1000+ lines with mixed concerns
- Tests are flat in `src/test/suite/` with no logical grouping
- Related functionality scattered across multiple locations
- No clear module boundaries

## Target Structure

```
src/
├── extension.ts                          (minimal - just activation/registration)
├── domains/
│   ├── blueprint-authoring/
│   │   ├── commands/
│   │   │   └── createBlueprintCommand.ts
│   │   ├── templates/
│   │   │   └── blueprintTemplate.ts
│   │   └── index.ts
│   ├── mcp/
│   │   ├── mcpServerManager.ts
│   │   ├── mcpHealthCheck.ts
│   │   └── index.ts
│   ├── setup/
│   │   ├── SettingsManager.ts
│   │   ├── commands/
│   │   │   ├── setupCommand.ts
│   │   │   ├── statusCommand.ts
│   │   │   └── resetCommand.ts
│   │   ├── firstTimeSetup.ts
│   │   └── index.ts
│   └── environment-context/
│       ├── commands/
│       │   └── injectContextCommand.ts
│       ├── tools/
│       │   └── TorqueEnvironmentDetailsTool.ts
│       ├── handlers/
│       │   └── environmentContextHandler.ts
│       └── index.ts
├── api/                                  (unchanged)
│   ├── ApiClient.ts
│   └── services/
│       ├── Service.ts
│       ├── AuthenticationService.ts
│       ├── AgenticService.ts
│       └── types.ts
├── uris/                                 (simplified)
│   ├── UriRouter.ts
│   └── handlers/
│       ├── webview.ts
│       └── context.ts
├── ides/                                 (unchanged)
│   ├── ideCommands.ts
│   ├── getGlobalMcpFolderPath.ts
│   ├── getGlobalSettingsFolderPath.ts
│   └── getWorkspaceSettingsFolderPath.ts
├── utils/                                (unchanged)
│   └── Logger.ts
└── types.ts

src/test/
├── suite/
│   ├── blueprint-authoring/
│   │   └── createBlueprint.test.ts
│   ├── mcp/
│   │   └── mcpServerManager.test.ts
│   ├── setup/
│   │   ├── settingsManager.test.ts
│   │   ├── setupCommand.test.ts
│   │   └── statusCommand.test.ts
│   ├── environment-context/
│   │   ├── environmentContext.test.ts
│   │   └── torqueLanguageModelTools.test.ts
│   ├── api/
│   │   ├── apiClient.test.ts
│   │   └── apiIntegration.test.ts
│   ├── uris/
│   │   ├── uriRouter.test.ts
│   │   └── uriHandlerIntegration.test.ts
│   ├── extension.test.ts
│   └── endToEndIntegration.test.ts
├── index.ts
├── runTest.ts
└── mockServer.ts
```

## Refactoring Steps

### Step 1: Create Domain Folder Structure

- Create `src/domains/` directory
- Create subdirectories for each domain
- Run tests to ensure nothing breaks

### Step 2: Move Blueprint Authoring

**Files to move:**

- Extract blueprint command from `extension.ts` (lines 793-881) → `domains/blueprint-authoring/commands/createBlueprintCommand.ts`
- Create `domains/blueprint-authoring/templates/blueprintTemplate.ts` for template content
- Create `domains/blueprint-authoring/index.ts` for public API

**Tests to move:**

- `createBlueprint.test.ts` → `test/suite/blueprint-authoring/createBlueprint.test.ts`

**Run tests after:** `npm test`

### Step 3: Move MCP Installation

**Files to move:**

- `registerMcpServer.ts` → `domains/mcp/mcpServerManager.ts`
- Extract health check logic → `domains/mcp/mcpHealthCheck.ts`
- Create `domains/mcp/index.ts`

**Tests to create/move:**

- Extract MCP tests from `setupCommand.test.ts` → `test/suite/mcp/mcpServerManager.test.ts`

**Run tests after:** `npm test`

### Step 4: Move Setup/Configuration

**Files to move:**

- `SettingsManager.ts` → `domains/setup/SettingsManager.ts`
- Extract setup command from `extension.ts` (lines 676-730) → `domains/setup/commands/setupCommand.ts`
- Extract status command from `extension.ts` → `domains/setup/commands/statusCommand.ts`
- Extract reset command from `extension.ts` → `domains/setup/commands/resetCommand.ts`
- Extract first-time setup from `extension.ts` → `domains/setup/firstTimeSetup.ts`
- Create `domains/setup/index.ts`

**Tests to move:**

- `settingsManager.test.ts` → `test/suite/setup/settingsManager.test.ts`
- `setupCommand.test.ts` → `test/suite/setup/setupCommand.test.ts`

**Run tests after:** `npm test`

### Step 5: Move Environment Context Injection

**Files to move:**

- `tools/TorqueLanguageModelTools.ts` → `domains/environment-context/tools/TorqueEnvironmentDetailsTool.ts`
- `uris/handlers/environmentContext.ts` → `domains/environment-context/handlers/environmentContextHandler.ts`
- Create `domains/environment-context/index.ts`

**Tests to move:**

- `environmentContext.test.ts` → `test/suite/environment-context/environmentContext.test.ts`
- `torqueLanguageModelTools.test.ts` → `test/suite/environment-context/torqueLanguageModelTools.test.ts`

**Run tests after:** `npm test`

### Step 6: Restructure Remaining Tests

**Create test domain folders:**

- `test/suite/api/` - Move API tests
- `test/suite/uris/` - Move URI tests

**Run tests after:** `npm test`

### Step 7: Update extension.ts

- Import domain modules from `domains/*/index.ts`
- Replace inline command registrations with domain exports
- Keep only activation/deactivation logic
- Maintain Express server and URI handler setup

**Run tests after:** `npm test`

### Step 8: Final Validation

- Run full test suite: `npm test`
- Run linting: `npm run lint`
- Run type checking: `npm run check-types`
- Test build: `npm run build:dev`

## Benefits

1. **Clear Module Boundaries**: Each domain has its own folder with clear responsibilities
2. **Easier Navigation**: Related files grouped together
3. **Better Testability**: Tests mirror source structure
4. **Scalability**: Easy to add new features within domains
5. **Reduced Cognitive Load**: Smaller, focused files instead of 1000+ line extension.ts
6. **Better Imports**: `import { createBlueprint } from './domains/blueprint-authoring'`

## Migration Safety

- Each step followed by test run
- No functionality changes, only reorganization
- Git commits after each successful step
- Rollback possible at any step

## Timeline

Estimated: 2-3 hours with full test coverage validation
