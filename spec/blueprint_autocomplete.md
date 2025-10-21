# Blueprint Grain Autocomplete

## Product Purpose

The Blueprint Grain Autocomplete feature enables developers to quickly discover and insert Infrastructure as Code (IaC) assets into Torque blueprints without manually searching repositories or remembering exact paths. This accelerates blueprint authoring by providing intelligent, context-aware suggestions with complete metadata directly within the YAML editor.

## User Experience Requirements

### Instant Asset Discovery

**Requirement**: Developers must be able to discover available grains without leaving the blueprint editor or consulting external documentation.

- Autocomplete suggestions appear automatically as developers type grain names
- All IaC assets from the configured Torque space are available for selection
- Asset suggestions include comprehensive metadata (type, repository, path, cost estimates, usage statistics)
- Developers can see which grains are most commonly used across other blueprints
- No manual repository browsing or path lookup required

### Context-Aware Suggestions

**Requirement**: Autocomplete behavior must adapt intelligently based on the user's current editing location within the blueprint.

- When defining new grains, complete grain structures are inserted with all required fields
- When editing source configurations, only repository and path details are inserted
- Grain type filters are applied automatically when the grain kind is already specified
- Suggestions respect YAML structure and indentation automatically
- Only blueprint files with proper schema declarations receive autocomplete support

### Rich Metadata Display

**Requirement**: Developers must see comprehensive grain information to make informed selection decisions.

- Each suggestion displays grain name and type prominently
- Repository and path information are visible before selection
- Hover documentation includes cost estimates, usage statistics, and labels
- Frequently used grains are prioritized in the suggestion list
- Deprecated or error-state grains are clearly marked

### Efficient Snippet Insertion

**Requirement**: Selected grains must insert properly structured YAML with minimal manual editing required.

- Complete grain structures include all standard sections (kind, spec, source, agent, inputs, commands)
- Input fields are populated with actual grain inputs from the Torque catalog
- Placeholder values allow quick tab-through editing of key fields
- Agent names, input values, and commands use intelligent defaults
- Inserted YAML respects existing indentation and formatting

### Performance and Responsiveness

**Requirement**: Autocomplete must feel instant and never interrupt the developer's workflow.

- First suggestion appears within 500ms of typing
- Subsequent suggestions from cache appear in under 10ms
- Asset lists refresh automatically when blueprint files are opened
- Space changes trigger immediate cache refresh
- No noticeable lag or delay during typical editing sessions

## Features

### 1. Automatic Blueprint Detection

**Activation Criteria**:

The autocomplete provider only activates for blueprint YAML files that contain the Torque blueprint schema reference in the **first line**:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/QualiTorque/torque-vs-code-extensions/master/client/schemas/blueprint-spec2-schema.json
```

**User Benefit**:

- Prevents autocomplete from appearing in non-blueprint YAML files
- Ensures suggestions are only shown when contextually relevant
- Reduces noise and false triggers in the editor

**Implementation**: `isBlueprintFile()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### 2. Space-Based Asset Loading

**Space Resolution**:

Assets are loaded from the effective Torque space using this priority:

1. **Active Space**: Workspace-specific `torque-ai.activeSpace` setting
2. **Default Space**: Global `torque-ai.space` setting
3. **No Space Configured**: Autocomplete is disabled with helpful guidance

**User Benefit**:

- Developers automatically see assets from the correct space for their project
- Workspace-specific space configurations are respected
- Switching spaces immediately updates available grain suggestions

**Implementation**: Space resolution logic in `provideCompletionItems()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### 3. Intelligent Position Detection

**Grains Section Autocomplete**:

When the cursor is positioned under `grains:` with proper indentation (2+ spaces), the autocomplete triggers and inserts a **complete grain structure**:

```yaml
grains:
  vpc-module:
    kind: "terraform"
    spec:
      source:
        store: "infrastructure-repo"
        path: "terraform/modules/vpc"
      agent:
        name: "AGENT_NAME"
      inputs:
        - region: "us-west-2"
        - cidr_block: "10.0.0.0/16"
      commands:
        - "dep up terraform/modules/vpc"
```

**Source Section Autocomplete**:

When the cursor is within a grain's `source:` section, autocomplete inserts **only the store and path**:

```yaml
spec:
  source:
    store: "infrastructure-repo"
    path: "terraform/modules/vpc"
```

**User Benefit**:

- Different contexts receive appropriate insertion behavior
- Developers don't need to manually structure grain definitions
- Source path updates don't create duplicate grain structures

**Implementation**:

- Grains section detection: `isInGrainsSection()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)
- Source section detection: `getSourceContext()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)
- Context-based insertion: Snippet logic in `provideCompletionItems()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### 4. Type-Aware Filtering

**Grain Kind Filtering**:

When a grain already has a `kind:` field defined, autocomplete automatically filters suggestions to show only matching asset types:

- `kind: 'terraform'` → Only Terraform modules appear
- `kind: 'helm'` → Only Helm charts appear
- `kind: 'ansible'` → Only Ansible playbooks appear

**User Benefit**:

- Reduces suggestion list to only relevant assets
- Prevents type mismatches and configuration errors
- Makes finding the right asset faster when type is known

**Implementation**: Asset filtering logic in `provideCompletionItems()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### 5. Smart Caching System

**Cache Behavior**:

- **Time-to-Live**: 5 minutes per space
- **Automatic Refresh**: Triggered when blueprint files are opened
- **Space Isolation**: Each space has its own independent cache
- **Configuration Monitoring**: Cache clears when space settings change

**User Benefit**:

- First autocomplete trigger fetches assets (200-500ms)
- All subsequent triggers use cached data (<10ms)
- Opening blueprint files ensures cache is fresh
- Switching spaces updates available assets automatically

**Implementation**:

- Cache structure: `CacheEntry` interface and class-level `cache` Map in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)
- Cache retrieval: `getIacAssets()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)
- Cache invalidation: Configuration change listener in constructor and `clearCache()` / `invalidateSpace()` methods in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)
- Blueprint file refresh: `onDidOpenTextDocument` listener in `registerGrainCompletionProvider()` function in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### 6. Dynamic Input Resolution

**Catalog Integration**:

When inserting a complete grain structure, the extension fetches detailed grain metadata from the Torque catalog API to include:

- Actual input parameter names from the grain definition
- Default values for each input (used as snippet placeholders)
- Input types and validation requirements
- Commands and dependencies

**Fallback Behavior**:

If catalog data cannot be fetched:

- Basic grain structure is still inserted
- Generic input placeholders are provided: `- input_name: 'value'`
- Developers can manually add inputs based on grain documentation

**User Benefit**:

- Inserted grains include correct input definitions automatically
- Default values reduce manual configuration effort
- Tab-through editing makes customization efficient

**Implementation**: `createGrainSnippet()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### 7. Usage-Based Sorting

**Prioritization Logic**:

Grain suggestions are sorted by popularity:

- Most frequently used grains across all blueprints appear first
- Usage count is tracked in the `total_usage_count` field
- Less common or newly added grains appear lower in the list

**User Benefit**:

- Most relevant and battle-tested grains are easily discoverable
- Common patterns emerge naturally through usage statistics
- New developers benefit from community best practices

**Implementation**: `sortText` property assignment in completion item creation in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### 8. Visual Error Indicators

**Deprecated Asset Marking**:

Grains with errors or issues are tagged as deprecated in the completion list using VS Code's standard deprecation indicator.

**Error State Detection**:

- Assets with `in_error: true` are visually distinguished
- Developers are warned before selecting problematic grains
- Selection is still allowed for situations where the error is expected

**User Benefit**:

- Developers avoid selecting broken or outdated grains
- Visual warnings prevent configuration errors
- Intentional selection of error-state grains remains possible

**Implementation**: `tags` property assignment based on `in_error` field in completion item creation in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

## User Workflow Examples

### First-Time Blueprint Creation

1. Developer creates a new blueprint file using "Torque: Torque Blueprint" command
2. Blueprint template includes schema reference in first line
3. Developer types `  my-` under the `grains:` section
4. Autocomplete appears showing all assets matching "my-"
5. Developer selects `my-vpc (terraform)` from the list
6. Complete grain structure inserts with agent, inputs, and commands
7. Developer tabs through placeholders to customize agent name and input values
8. Developer saves the blueprint and moves to the next grain

### Updating Existing Grain Source

1. Developer opens an existing blueprint with several grains
2. Decides to change the source path for the `database` grain
3. Navigates to the `source:` section within the `database` grain definition
4. Deletes existing `store:` and `path:` lines
5. Triggers autocomplete by starting to type
6. Autocomplete shows only Helm charts (filtered by `kind: 'helm'`)
7. Developer selects new chart from the list
8. Only `store:` and `path:` are inserted (doesn't replace entire grain)
9. Developer saves the updated blueprint

### Working Across Multiple Spaces

1. Developer has default space set to `production`
2. Opens a development workspace and sets active space to `development`
3. Opens a blueprint file in the development workspace
4. Autocomplete shows grains from the `development` space
5. Developer closes workspace and opens another project
6. New project uses default `production` space
7. Autocomplete automatically shows grains from `production` space
8. No manual cache clearing or configuration required

### Discovering New Grains

1. Platform team adds a new Helm chart to the Torque space
2. Developer opens a blueprint file (triggers cache refresh)
3. Developer types under `grains:` section
4. New Helm chart appears in autocomplete suggestions
5. Developer hovers over suggestion to see metadata
6. Hover shows repository, path, and that chart is used in 0 other blueprints
7. Developer selects the new chart to try it out
8. Complete grain structure with inputs is inserted

## Success Criteria

### Developer Productivity

- Developers add new grains to blueprints 5x faster than manual copying/pasting
- 90% of inserted grains require minimal manual editing (only agent name and input values)
- Developers discover and use appropriate grains without consulting repository browsers
- Blueprint authoring feels as natural as coding with IntelliSense

### Accuracy and Reliability

- Autocomplete triggers correctly in 100% of valid blueprint contexts
- Zero false positives in non-blueprint YAML files
- Inserted grain structures are syntactically valid 100% of the time
- Type filtering prevents kind mismatches in all cases

### Performance

- First autocomplete appears within 500ms for spaces with up to 500 assets
- Cached autocomplete appears in under 10ms
- Cache refresh completes within 3 seconds for typical spaces
- Opening blueprint files doesn't cause noticeable editor lag

### Usability

- Developers understand autocomplete behavior without reading documentation
- Metadata display provides sufficient information for informed selection
- Tab navigation through snippet placeholders feels intuitive
- Error states and deprecated assets are immediately recognizable

## Configuration

**Required Settings**:

- `torque-ai.activeSpace` (workspace-specific) OR `torque-ai.space` (global default)
- Valid Torque API credentials via `torque.token` (SecretStorage)
- Valid API endpoint via `torque.url`

**Settings Definition**: `torque-ai.space` and `torque-ai.activeSpace` configuration in [package.json](../package.json)

**Settings Access**: `getSetting()` method in [SettingsManager.ts](../src/domains/setup/SettingsManager.ts)

**Required Blueprint File Format**:

- YAML language mode
- Schema reference in first line: `# yaml-language-server: $schema=https://...blueprint-spec2-schema.json`

**Schema Detection**: `isBlueprintFile()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

**Optional Dependencies**:

- `redhat.vscode-yaml` extension for enhanced YAML editing and schema validation

## Error Handling

### No Space Configured

**Behavior**:

- Autocomplete does not appear
- Warning logged: "No space configured for grain completion"
- No error message shown to user (graceful degradation)

**Resolution**:

- Configure default space using "Torque: Set Default Torque Space" command
- Or configure active space using "Torque: Set Active Torque Space" command

**Implementation**: Space validation in `provideCompletionItems()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### API Client Unavailable

**Behavior**:

- Autocomplete does not appear
- Warning logged: "API client not available for grain completion"
- Extension functionality continues normally for other features

**Resolution**:

- Verify Torque credentials are configured correctly
- Check API endpoint connectivity using "Torque: Check Torque AI Status" command

**Implementation**: API client validation in `provideCompletionItems()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### API Fetch Failure

**Behavior**:

- Error is caught and logged with details
- No autocomplete suggestions shown for current trigger
- Cache retains previous data if available (serves stale data)

**Resolution**:

- Temporary network issues resolve automatically on next trigger
- Persistent failures require checking API endpoint and credentials

**Implementation**: Error handling in `getIacAssets()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

### Catalog Data Unavailable

**Behavior**:

- Basic grain structure is inserted without detailed input definitions
- Placeholder inputs are added: `- input_name: 'value'`
- Warning logged with error details

**Resolution**:

- Developer manually adds correct inputs from grain documentation
- Catalog availability issues typically resolve automatically

**Implementation**: Fallback logic in `createGrainSnippet()` method in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

## Implementation Files

| File                                                                                                     | Purpose                                             |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)   | Core autocomplete logic and position detection      |
| [types.ts](../src/api/services/types.ts)                                                                 | IaC asset and catalog data type definitions         |
| [SpacesService.ts](../src/api/services/SpacesService.ts)                                                 | API client for fetching IaC assets and catalog data |
| [SettingsManager.ts](../src/domains/setup/SettingsManager.ts)                                            | Space configuration and settings access             |
| [BlueprintCodeLensProvider.ts](../src/domains/blueprint-authoring/codeLens/BlueprintCodeLensProvider.ts) | Blueprint file detection (shared schema logic)      |

## API Integration

### IaC Assets Endpoint

**Endpoint**: `GET /api/spaces/{space_name}/iac-assets`

**Purpose**: Fetch all available IaC assets (grains) for the specified space

**Implementation**: `getIacAssets()` method in [SpacesService.ts](../src/api/services/SpacesService.ts)

**Response**:

```typescript
interface IacAssetsResponse {
  iac_assets: IacAsset[];
  paging_info: {
    full_count: number;
    page: number;
    page_size: number;
  };
}

interface IacAsset {
  name: string;
  iac_resource_type: string; // "terraform", "helm", "ansible", etc.
  repository: string;
  path: string;
  branch?: string;
  labels?: Array<{ name: string }>;
  average_hourly_cost?: number;
  blueprint_count?: number;
  total_usage_count?: number;
  in_error?: boolean;
  repository_type?: string;
}
```

### Catalog Asset Endpoint

**Endpoint**: `GET /api/spaces/{space_name}/catalog/assets/{asset_name}?repository={repository}`

**Purpose**: Fetch detailed grain metadata including input definitions

**Implementation**: `getCatalogAsset()` method in [SpacesService.ts](../src/api/services/SpacesService.ts)

**Response**:

```typescript
interface CatalogAsset {
  details: {
    inputs?: Array<{
      name: string;
      type: string; // "string", "number", "agent", etc.
      default_value?: string;
      description?: string;
      required?: boolean;
    }>;
    // ... other fields
  };
}
```

**Usage**: Called when inserting complete grain structures to populate input fields with actual grain input definitions

## Provider Registration

The grain completion provider is registered during extension activation and integrates with VS Code's completion system.

**Registration**: `registerGrainCompletionProvider()` function in [GrainCompletionProvider.ts](../src/domains/blueprint-authoring/completion/GrainCompletionProvider.ts)

**Extension Activation**: `activate()` function in [extension.ts](../src/extension.ts) calls `registerGrainCompletionProvider()`

**Trigger Characters**: Completions trigger automatically on typing, plus explicitly on `:` character

## Related Documentation

- [Blueprint YAML Support](./blueprint_yaml_support.md) - Blueprint file creation and templates
- [Torque Space Selection](./torque_space_selection.md) - Space configuration and workspace management
- [Extension Configuration](./extension_configuration.md) - API authentication and setup

## References

- **Torque API Documentation**: https://portal.qtorque.io/api/docs (external)
- **Blueprint Specification**: https://github.com/QualiTorque/torque-vs-code-extensions/tree/master/client/schemas
- **VS Code Completion API**: https://code.visualstudio.com/api/references/vscode-api#CompletionItemProvider
