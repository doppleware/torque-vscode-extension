# Environment Validation

## Overview

The Torque VS Code extension provides integrated blueprint validation that checks blueprint YAML files against the Torque platform's validation rules. This functionality includes real-time error and warning reporting, integration with VS Code's Problems panel, and seamless CodeLens access.

## Features

### 1. Validate Blueprint Command

**Command ID**: `torque.blueprintActions` (with validate action)

**Access Points**:

- CodeLens: "Validate" action above blueprint YAML files
- Command Palette: "Torque: Blueprint Actions" > Select "Validate"

**Behavior**:

1. Reads blueprint YAML content from active editor
2. Encodes blueprint content as base64
3. Sends validation request to Torque API
4. Displays errors and warnings in VS Code Problems panel
5. Shows success message if no issues found

**Implementation**: [ValidateBlueprintAction.ts](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts)

### 2. Blueprint Validation API

The extension validates blueprints using the Torque platform's validation API.

**API Endpoint**:

```
POST /api/spaces/{spaceName}/blueprints/validate
```

**Request Payload**:

```typescript
{
  blueprint_name: string,              // Blueprint file name (without extension)
  blueprint_raw_64: string             // Base64-encoded blueprint YAML content
}
```

**Response**:

```typescript
{
  errors: [
    {
      message: string,                 // Error description
      name?: string,                   // Error identifier
      code?: string,                   // Error code
      line?: number,                   // Line number (1-indexed)
      column?: number,                 // Column number (1-indexed)
      path?: string                    // YAML path to error location
    }
  ],
  warnings?: [
    {
      message: string,                 // Warning description
      name?: string,                   // Warning identifier
      code?: string,                   // Warning code
      line?: number,                   // Line number (1-indexed)
      column?: number,                 // Column number (1-indexed)
      path?: string                    // YAML path to warning location
    }
  ]
}
```

**Implementation**: [SpacesService.ts:225-282](../src/api/services/SpacesService.ts#L225-L282)

### 3. Problems Panel Integration

Validation errors and warnings are displayed in VS Code's built-in Problems panel.

**Diagnostic Collection**:

- Collection Name: "Torque Blueprint Validation"
- Diagnostics are associated with the blueprint file URI
- Cleared on each validation run

**Diagnostic Severity Mapping**:

| Torque Response | VS Code Severity |
| --------------- | ---------------- |
| `errors[]`      | Error (red)      |
| `warnings[]`    | Warning (yellow) |

**Diagnostic Properties**:

```typescript
{
  message: string,                     // Error/warning message
  severity: DiagnosticSeverity,        // Error or Warning
  range: Range,                        // Line/column location
  source: "Torque"                     // Diagnostic source label
}
```

**Implementation**: [ValidateBlueprintAction.ts:119-161](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L119-L161)

### 4. Error Location Detection

The extension attempts to find the exact location of errors in the blueprint file.

**Location Detection Strategy**:

1. **Explicit Line/Column**: Uses `line` and `column` from API response if provided
2. **YAML Path Parsing**: Parses `path` field to locate error (e.g., `grains.web-server.spec.source`)
3. **Fallback**: Defaults to line 1 if location cannot be determined

**YAML Path Resolution**:

The extension recursively traverses the parsed YAML document to find the location of errors specified by path:

```typescript
// Example path: "grains.web-server.spec.source"
// Finds the line number of the "source" field within the web-server grain
```

**Implementation**: [ValidateBlueprintAction.ts:163-252](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L163-L252)

### 5. Success Notifications

When validation succeeds with no errors or warnings:

**Message**:

```
Blueprint validation passed ✓
```

When validation succeeds but has warnings:

**Message**:

```
Blueprint validation passed with warnings. Check the Problems panel for details.
```

**Implementation**: [ValidateBlueprintAction.ts:106-117](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L106-L117)

### 6. Diagnostic Clearing

The extension clears previous diagnostics before running a new validation:

**Behavior**:

1. Before validation: Clear all diagnostics for the current document
2. After validation: Add new diagnostics (if any)
3. Result: Each validation run shows only the current issues

**Why This Matters**:

- Prevents stale errors from remaining in Problems panel
- Ensures Problems panel reflects current blueprint state
- Allows users to see when issues are fixed

**Implementation**: [ValidateBlueprintAction.ts:103](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L103)

## Prerequisites

### Required Configuration

Before validating, the following must be configured:

1. **Torque URL**: Extension setting `torque.url`
2. **API Token**: Stored in VS Code SecretStorage
3. **Active Space**: Either:
   - Global setting: `torque.space`
   - Workspace setting: `torque.activeSpace`

### Prerequisite Checks

The extension validates prerequisites before running validation:

**Error Messages**:

| Condition           | Error Message                                                                  |
| ------------------- | ------------------------------------------------------------------------------ |
| No API client       | "Torque is not configured. Please run 'Torque: Setup Extension' to configure." |
| No space configured | "No space is configured. Please set an active space first."                    |

**Implementation**: [ValidateBlueprintAction.ts:72-90](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L72-L90)

## Error Handling

### API Errors

**Network Errors**:

- Error message: "Failed to validate blueprint: {error details}"
- No diagnostics added to Problems panel

**HTTP Errors**:

- Error message includes status code and response details
- Logged for debugging

**Error Display**:

```
Failed to validate blueprint: API request failed: 500 Internal Server Error
```

**Implementation**: [ValidateBlueprintAction.ts:254-269](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L254-L269)

### YAML Parsing Errors

The extension uses `js-yaml` to parse the blueprint for location detection:

**Parsing Failures**:

- Logs warning but continues with validation
- Location detection falls back to line 1
- Validation still runs and shows API-provided errors

**Why Still Run Validation**:

Even if local YAML parsing fails, the Torque API may provide more detailed validation errors, so the validation request is still sent.

**Implementation**: [ValidateBlueprintAction.ts:188-196](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L188-L196)

## Validation Error Examples

### Example 1: Missing Required Field

**Blueprint**:

```yaml
spec_version: 2
description: "Web app"
grains:
  - name: web-server
    kind: terraform
    spec:
      # Missing 'source' field
```

**API Response**:

```json
{
  "errors": [
    {
      "message": "Missing required field: source",
      "path": "grains.web-server.spec",
      "line": 5,
      "column": 5
    }
  ]
}
```

**Problems Panel**:

```
Error: Missing required field: source
  at my-blueprint.yaml:5:5
```

### Example 2: Invalid Grain Type

**Blueprint**:

```yaml
spec_version: 2
grains:
  - name: my-service
    kind: invalid-type
```

**API Response**:

```json
{
  "errors": [
    {
      "message": "Invalid grain kind: invalid-type. Must be one of: terraform, helm, shell, cloudformation",
      "path": "grains.my-service.kind",
      "line": 4,
      "column": 11
    }
  ]
}
```

**Problems Panel**:

```
Error: Invalid grain kind: invalid-type. Must be one of: terraform, helm, shell, cloudformation
  at my-blueprint.yaml:4:11
```

### Example 3: Warning for Deprecated Feature

**Blueprint**:

```yaml
spec_version: 2
grains:
  - name: db
    kind: terraform
    spec:
      source:
        store: my-repo
        path: old-module
      tf-version: 0.12 # Deprecated
```

**API Response**:

```json
{
  "errors": [],
  "warnings": [
    {
      "message": "tf-version is deprecated. Use terraform_version instead",
      "path": "grains.db.spec.tf-version",
      "line": 9,
      "column": 7
    }
  ]
}
```

**Problems Panel**:

```
Warning: tf-version is deprecated. Use terraform_version instead
  at my-blueprint.yaml:9:7
```

## Blueprint Name Extraction

The extension extracts the blueprint name from the file path:

**Extraction Logic**:

1. Get file URI from active editor
2. Extract file name (e.g., `my-blueprint.yaml`)
3. Remove extension (`.yaml` or `.yml`)
4. Use as blueprint name

**Examples**:

| File Path                     | Blueprint Name |
| ----------------------------- | -------------- |
| `/workspace/my-app.yaml`      | `my-app`       |
| `/blueprints/web-service.yml` | `web-service`  |
| `C:\projects\database.yaml`   | `database`     |

**Implementation**: [ValidateBlueprintAction.ts:94-101](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L94-L101)

## Base64 Encoding

The blueprint content is encoded as base64 before sending to the API:

**Why Base64**:

- Ensures safe transmission of YAML content (preserves formatting, special characters)
- Standard encoding for binary/text data in HTTP requests
- Prevents encoding issues with line breaks and Unicode characters

**Encoding Process**:

```typescript
const content = document.getText();
const base64Content = Buffer.from(content, "utf-8").toString("base64");
```

**Implementation**: [ValidateBlueprintAction.ts:92](../src/domains/blueprint-authoring/commands/actions/ValidateBlueprintAction.ts#L92)

## Test Coverage

The validation functionality is thoroughly tested in [validateBlueprintAction.test.ts](../src/test/suite/blueprint-authoring/validateBlueprintAction.test.ts).

**Test Suites**:

### Blueprint Validation with Errors

- ✓ Show error diagnostics when validation fails
- ✓ Show warning diagnostics when validation passes with warnings
- ✓ Clear diagnostics when validation passes
- ✓ Handle multiple errors and warnings

### Error Location Finding

- ✓ Find error location from YAML path
- ✓ Use explicit line/column when provided
- ✓ Fallback to first line when error location cannot be determined

### Validation Prerequisites

- ✓ Show error when no API client is configured
- ✓ Show error when no space is configured
- ✓ Use active space when configured
- ✓ Fallback to default space when active space is not set

### Blueprint Content Encoding

- ✓ Encode blueprint content as base64
- ✓ Extract blueprint name from URI

### Error Handling

- ✓ Handle API errors gracefully
- ✓ Handle network errors

**Running Tests**:

```bash
npm test
```

## Usage Examples

### Validating a Blueprint via CodeLens

1. Open a blueprint YAML file (e.g., `my-app.yaml`)
2. Click the "Validate" CodeLens above the file
3. Wait for validation to complete
4. Check Problems panel for any errors or warnings
5. If issues found, fix them and validate again

### Validating via Command Palette

1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Torque: Blueprint Actions"
3. Press Enter
4. Select "$(check) Validate" from the actions menu
5. Review results in Problems panel

### Typical Validation Workflow

1. **Create Blueprint**: Write blueprint YAML
2. **Validate**: Click Validate CodeLens
3. **Review Errors**: Check Problems panel
4. **Fix Issues**: Update blueprint based on errors
5. **Re-validate**: Click Validate again
6. **Deploy**: Once validation passes, deploy the environment

### Example: Fixing Validation Errors

**Initial Blueprint**:

```yaml
spec_version: 2
description: "Web app"
grains:
  - name: web-server
    kind: terraform
    spec:
      # Missing source
```

**Validation Result**:

```
❌ Error: Missing required field: source
   at my-blueprint.yaml:5:5
```

**Fixed Blueprint**:

```yaml
spec_version: 2
description: "Web app"
grains:
  - name: web-server
    kind: terraform
    spec:
      source:
        store: my-repo
        path: terraform/web
```

**Re-validation Result**:

```
✓ Blueprint validation passed
```

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────┐
│        Blueprint YAML File              │
│        (my-blueprint.yaml)              │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   ValidateBlueprintAction.execute()     │
│   (ValidateBlueprintAction.ts)          │
│                                         │
│  • Read blueprint content               │
│  • Extract blueprint name               │
│  • Check prerequisites                  │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Encode Content as Base64              │
│                                         │
│  • Convert UTF-8 to base64              │
│  • Prepare API request                  │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Validate Blueprint                    │
│   (SpacesService.validateBlueprint)     │
│                                         │
│  • POST /blueprints/validate            │
│  • Return errors and warnings           │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Parse YAML for Location Detection     │
│                                         │
│  • Parse blueprint structure            │
│  • Build location map                   │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Find Error Locations                  │
│                                         │
│  • Match API errors to line numbers     │
│  • Use explicit line/column if provided │
│  • Resolve YAML paths                   │
│  • Fallback to line 1                   │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Create VS Code Diagnostics            │
│                                         │
│  • Map errors to Error severity         │
│  • Map warnings to Warning severity     │
│  • Set source to "Torque"               │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Update Problems Panel                 │
│                                         │
│  • Clear previous diagnostics           │
│  • Add new diagnostics                  │
│  • Show success message if no issues    │
└─────────────────────────────────────────┘
```

### Data Flow

1. **User Action**: User clicks "Validate" CodeLens or selects validate from command palette
2. **Document Read**: Extension reads blueprint YAML content from active editor
3. **Prerequisite Check**: Validates API client and space configuration
4. **Name Extraction**: Extracts blueprint name from file path
5. **Content Encoding**: Encodes blueprint content as base64
6. **API Request**: Sends validation request to Torque API
7. **Response Processing**: Receives errors and warnings
8. **Location Detection**: Parses YAML and finds error locations
9. **Diagnostic Creation**: Creates VS Code diagnostics for each issue
10. **Panel Update**: Updates Problems panel with diagnostics
11. **User Notification**: Shows success or error message

## Dependencies

**Required**:

- VS Code API 1.85.0 or higher
- `js-yaml` - YAML parsing library
- Configured Torque API client

**Optional**:

- Active space configuration (can be set during validation if not configured)

## Configuration

**Extension Settings**:

| Setting              | Description                      | Required |
| -------------------- | -------------------------------- | -------- |
| `torque.url`         | Torque API endpoint URL          | Yes      |
| `torque.token`       | API access token (SecretStorage) | Yes      |
| `torque.space`       | Default space name               | Optional |
| `torque.activeSpace` | Active workspace space           | Optional |

**Diagnostic Collection**:

- ID: `torque-blueprint-validation`
- Scope: Per-document (cleared and updated on each validation)

## Integration with Other Features

### CodeLens Provider

The validation action is integrated with the blueprint CodeLens provider:

- Appears above blueprint YAML files
- Positioned next to other blueprint actions (Deploy, Sync)
- Shows blueprint metadata (space name)

**Related**: [Blueprint CodeLens Provider](./blueprint_yaml_support.md#codelens-integration)

### Space Selection

Validation uses the active workspace space if configured:

- Priority: `torque.activeSpace` > `torque.space`
- Allows per-workspace validation contexts
- Users can switch spaces without reconfiguring

**Related**: [Torque Space Selection](./torque_space_selection.md)

## Future Enhancements

Potential improvements to blueprint validation:

- [ ] Real-time validation on file save
- [ ] Inline validation errors (squiggly underlines)
- [ ] Quick fixes for common validation errors
- [ ] Validation of referenced files (Terraform modules, Helm charts)
- [ ] Custom validation rules
- [ ] Validation caching (skip re-validation if content unchanged)
- [ ] Diff-based validation (validate only changed sections)
- [ ] Integration with CI/CD pipelines
- [ ] Batch validation (multiple blueprints)
- [ ] Validation history and trends

## Related Documentation

- [Environment Deployment](./environment_deployment.md)
- [Blueprint YAML Support](./blueprint_yaml_support.md)
- [Extension Configuration](./extension_configuration.md)
- [Torque Space Selection](./torque_space_selection.md)

## References

- **API Documentation**: Torque REST API v2
- **Blueprint Spec**: Torque Blueprint Specification v2
- **YAML Library**: https://github.com/nodeca/js-yaml
- **VS Code Diagnostics API**: https://code.visualstudio.com/api/references/vscode-api#Diagnostic
