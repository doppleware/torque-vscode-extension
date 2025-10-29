# Agent Instructions for Blueprint Development

## Overview

The Torque VS Code extension automatically provides AI agent instructions to enhance the blueprint development experience. When the extension activates, it creates a GitHub Copilot instruction file that guides AI assistants on how to use Torque MCP tools effectively.

## Purpose

This feature ensures that AI coding assistants (like GitHub Copilot) understand:

- How to interact with Torque platform via MCP tools
- When to use Torque-specific tools for environment management
- Best practices for querying environment details
- Proper error handling and user guidance

## Implementation

### Automatic Instruction File Creation

**Trigger**: Extension activation (`activate()` function in [extension.ts:300](../src/extension.ts#L300))

**Function**: `registerAgentInstructions(context: ExtensionContext)`

**Implementation**: [extension.ts:192-273](../src/extension.ts#L192-L273)

### Workflow

1. **Setting Enablement**
   - Reads GitHub Copilot configuration: `github.copilot.chat.codeGeneration.useInstructionFiles`
   - If disabled, enables it at workspace scope
   - Allows Copilot to read instruction files for context

2. **Workspace Validation**
   - Checks if workspace folder exists
   - If no workspace: skips instruction file creation (logs warning)
   - Uses first workspace folder as root

3. **Directory Setup**
   - Target directory: `<workspace>/.github/`
   - Creates directory if it doesn't exist
   - Ignores errors if directory already exists

4. **File Existence Check**
   - Target file: `<workspace>/.github/copilot-instructions.md`
   - Uses `vscode.workspace.fs.stat()` to check if file exists
   - If file exists: skips creation (preserves user customizations)
   - If file doesn't exist: proceeds with template copy

5. **Template Copy**
   - Source: `<extension>/docs/torque_dev_instruction.md`
   - Destination: `<workspace>/.github/copilot-instructions.md`
   - Uses `vscode.workspace.fs.readFile()` and `writeFile()` for atomic copy
   - Logs success or failure

### Error Handling

The instruction file setup is **non-critical** and uses graceful degradation:

| Error Condition          | Behavior                       | Log Level |
| ------------------------ | ------------------------------ | --------- |
| No workspace folder      | Skip creation                  | Warning   |
| Directory creation fails | Continue (might already exist) | Silent    |
| Template file not found  | Log error, continue activation | Warning   |
| File write fails         | Log error, continue activation | Warning   |
| Setting update fails     | Continue activation            | Silent    |

**Rationale**: Extension should activate successfully even if instruction file setup fails. This ensures core functionality remains available.

## Instruction File Content

The template file ([torque_dev_instruction.md](../docs/torque_dev_instruction.md)) contains:

### 1. Tool Documentation

**TorqueEnvironmentDetailsTool**:

- Tool name: `torque_get_environment_details`
- Purpose: Fetch comprehensive environment information
- Required parameters: `space_name`, `environment_id`
- Response format: Formatted markdown with status, cost, resources, etc.

### 2. Usage Guidelines

**When to Use**:

- User asks about specific environment status
- Troubleshooting environment issues
- Cost inquiries
- Resource and connection information
- Before making environment changes

**When NOT to Use**:

- General coding questions
- File operations or code analysis
- Questions unrelated to Torque
- Missing required parameters (space/environment ID)

### 3. Best Practices

1. **Ask for Missing Information**: Request space name/environment ID if not provided
2. **Use Natural Language**: Convert technical data to conversational responses
3. **Summarize Appropriately**: Extract specific information requested by user
4. **Handle Errors Gracefully**: Provide helpful guidance on failures
5. **Suggest Related Actions**: Offer relevant next steps after showing details

### 4. Example Interactions

The file includes three levels of interaction examples:

- **Good**: Basic tool usage
- **Better**: Asking for clarification before calling tool
- **Best**: Contextual follow-up and proactive suggestions

### 5. Configuration Requirements

- `torque.url` - Torque API endpoint
- `torque.token` - API access token (stored securely)
- Suggests running `Torque: Configure Torque AI` if tools aren't working

## File Locations

| File      | Location                                      | Purpose                                     |
| --------- | --------------------------------------------- | ------------------------------------------- |
| Template  | `<extension>/docs/torque_dev_instruction.md`  | Source template bundled with extension      |
| Generated | `<workspace>/.github/copilot-instructions.md` | Workspace-specific instructions for Copilot |

## GitHub Copilot Integration

### Instruction File Format

GitHub Copilot reads `.github/copilot-instructions.md` to understand project-specific context.

**Format**: Markdown file with:

- Tool documentation
- Usage guidelines
- Example interactions
- Configuration requirements

### Setting: `useInstructionFiles`

**Configuration Key**: `github.copilot.chat.codeGeneration.useInstructionFiles`

**Type**: Boolean

**Default**: `false`

**Extension Behavior**:

- Checks current value on activation
- Sets to `true` at workspace scope if disabled
- Allows Copilot to read instruction files

**Scope**: Workspace (not global, to avoid affecting other projects)

## User Customization

Users can customize the instruction file after creation:

**Preservation**:

- Extension only creates file if it doesn't exist
- Never overwrites existing instruction file
- User modifications are preserved across extension updates

**Customization Options**:

1. Add project-specific tool usage patterns
2. Include additional environment naming conventions
3. Add team-specific workflows
4. Extend with custom examples

**Reset**:
To reset to default template:

1. Delete `.github/copilot-instructions.md`
2. Reload VS Code window
3. Extension recreates file from template

## Logging

All instruction file operations are logged for debugging:

```typescript
logger.debug("Setting up Torque AI agent instructions");
logger.info("Enabled GitHub Copilot instruction files setting");
logger.debug("GitHub Copilot instruction file already exists");
logger.info("Creating GitHub Copilot instruction file");
logger.info("Created GitHub Copilot instruction file from Torque template");
logger.warn(
  "Could not copy Torque instruction template to Copilot instruction file"
);
logger.debug("Agent instructions setup completed");
```

**Log Levels**:

- `debug`: Normal flow events
- `info`: Successful operations
- `warn`: Non-critical failures

## Testing

### Manual Testing

1. **First Activation**:
   - Open workspace without `.github/copilot-instructions.md`
   - Activate extension
   - Verify file created with template content
   - Verify `useInstructionFiles` setting enabled

2. **Existing File**:
   - Create `.github/copilot-instructions.md` with custom content
   - Activate extension
   - Verify file content unchanged

3. **No Workspace**:
   - Open single file (not in workspace)
   - Activate extension
   - Verify no errors
   - Check logs for warning message

### Integration Testing

Test coverage in extension activation test suite:

```typescript
describe("Agent Instructions Setup", () => {
  it("should create instruction file on first activation");
  it("should preserve existing instruction file");
  it("should enable useInstructionFiles setting");
  it("should handle missing workspace gracefully");
  it("should handle template read errors gracefully");
});
```

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────┐
│     Extension Activation                │
│     (extension.ts:activate)             │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   registerAgentInstructions()           │
│   (extension.ts:192-273)                │
│                                         │
│  1. Enable Copilot setting              │
│  2. Validate workspace exists           │
│  3. Check if file already exists        │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
    File exists      File missing
         │               │
         v               v
    ┌─────────┐    ┌─────────────────────┐
    │  Skip   │    │ Create .github/ dir  │
    │Creation │    │ Copy template file   │
    └─────────┘    │ to workspace         │
                   └─────────────────────┘
                             │
                             v
                   ┌─────────────────────┐
                   │ .github/             │
                   │   copilot-          │
                   │   instructions.md   │
                   └─────────────────────┘
```

### Data Flow

1. **Extension Startup**:

   ```
   VS Code starts → Extension activates → registerAgentInstructions() called
   ```

2. **Template Copy**:

   ```
   Extension URI → docs/torque_dev_instruction.md → readFile() →
   Workspace URI → .github/copilot-instructions.md → writeFile()
   ```

3. **Copilot Integration**:
   ```
   User opens Copilot Chat →
   Copilot reads .github/copilot-instructions.md →
   AI agent uses Torque tool context →
   Better responses for Torque-related queries
   ```

## Benefits

1. **Improved AI Assistance**
   - Copilot understands when to use Torque tools
   - Better suggestions for environment management tasks
   - Contextual awareness of Torque platform capabilities

2. **Reduced User Friction**
   - No manual setup required
   - Automatic configuration on first use
   - Preserves user customizations

3. **Consistent Guidance**
   - Standardized tool usage across team
   - Best practices enforced
   - Clear examples for common scenarios

4. **Developer Experience**
   - Faster environment troubleshooting
   - Natural language queries for environment status
   - AI-powered assistance for blueprint development

## Future Enhancements

Potential improvements:

- [ ] Support for multiple instruction file templates (beginner, advanced)
- [ ] Automatic updates when template changes (with user opt-in)
- [ ] Command to regenerate instruction file from latest template
- [ ] Integration with other AI assistants (Cursor, Windsurf, etc.)
- [ ] Dynamic instruction file generation based on workspace configuration
- [ ] Team-shared instruction files via workspace settings
- [ ] Instruction file validation and linting

## Related Documentation

- [MCP Auto Installation](mcp_auto_installation.md) - MCP server registration
- [Extension Configuration](extension_configuration.md) - Setup and settings
- [Environment Context Injection](environment_context_injection.md) - Environment details feature
- [GitHub Copilot Documentation](https://docs.github.com/en/copilot) - Copilot instruction files

## References

- **Template File**: [docs/torque_dev_instruction.md](../docs/torque_dev_instruction.md)
- **Implementation**: [extension.ts:192-273](../src/extension.ts#L192-L273)
- **GitHub Copilot Setting**: `github.copilot.chat.codeGeneration.useInstructionFiles`
- **File Location**: `<workspace>/.github/copilot-instructions.md`
