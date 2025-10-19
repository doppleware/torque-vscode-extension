# Torque Space Selection

## Product Purpose

The Torque Space Selection feature enables developers to configure which Torque space to use for blueprint operations, with intelligent workspace-specific overrides and repository-based filtering. This ensures that blueprints and Torque operations automatically use the appropriate space based on the current workspace context, eliminating manual space switching and reducing configuration errors.

## User Experience Requirements

### Workspace-Aware Space Configuration

**Requirement**: Developers must be able to set different Torque spaces for different workspaces while maintaining a global default.

- Global default space applies across all workspaces unless explicitly overridden
- Workspace-specific active space overrides the default for specific projects
- Space selection persists across VS Code sessions
- Clear visual indicators show which space is currently active and whether it's the default or an override

### Repository-Based Space Filtering

**Requirement**: When selecting an active space for a workspace, only spaces containing the current repository should be selectable.

- Extension automatically detects the Git repository for the current workspace
- Space selection shows all available spaces for reference
- Spaces not containing the current repository are visually disabled and cannot be selected
- Clear labeling indicates which spaces contain the repository: `[REPO NOT IN SPACE]`
- If no Git repository is detected, all spaces remain selectable for flexibility

### Contextual Space Visibility

**Requirement**: Developers must always know which Torque space is active for their current context.

- Blueprint YAML files display active space in a CodeLens at the top of the file
- CodeLens clearly indicates whether the active space is the default or a workspace override
- Clicking the CodeLens opens the space selection interface
- CodeLens automatically refreshes when space configuration changes

### Seamless Space Management

**Requirement**: Changing spaces must be quick, intuitive, and accessible from multiple entry points.

- "Set Active Torque Space" command available in Command Palette and via CodeLens
- "Set Default Torque Space" command available in Command Palette
- Space selection interface shows current selection with visual checkmark
- Option to clear workspace override and return to using the default space
- Clear success messages confirm space changes

## Features

### 1. Default Space Configuration

**Command ID**: `torque.setDefaultSpace`

**Access Points**:

- Command Palette: "Torque: Set Default Torque Space"

**Behavior**:

1. Fetches all available spaces from the Torque API
2. Displays QuickPick showing all spaces
3. Shows current default space with `$(check)` indicator
4. Updates global `torque-ai.space` setting
5. Displays confirmation message

**QuickPick Items**:

| Item Format                           | Description                      |
| ------------------------------------- | -------------------------------- |
| `$(check) space-name (Default)`       | Currently selected default space |
| `space-name`                          | Other available spaces           |
| `$(circle-slash) Clear Default Space` | Option to unset the default      |

**Implementation**: [setDefaultSpaceCommand.ts](../src/domains/setup/commands/setDefaultSpaceCommand.ts)

### 2. Active Space Configuration

**Command ID**: `torque.setActiveSpace`

**Access Points**:

- Command Palette: "Torque: Set Active Torque Space"
- Blueprint CodeLens (clickable at top of blueprint YAML files)

**Behavior**:

1. Fetches all available spaces from the Torque API
2. Detects current Git repository URL from the workspace
3. For each space, checks if it contains the current repository via `/api/spaces/{space_name}/repositories` endpoint
4. Displays all spaces with repository-based filtering:
   - Spaces containing the repository are **enabled** (selectable)
   - Spaces not containing the repository are **disabled** (not selectable, marked with `[REPO NOT IN SPACE]`)
5. Updates workspace-specific `torque-ai.activeSpace` setting
6. Displays confirmation message

**QuickPick Items**:

_Enabled Spaces (repository found in space):_

| Item Format                              | Description                               |
| ---------------------------------------- | ----------------------------------------- |
| `$(check) space-name (Active & Default)` | Currently active and also the default     |
| `$(check) space-name (Active)`           | Currently active (explicit override)      |
| `$(check) space-name (Default - Active)` | Default space is active (no override set) |
| `space-name`                             | Other spaces containing the repository    |

_Disabled Spaces (repository not in space):_

| Item Format                             | Description                                            |
| --------------------------------------- | ------------------------------------------------------ |
| `$(x) space-name - [REPO NOT IN SPACE]` | Space does not contain the repository (not selectable) |

_Special Options:_

| Item Format                         | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `$(circle-slash) Use Default Space` | Clears active space override, falls back to default |

**Validation**:

- Attempting to select a disabled space shows warning: "Cannot select "space-name" - repository not found in this space."
- Selection is blocked and no configuration changes are made

**Fallback Behavior**:

- If no Git repository is detected in the workspace, all spaces are shown as enabled
- Warning logged: "No Git repository found, all spaces will be selectable"

**Implementation**: [setActiveSpaceCommand.ts](../src/domains/setup/commands/setActiveSpaceCommand.ts)

### 3. Blueprint CodeLens Display

**Purpose**: Shows the active Torque space at the top of blueprint YAML files.

**Blueprint Detection**:

Blueprint files are identified by:

1. **Language ID**: Must be `yaml`
2. **Schema Reference**: Contains `# yaml-language-server: $schema=https://[...]torque-blueprint-spec[...]`
   **OR**
3. **Spec Version**: Contains `spec_version: 2` field

**CodeLens Display Formats**:

| Format                                  | Scenario                                       |
| --------------------------------------- | ---------------------------------------------- |
| `Active Space: workspace-space`         | Workspace-specific active space is set         |
| `Active Space: default-space (Default)` | No workspace override, using default space     |
| `Active Space: Not Set`                 | Neither active nor default space is configured |

**Interaction**:

- Clicking the CodeLens triggers `torque.setActiveSpace` command
- Opens space selection with repository filtering

**Auto-Refresh**:

- Listens to `vscode.workspace.onDidChangeConfiguration`
- Refreshes when `torque-ai.space` or `torque-ai.activeSpace` changes
- Updates immediately when configuration changes

**Implementation**: [BlueprintCodeLensProvider.ts](../src/domains/blueprint-authoring/codeLens/BlueprintCodeLensProvider.ts)

### 4. Space Resolution Logic

**Priority Order**:

```typescript
const effectiveSpace = activeSpace ?? defaultSpace ?? null;
```

1. **Active Space Set**: If `torque-ai.activeSpace` is set for the workspace, use it
2. **Default Space Fallback**: If no active space is set, use `torque-ai.space`
3. **No Space**: If neither is set, prompt for configuration

**Configuration Scopes**:

| Setting                 | Scope         | Storage Location                             |
| ----------------------- | ------------- | -------------------------------------------- |
| `torque-ai.space`       | Global (User) | VS Code configuration (non-secret)           |
| `torque-ai.activeSpace` | Workspace     | VS Code workspace configuration (non-secret) |

## Repository Detection and Filtering

### Git Repository Detection

**Process**:

1. Uses VS Code Git extension API (`vscode.git`)
2. Finds repository for the current workspace folder
3. Retrieves the first remote (typically `origin`)
4. Extracts and normalizes the remote URL

**URL Normalization**:

Git URLs are normalized for consistent comparison:

| Original Format                    | Normalized Format              |
| ---------------------------------- | ------------------------------ |
| `git@github.com:user/repo.git`     | `https://github.com/user/repo` |
| `https://github.com/user/repo.git` | `https://github.com/user/repo` |
| `https://github.com/user/repo/`    | `https://github.com/user/repo` |

**Comparison Logic**:

```typescript
function isSameRepository(url1: string, url2: string): boolean {
  return normalizeGitUrl(url1) === normalizeGitUrl(url2);
}
```

**Implementation**: [git.ts](../src/utils/git.ts)

### Repository Filtering Process

**API Integration**:

For each space, the extension:

1. Calls `GET /api/spaces/{space_name}/repositories`
2. Receives array of `Repository` objects
3. Checks if any `repository.repository_url` matches the workspace repository
4. Marks space as enabled/disabled based on match result

**Repository API Response**:

```typescript
interface Repository {
  name: string;
  repository_url?: string; // Git repository URL
  branch?: string;
  repository_type?: string;
  status?: string;
  last_synced?: string;
  credentials?: string;
  space_name?: string | null;
  eac_auto_registration?: boolean;
}
```

**Key Field**: `repository_url` - Used for matching against workspace Git repository

**Error Handling**:

- If fetching repositories fails for a space, that space is marked as `hasRepo: false`
- Error is logged but doesn't block checking other spaces
- User sees the space as disabled with `[REPO NOT IN SPACE]`

## Configuration

### VS Code Settings

**Package.json Registration** ([package.json](../package.json)):

```json
{
  "configuration": {
    "title": "Torque AI",
    "properties": {
      "torque-ai.space": {
        "type": "string",
        "default": null,
        "description": "Default Torque space to use for operations",
        "scope": "resource"
      },
      "torque-ai.activeSpace": {
        "type": "string",
        "default": null,
        "description": "Currently active Torque space for the workspace. If not set, the default space will be used.",
        "scope": "resource"
      }
    }
  }
}
```

### Settings Manager Integration

**Setting Definitions** ([SettingsManager.ts](../src/domains/setup/SettingsManager.ts)):

```typescript
private static readonly SETTING_DEFINITIONS: SettingDefinition[] = [
  { key: "url", secret: true },           // API URL (SecretStorage)
  { key: "token", secret: true },         // API token (SecretStorage)
  { key: "space", secret: false },        // Default space (Configuration)
  { key: "activeSpace", secret: false }   // Active space (Configuration)
];
```

**Reading Settings**:

```typescript
const defaultSpace = await settingsManager.getSetting<string>("space");
const activeSpace = await settingsManager.getSetting<string>("activeSpace");
const effectiveSpace = activeSpace ?? defaultSpace;
```

**Writing Settings**:

```typescript
// Set default space (global)
await settingsManager.setSetting(
  "space",
  "my-default-space",
  vscode.ConfigurationTarget.Global
);

// Set active space (workspace)
await settingsManager.setSetting(
  "activeSpace",
  "my-workspace-space",
  vscode.ConfigurationTarget.Workspace
);

// Clear active space (use default)
await settingsManager.setSetting(
  "activeSpace",
  undefined,
  vscode.ConfigurationTarget.Workspace
);
```

## User Workflow Examples

### First-Time Setup

1. User installs Torque AI extension
2. No default or active space is configured
3. User opens a blueprint file
4. CodeLens shows: "Active Space: Not Set"
5. User clicks CodeLens or runs "Set Default Torque Space" command
6. Selects a space from the list (e.g., "production")
7. Default space is saved globally
8. CodeLens updates to: "Active Space: production (Default)"

### Workspace-Specific Override

1. User has default space set to "production"
2. Opens a development workspace with repository `https://github.com/myorg/myapp`
3. Wants to use "development" space for this project only
4. Runs "Set Active Torque Space" command
5. Extension checks which spaces contain the repository:
   - ✅ "development" - Contains `https://github.com/myorg/myapp` - **Enabled**
   - ✅ "staging" - Contains `https://github.com/myorg/myapp` - **Enabled**
   - ❌ "production" - Does NOT contain repository - **Disabled** `[REPO NOT IN SPACE]`
6. User selects "development" space
7. Active space is stored in workspace configuration
8. CodeLens shows: "Active Space: development"
9. Default space remains "production" for other workspaces

### Repository Not in Any Space

1. User works on a new project: `https://github.com/myorg/new-project`
2. Repository not yet added to any Torque space
3. Runs "Set Active Torque Space" command
4. Extension checks all spaces and finds no matches
5. All spaces show as: `$(x) space-name - [REPO NOT IN SPACE]`
6. User cannot select any space
7. User receives warning if attempting selection
8. User must add repository to a Torque space first

### No Git Repository

1. User works in a non-Git workspace or folder
2. Runs "Set Active Torque Space" command
3. No Git repository detected
4. All spaces are shown as enabled (selectable)
5. User can select any space
6. Warning logged: "No Git repository found, all spaces will be selectable"

### Clearing Workspace Override

1. User has workspace active space set to "development"
2. Default space is "production"
3. Wants to return to using default space
4. Runs "Set Active Torque Space" command
5. Selects: `$(circle-slash) Use Default Space`
6. Workspace active space setting is cleared
7. Message shown: "Active space cleared. Using default space: production"
8. CodeLens updates to: "Active Space: production (Default)"

## Visual Indicators

### Icons

| Icon              | Meaning                   | Usage                                        |
| ----------------- | ------------------------- | -------------------------------------------- |
| `$(check)`        | Currently selected/active | Active or default space in QuickPick         |
| `$(circle-slash)` | Clear/Reset option        | "Use Default Space" or "Clear Default Space" |
| `$(x)`            | Disabled/Not available    | Spaces without the repository                |

### Labels

| Label                 | Meaning                                              |
| --------------------- | ---------------------------------------------------- |
| `(Active)`            | Explicitly set as the active space for the workspace |
| `(Default)`           | The global default space                             |
| `(Active & Default)`  | Active space happens to be the same as default       |
| `(Default - Active)`  | No active override, so default is being used         |
| `[REPO NOT IN SPACE]` | Space does not contain the current repository        |

## Logging and Debugging

**Log Output Example**:

```
[INFO] Fetching spaces from API
[INFO] Current repository URL: https://github.com/user/repo
[INFO] Checking 5 spaces for repository
[INFO] Fetching repositories for space: development
[INFO] Space development has 3 repositories
[INFO]   - Repository: myapp, URL: https://github.com/user/repo
[INFO]   - Repository: otherapp, URL: https://github.com/user/other
[INFO]   Comparing: https://github.com/user/repo vs https://github.com/user/repo = true
[INFO] Space development CONTAINS the repository
[INFO] Fetching repositories for space: production
[INFO] Space production has 1 repositories
[INFO]   - Repository: prodapp, URL: https://github.com/user/prod
[INFO]   Comparing: https://github.com/user/prod vs https://github.com/user/repo = false
[INFO] Space production does NOT contain the repository
[INFO] 2 space(s) contain the current repository
```

**Purpose**:

- Debug repository matching issues
- Verify API responses
- Troubleshoot URL normalization
- Validate space filtering logic

## Test Coverage

Tests are located in [settingsManager.test.ts](../src/test/suite/setup/settingsManager.test.ts) and [blueprintCodeLens.test.ts](../src/test/suite/blueprint-authoring/blueprintCodeLens.test.ts).

### Settings Manager Tests

- ✅ Writing and retrieving non-secret settings (`space`, `activeSpace`)
- ✅ Configuration registration validation
- ✅ Workspace vs. global scope handling
- ✅ Setting clearing (setting value to `undefined`)

### Blueprint CodeLens Tests

- ✅ CodeLens provider registration
- ✅ Blueprint file detection (schema reference and spec_version)
- ✅ Active space display
- ✅ Default space display with "(Default)" indicator
- ✅ Command integration (clicking CodeLens triggers command)
- ✅ Configuration change event handling

**Running Tests**:

```bash
npm test
```

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│          VS Code Command Palette                         │
│          Blueprint CodeLens (Clickable)                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     v
┌──────────────────────────────────────────────────────────┐
│   torque.setActiveSpace / torque.setDefaultSpace         │
│   (setActiveSpaceCommand.ts / setDefaultSpaceCommand.ts) │
│                                                          │
│   • Fetch spaces from API                                │
│   • Detect Git repository (active space only)            │
│   • Check each space for repository (active space only)  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     v
┌──────────────────────────────────────────────────────────┐
│   Git Repository Detection (git.ts)                      │
│                                                          │
│   • Get VS Code Git extension API                        │
│   • Find repository for workspace                        │
│   • Extract and normalize remote URL                     │
└────────────────────┬─────────────────────────────────────┘
                     │
                     v
┌──────────────────────────────────────────────────────────┐
│   Repository Filtering (setActiveSpaceCommand.ts)        │
│                                                          │
│   • Call /api/spaces/{space}/repositories for each       │
│   • Compare repository URLs (normalized)                 │
│   • Build enabled/disabled map                           │
└────────────────────┬─────────────────────────────────────┘
                     │
                     v
┌──────────────────────────────────────────────────────────┐
│   QuickPick Display                                      │
│                                                          │
│   • Show all spaces                                      │
│   • Mark disabled items with $(x) and label              │
│   • Add status indicators (Active, Default)              │
└────────────────────┬─────────────────────────────────────┘
                     │
                     v
┌──────────────────────────────────────────────────────────┐
│   Settings Manager (SettingsManager.ts)                  │
│                                                          │
│   • Save to workspace or global configuration            │
│   • Trigger configuration change events                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     v
┌──────────────────────────────────────────────────────────┐
│   CodeLens Refresh (BlueprintCodeLensProvider.ts)        │
│                                                          │
│   • Listen to configuration changes                      │
│   • Update CodeLens display                              │
│   • Show effective space (active or default)             │
└──────────────────────────────────────────────────────────┘
```

## API Integration

### Spaces Endpoint

**Endpoint**: `GET /api/spaces`

**Purpose**: Fetch all available Torque spaces

**Response**:

```typescript
interface Space {
  name: string;
  description?: string;
  // ... other fields
}
```

**Implementation**: [SpacesService.ts:getSpaces()](../src/api/services/SpacesService.ts)

### Repositories Endpoint

**Endpoint**: `GET /api/spaces/{space_name}/repositories`

**Purpose**: Fetch repositories associated with a specific space

**Response**:

```typescript
interface Repository {
  name: string;
  repository_url?: string; // The Git repository URL
  branch?: string;
  repository_type?: string;
  status?: string;
  last_synced?: string;
  credentials?: string;
  space_name?: string | null;
  eac_auto_registration?: boolean;
}
```

**Implementation**: [SpacesService.ts:getRepositories()](../src/api/services/SpacesService.ts)

## Dependencies

**Required VS Code APIs**:

- `vscode.workspace` - Configuration and workspace folder access
- `vscode.commands` - Command registration
- `vscode.window` - QuickPick display
- `vscode.languages` - CodeLens provider registration

**Required VS Code Extensions** (optional):

- `vscode.git` - Git extension for repository detection (if not available, repository filtering is disabled)

## Implementation Files

### Core Files

| File                                                                                                     | Purpose                                                 |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [package.json](../package.json)                                                                          | Configuration schema registration, command registration |
| [SettingsManager.ts](../src/domains/setup/SettingsManager.ts)                                            | Settings read/write, scope handling                     |
| [setDefaultSpaceCommand.ts](../src/domains/setup/commands/setDefaultSpaceCommand.ts)                     | Default space selection command                         |
| [setActiveSpaceCommand.ts](../src/domains/setup/commands/setActiveSpaceCommand.ts)                       | Active space selection with repository filtering        |
| [BlueprintCodeLensProvider.ts](../src/domains/blueprint-authoring/codeLens/BlueprintCodeLensProvider.ts) | CodeLens provider for blueprints                        |
| [git.ts](../src/utils/git.ts)                                                                            | Git repository detection and URL normalization          |

### API Services

| File                                                     | Purpose                                   |
| -------------------------------------------------------- | ----------------------------------------- |
| [SpacesService.ts](../src/api/services/SpacesService.ts) | Spaces and repositories API client        |
| [types.ts](../src/api/services/types.ts)                 | TypeScript interfaces (Space, Repository) |

## Error Handling

### API Failures

**Spaces Fetch Failure**:

- Error message shown to user
- Command exits gracefully
- Logged for debugging

**Repository Fetch Failure**:

- Individual space marked as `hasRepo: false`
- Error logged but doesn't block other spaces
- Space shown as disabled with `[REPO NOT IN SPACE]`

### Git Extension Unavailable

**Behavior**:

- `getGitRemoteUrl()` returns `null`
- All spaces shown as enabled (no filtering)
- Warning logged: "No Git repository found, all spaces will be selectable"
- Allows fallback to manual space selection

### Disabled Item Selection Attempt

**Behavior**:

- Selection validation blocks the action
- Warning message: "Cannot select "space-name" - repository not found in this space."
- No configuration changes made
- User can try selecting a different space

## Success Criteria

### User Adoption Metrics

- 95% of users successfully configure default space within 2 minutes of setup
- 90% of users understand workspace-specific overrides without documentation
- Repository filtering prevents 100% of incorrect space selections for multi-space users
- CodeLens provides immediate space visibility without requiring additional commands

### Integration Quality

- Space selection feels native to VS Code's configuration workflows
- Repository filtering is transparent and intuitive
- Disabled spaces are clearly distinguished from enabled spaces
- Visual indicators (icons, labels) are immediately understandable

### Reliability and Performance

- Space fetching completes in under 3 seconds for typical accounts
- Repository checking completes in under 10 seconds for accounts with 10+ spaces
- Git repository detection succeeds for 99% of Git-based workspaces
- URL normalization correctly handles all common Git URL formats (SSH, HTTPS, with/without .git)

### Developer Experience

- Developers never accidentally use wrong space for workspace
- Switching between projects with different spaces is seamless
- Blueprint files always show correct active space context
- Space configuration persists correctly across VS Code restarts

## Future Enhancements

Potential improvements for consideration:

- [ ] **Repository Caching**: Cache repository checks to avoid repeated API calls within the same session
- [ ] **Manual Override**: Allow users to select disabled spaces with confirmation dialog and warning
- [ ] **Repository Management**: Add commands to view/manage repositories in spaces directly from VS Code
- [ ] **Multi-Repository Workspaces**: Handle workspaces with multiple Git repositories (use primary or prompt)
- [ ] **Repository Metadata Display**: Show repository branch, sync status, and other metadata in space picker
- [ ] **Status Bar Integration**: Add status bar item showing active space with click-to-change functionality
- [ ] **Space Creation**: Allow creating new Torque spaces directly from the extension
- [ ] **Space Metadata**: Display space details (environment count, member count) in picker descriptions
- [ ] **Recent Spaces**: Show recently used spaces at the top of the picker
- [ ] **Space Search**: Add filtering/search capability for accounts with many spaces

## Related Documentation

- [Extension Configuration](./extension_configuration.md)
- [Blueprint YAML Support](./blueprint_yaml_support.md)
- [Extension Architecture](../CLAUDE.md#architecture)
- [Development Commands](../CLAUDE.md#development-commands)

## References

- **Torque API Documentation**: https://portal.qtorque.io/api/docs (external)
- **VS Code Extension API**: https://code.visualstudio.com/api (external)
- **Git Extension API**: https://github.com/microsoft/vscode/tree/main/extensions/git (external)
