# Blueprint YAML File Support

## Overview

The Torque VS Code extension provides integrated support for creating and editing Torque Blueprint YAML files. This functionality includes automatic template injection, JSON schema integration for validation and IntelliSense, and seamless IDE integration.

## Features

### 1. Blueprint File Creation Command

**Command ID**: `torque.createBlueprint`

**Access Points**:

- Command Palette: "Torque: Torque Blueprint"
- File Menu: File > New File > Torque Blueprint
- Category: Torque

**Behavior**:

1. Prompts user for filename with placeholder "blueprint.yaml"
2. Validates filename extension (must be `.yaml` or `.yml`)
3. Checks for existing file and prompts for overwrite confirmation
4. Creates new file with injected template
5. Opens file in editor for immediate editing

**Implementation**: [extension.ts:793-881](../src/extension.ts#L793-L881)

### 2. Template Injection

When a new blueprint file is created, the extension automatically injects a starter template with the following structure:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: ""
inputs:
grains:
```

**Template Components**:

| Component                           | Purpose                                           |
| ----------------------------------- | ------------------------------------------------- |
| `# yaml-language-server:` directive | Enables YAML language server schema validation    |
| `spec_version: 2`                   | Declares blueprint specification version          |
| `description: ''`                   | Placeholder for blueprint description             |
| `inputs:`                           | Section for blueprint input parameters            |
| `grains:`                           | Section for infrastructure/application components |

**Implementation**: [extension.ts:827-832](../src/extension.ts#L827-L832)

### 3. JSON Schema Integration

**Schema URL**:

```
https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
```

**Purpose**:

- Provides real-time YAML validation
- Enables IntelliSense/autocomplete for blueprint properties
- Displays inline documentation for blueprint fields
- Catches schema violations during editing

**Integration Method**:
The schema is referenced via a YAML language server directive in the first line of the template. This directive is recognized by the YAML extension (redhat.vscode-yaml) to provide enhanced editing support.

**Schema Locations in Code**:

- Template injection: [extension.ts:827](../src/extension.ts#L827)
- Package.json template: [package.json:127](../package.json#L127)
- Test validation: [createBlueprint.test.ts:20](../src/test/suite/createBlueprint.test.ts#L20)

### 4. File Menu Integration

The blueprint creation command is registered as a VS Code file template contribution, making it accessible through native VS Code file creation workflows.

**Configuration** ([package.json:120-129](../package.json#L120-L129)):

```json
{
  "fileTemplates": [
    {
      "command": "torque.createBlueprint",
      "languages": ["yaml"],
      "defaultName": "blueprint.yaml",
      "template": "...",
      "icon": "$(file-code)"
    }
  ]
}
```

**Menu Contribution** ([package.json:82-88](../package.json#L82-L88)):

```json
{
  "menus": {
    "file/newFile": [
      {
        "command": "torque.createBlueprint",
        "group": "file"
      }
    ]
  }
}
```

## Filename Validation

The extension enforces strict filename validation to ensure blueprint files use proper YAML extensions:

**Valid Extensions**:

- `.yaml`
- `.yml`

**Validation Logic**:

```typescript
const fileName = await vscode.window.showInputBox({
  prompt: "Enter blueprint file name",
  placeHolder: "blueprint.yaml",
  validateInput: (value) => {
    if (!value.endsWith(".yaml") && !value.endsWith(".yml")) {
      return "File name must end with .yaml or .yml";
    }
    return null;
  }
});
```

**Error Handling**:

- Invalid extension: Displays error message "File name must end with .yaml or .yml"
- User cancellation: Command exits gracefully without creating file
- Existing file: Prompts user "File already exists. Overwrite?" with Yes/No options

## Blueprint Specification Version 2

The template uses `spec_version: 2`, which is the current Torque Blueprint specification version. This version includes:

**Core Sections**:

1. **description**: Human-readable description of the blueprint's purpose
2. **inputs**: Parameter definitions that users provide at environment launch
3. **grains**: Infrastructure and application components that comprise the environment

**Schema Reference**:
The complete specification schema is maintained in the external JSON schema file and provides validation for:

- Required fields and data types
- Valid grain types and configurations
- Input parameter constraints
- Dependency relationships
- Terraform/Helm/script configurations

## Test Coverage

The blueprint functionality is thoroughly tested in [createBlueprint.test.ts](../src/test/suite/createBlueprint.test.ts).

**Test Suites**:

### Create Blueprint Command Tests

- ✓ Command registration verification
- ✓ Filename validation (`.yaml`/`.yml` requirement)
- ✓ Template content injection accuracy
- ✓ File overwrite confirmation handling
- ✓ User cancellation graceful exit

### File Menu Integration Tests

- ✓ Menu contribution in `file/newFile` context
- ✓ Command title and category validation
- ✓ Command Palette accessibility

**Running Tests**:

```bash
npm test
```

## Usage Examples

### Creating a Blueprint via Command Palette

1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Torque Blueprint"
3. Press Enter
4. Enter filename (e.g., "my-app.yaml")
5. Edit the generated template

### Creating a Blueprint via File Menu

1. Click File > New File
2. Select "Torque Blueprint" from the file type menu
3. Enter filename
4. Edit the generated template

### Example Blueprint After Template Expansion

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
spec_version: 2
description: "Web application with database"
inputs:
  - name: instance_type
    type: string
    default: t2.micro
grains:
  - name: web-server
    kind: terraform
    spec:
      source:
        store: my-repo
        path: terraform/web
  - name: database
    kind: helm
    spec:
      source:
        store: my-repo
        path: helm/postgres
    depends-on:
      - web-server
```

## Dependencies

**Required VS Code Extensions** (for full schema support):

- `redhat.vscode-yaml` - YAML language server for schema validation

**Extension Dependencies**:

- VS Code API 1.85.0 or higher

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────┐
│        VS Code Command Palette          │
│         File > New File Menu            │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   torque.createBlueprint Command        │
│   (extension.ts:793-881)                │
│                                         │
│  • Prompt for filename                  │
│  • Validate .yaml/.yml extension        │
│  • Check for existing file              │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│      Template Injection                 │
│      (extension.ts:827-832)             │
│                                         │
│  • Inject YAML template                 │
│  • Include schema directive             │
│  • Add spec_version, sections           │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│      Open in Editor                     │
│                                         │
│  • Display file in editor               │
│  • YAML language server activates       │
│  • Schema validation begins             │
└─────────────────────────────────────────┘
```

### File System Operations

1. **Path Resolution**: Uses `vscode.workspace.workspaceFolders[0].uri` for workspace root
2. **File Creation**: Uses `vscode.workspace.fs.writeFile()` for atomic file writes
3. **File Existence Check**: Uses `vscode.workspace.fs.stat()` to check for existing files
4. **Editor Integration**: Uses `vscode.window.showTextDocument()` to open created file

## Configuration

No additional configuration is required. The blueprint functionality works out-of-the-box after extension installation.

**Optional Enhancements**:

- Install `redhat.vscode-yaml` extension for full schema validation support
- Configure YAML extension settings for custom schema catalogs if needed

## Future Enhancements

Potential improvements to blueprint support:

- [ ] Blueprint template variations (simple, complex, terraform-only, etc.)
- [ ] Inline schema validation error decorations
- [ ] Quick fixes for common blueprint errors
- [ ] Blueprint snippet library
- [ ] Visual blueprint designer/editor
- [ ] Blueprint validation on save
- [ ] Integration with Torque space blueprints (list, import)

## Related Documentation

- [Torque Blueprint Specification](https://docs.qtorque.io/) (external)
- [Extension Architecture](../CLAUDE.md#architecture)
- [Testing Guide](../CLAUDE.md#testing)
- [Development Commands](../CLAUDE.md#development-commands)

## References

- **Schema Repository**: https://github.com/QualiTorque/torque-vs-code-extensions
- **Schema File**: `client/schemas/blueprint-spec2-schema.json`
- **Spec Version**: 2 (current)
