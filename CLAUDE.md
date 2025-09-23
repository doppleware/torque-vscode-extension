# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Torque AI VS Code extension by Quali. It provides autonomous identification, root cause analysis and remediation of code and infrastructure issues through integration with observability tools like OpenTelemetry and Jaeger.

## Development Commands

### Build Commands
- `npm run build:dev` - Clean build for development (with sourcemaps)
- `npm run build:prod` - Clean production build (minified, no sourcemaps)
- `npm run compile:dev` - Type check + development build
- `npm run compile:prod` - Type check + production build

### Development Workflow
- `npm run watch` - Run both esbuild and TypeScript compiler in watch mode
- `npm run watch:esbuild` - Watch mode for esbuild only
- `npm run watch:tsc` - Watch mode for TypeScript compiler only

### Code Quality
- `npm run check-types` - Run TypeScript type checking without emit
- `npm run lint` - Run ESLint with caching
- `npm run fix:prettier` - Format code with Prettier

### Testing
- `npm test` - Run all integration tests using VS Code Test CLI
- `npm run pretest` - Compile and lint before running tests

### Packaging
- `npm run package` - Create VSIX package for distribution
- `npm run vscode:prepublish` - Prepublish script (runs compile:prod)

## Architecture

### Core Components

**Extension Entry Point (`src/extension.ts`)**
- Main activation/deactivation logic
- Express server setup (ports 33100-33199)
- URI routing and webview handling
- Configuration change monitoring
- API client initialization

**API Client (`src/api/ApiClient.ts`)**
- HTTP client with automatic token refresh
- Service-based architecture (Authentication, Agentic)
- Request/response interceptors for auth handling
- Self-signed certificate support

**Settings Management (`src/SettingsManager.ts`)**
- Unified settings interface for VS Code configuration
- Scope detection (global/workspace/workspace folder)
- Secret storage integration
- Configuration change tracking

**URI Routing (`src/uris/UriRouter.ts`)**
- Custom URI scheme handling for vscode://torque/ URLs
- Route registration and parameter extraction
- Integration with VS Code URI handler

### Service Layer (`src/api/services/`)
- `AuthenticationService` - Login, token refresh, session management
- `AgenticService` - AI agent interactions
- `Service` - Base service class with common HTTP functionality

### IDE Integration (`src/ides/`)
- Global and workspace settings folder path resolution
- MCP (Model Context Protocol) server integration
- VS Code specific command handling

### Key Features
- **Authentication**: Token-based auth with automatic refresh
- **MCP Integration**: Configurable MCP server registration
- **Webview Support**: Secure domain-restricted webview opening
- **File Context**: Incident file attachment to chat context
- **Express API**: Local HTTP server for external integrations

## Configuration

The extension uses these VS Code settings:
- `torque.url` - API endpoint URL (default: https://localhost:5051)
- `torque.token` - API access token
- `torque.login` - User login credential
- `torque.password` - User password credential
- `torque.copySettingsToMcp` - Enable MCP server configuration sync

## Build System

Uses esbuild for fast compilation with TypeScript. The build configuration (`esbuild.ts`) includes:
- Entry point: `src/extension.ts`
- Output: `out/extension.js`
- CommonJS format for Node.js compatibility
- External: VS Code API
- Development: sourcemaps enabled
- Production: minification enabled

## Testing

### Test Structure
- Integration tests located in `src/test/suite/`
- Uses Mocha test framework with VS Code Test CLI
- Test configuration in `.vscode-test.js`
- Debugging configuration available in `.vscode/launch.json`

### Test Coverage
- **Extension activation and lifecycle**
- **Settings management and configuration**
- **API client initialization and methods**
- **URI routing and handler registration**

### Running Tests
Use `npm test` to run all tests. Tests will:
1. Compile the extension in development mode
2. Run linting checks
3. Launch VS Code with the extension loaded
4. Execute all test suites in the test workspace

## Development Notes

- The extension activates on VS Code startup (`onStartupFinished`)
- Uses Express server for external API communication
- Implements automatic port detection in range 33100-33199
- Supports self-signed certificates via `rejectUnauthorized: false`
- Configuration changes trigger client re-initialization
- MCP server registration is conditional based on settings