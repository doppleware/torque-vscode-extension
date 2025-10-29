# Blueprint Running Environments

## Overview

The Torque VS Code extension provides visibility into active environments created from blueprint files. This feature displays running environment counts in CodeLens and allows developers to quickly access environment details and add them to AI chat context for analysis and troubleshooting.

## Features

### 1. Environment Count in CodeLens

**Display Location**: Blueprint YAML files (above `spec_version` line)

**Information Shown**:

- Number of active environments for the blueprint
- Clickable link to view environment list

**Example**:

```
Space: my-space | 5 active
```

**Behavior**:

- Shows "0 active" when no environments are running
- Updates when environments are created or terminated
- Click to open environments list

**Implementation**: [BlueprintCodeLensProvider.ts:115-180](../src/domains/blueprint-authoring/codeLens/BlueprintCodeLensProvider.ts#L115-L180)

### 2. Show Environments Command

**Command ID**: `torque.showBlueprintEnvironments`

**Access Points**:

- CodeLens: Click on "{N} active" link in blueprint file
- Called programmatically with blueprint name and environments list

**Behavior**:

1. Fetches list of active environments for the blueprint
2. Displays QuickPick menu with environment details
3. Shows "Add to chat" button for each environment
4. Clicking button adds environment context to AI chat

**Implementation**: [showEnvironmentsCommand.ts](../src/domains/blueprint-authoring/commands/showEnvironmentsCommand.ts)

### 3. Environment QuickPick Menu

The environments menu provides detailed information about each running environment.

**Menu Structure**:

```
Blueprint Environments (5)
Active environments for blueprint: my-app

┌─────────────────────────────────────────────────────┐
│ my-app-20251024T181757                    💬        │
│   Owner: John Doe                                   │
│   ID: PFQRtjMNyue2 | Space: Hyper-reasoning         │
├─────────────────────────────────────────────────────┤
│ my-app-20251023T142301                    💬        │
│   Owner: Jane Smith                                 │
│   ID: ASDFghjkl12 | Space: Hyper-reasoning         │
└─────────────────────────────────────────────────────┘
```

**Item Properties**:

| Property        | Description              | Example                                      |
| --------------- | ------------------------ | -------------------------------------------- |
| **Label**       | Environment name         | `my-app-20251024T181757`                     |
| **Description** | Owner information        | `Owner: John Doe`                            |
| **Detail**      | Environment ID and space | `ID: PFQRtjMNyue2 \| Space: Hyper-reasoning` |
| **Button**      | Add to chat action       | 💬 (comment-discussion icon)                 |

**Implementation**: [showEnvironmentsCommand.ts:36-58](../src/domains/blueprint-authoring/commands/showEnvironmentsCommand.ts#L36-L58)

### 4. Add to Chat Integration

When the "Add to chat" button is clicked for an environment:

**Workflow**:

1. User clicks 💬 button next to environment
2. Extension calls `attachEnvironmentFileToChatContext(spaceName, environmentId)`
3. Environment details are fetched from Torque API
4. Temporary YAML file is created with environment context
5. File is attached to AI chat for analysis
6. Related blueprint file (if found) is opened in editor

**Success Notification**:

```
Environment details have been added to the chat context
```

**Implementation**: [showEnvironmentsCommand.ts:61-84](../src/domains/blueprint-authoring/commands/showEnvironmentsCommand.ts#L61-L84)

### 5. Environment Fetching

The extension fetches environments from the Torque API to populate the list.

**API Endpoint**:

```
GET /api/spaces/{spaceName}/environments
```

**Query Parameters**:

```
?blueprint_name={blueprintName}&status=Active
```

**Response**:

```typescript
{
  environment_list: [
    {
      id: string,
      owner: {
        first_name: string,
        last_name: string,
        display_first_name: string,
        display_last_name: string,
        email: string
      },
      details: {
        definition: {
          metadata: {
            name: string,
            space_name: string,
            blueprint_name: string
          }
        }
      }
    }
  ],
  paging_info: {
    full_count: number,
    requested_page: number,
    total_pages: number
  }
}
```

**Implementation**: [EnvironmentsService.ts:13-66](../src/api/services/EnvironmentsService.ts#L13-L66)

## User Experience

### Discovering Running Environments

**Scenario**: Developer wants to see which environments are running from their blueprint

1. Open blueprint YAML file (e.g., `my-app.yaml`)
2. Look at CodeLens above `spec_version` line
3. See environment count: "Space: my-space | 3 active"
4. Count indicates 3 environments are currently active

### Viewing Environment List

**Scenario**: Developer wants to see details of running environments

1. Click on "3 active" link in CodeLens
2. QuickPick menu appears showing all 3 environments
3. Each environment shows:
   - Environment name
   - Owner information
   - Environment ID and space
   - "Add to chat" button

### Adding Environment to Chat

**Scenario**: Developer wants to analyze a specific environment with AI

1. Open environments list from CodeLens
2. Find the environment to analyze
3. Click 💬 button next to the environment
4. Wait for environment context to load
5. AI chat opens with environment details attached
6. Related blueprint file opens in editor
7. Start asking AI questions about the environment

### Example Workflow

**Problem**: An environment is failing, developer wants to troubleshoot

1. **See the issue**: "my-app-prod" environment is showing errors
2. **Open blueprint**: Open `my-app.yaml` in VS Code
3. **Check environments**: CodeLens shows "5 active"
4. **Find environment**: Click "5 active" to see list
5. **Add to chat**: Click 💬 button next to "my-app-prod"
6. **Analyze**: AI chat opens with full environment context
7. **Ask questions**:
   - "Why is this environment failing?"
   - "What resources are in error state?"
   - "Show me the grain configurations"
8. **Get answers**: AI analyzes environment details and provides insights

## QuickPick Configuration

### Title and Placeholder

**Title Format**: `Blueprint Environments ({count})`

**Placeholder**: `Active environments for blueprint: {blueprintName}`

**Implementation**: [showEnvironmentsCommand.ts:38-39](../src/domains/blueprint-authoring/commands/showEnvironmentsCommand.ts#L38-L39)

### Search and Filtering

**Match On**:

- Description (owner name)
- Detail (environment ID, space name)

This allows users to quickly filter environments by:

- Owner name (e.g., type "John" to see John's environments)
- Environment ID
- Space name

**Implementation**: [showEnvironmentsCommand.ts:40-41](../src/domains/blueprint-authoring/commands/showEnvironmentsCommand.ts#L40-L41)

### Button Configuration

**Icon**: `comment-discussion` (ThemeIcon)

**Tooltip**: "Add environment to chat context"

**Implementation**: [showEnvironmentsCommand.ts:44-47](../src/domains/blueprint-authoring/commands/showEnvironmentsCommand.ts#L44-L47)

## Error Handling

### API Fetch Errors

**Scenario**: Unable to fetch environments from Torque API

**Error Message**:

```
Failed to fetch environments for blueprint: {blueprintName}
```

**Behavior**:

- CodeLens shows "? active" or hides count
- Error is logged to output channel
- User can retry by refreshing CodeLens

### Add to Chat Errors

**Scenario**: Error while adding environment to chat context

**Error Message**:

```
Failed to add environment to chat: {error details}
```

**Behavior**:

- Error notification shown to user
- QuickPick remains open (user can try another environment)
- Error is logged with full stack trace

**Implementation**: [showEnvironmentsCommand.ts:77-82](../src/domains/blueprint-authoring/commands/showEnvironmentsCommand.ts#L77-L82)

### Empty Environment List

**Scenario**: No active environments for blueprint

**Behavior**:

- CodeLens shows "0 active"
- Clicking opens empty QuickPick with message
- No environments displayed

## Integration with Other Features

### Environment Context Injection

When "Add to chat" is clicked, the environment context injection feature is triggered:

**Flow**:

1. `showEnvironmentsCommand` calls `attachEnvironmentFileToChatContext()`
2. Environment details are fetched with grains and resources
3. Introspection data is fetched for each grain
4. Workflows are fetched for resources
5. Data is transformed and attached to chat
6. Blueprint file matching environment name is opened

**Related**: [Environment Context Injection Specification](./environment_context_injection.md)

### Blueprint CodeLens

The environment count is displayed as part of the blueprint CodeLens:

**CodeLens Items**:

1. Space name and environment count (clickable)
2. "Validate" action
3. "Deploy" action
4. "Sync" action (if applicable)

**Related**: [Blueprint YAML Support Specification](./blueprint_yaml_support.md)

### Blueprint Identification

Environments are matched to blueprints by the `blueprint_name` field in environment metadata:

**Matching Logic**:

```typescript
environment.details.definition.metadata.blueprint_name === blueprintFileName;
```

This ensures only environments created from the specific blueprint are shown.

## API Integration

### List Environments Endpoint

**Service**: EnvironmentsService

**Method**: `listEnvironments(spaceName, filters?)`

**Filters**:

```typescript
{
  blueprint_name?: string,
  status?: "Active" | "Inactive",
  page?: number,
  page_size?: number
}
```

**Implementation**: [EnvironmentsService.ts:13-66](../src/api/services/EnvironmentsService.ts#L13-L66)

### Environment Details Endpoint

**Service**: SpacesService (used by environment context injection)

**Method**: `client.get(spaces/{spaceName}/environments/{environmentId})`

**Implementation**: Referenced in [TorqueEnvironmentDetailsTool.ts](../src/domains/environment-context/tools/TorqueEnvironmentDetailsTool.ts)

## Performance Considerations

### CodeLens Caching

**Challenge**: Fetching environment count can be slow for blueprints with many environments

**Solutions**:

- Cache environment count per blueprint
- Update cache when CodeLens is refreshed
- Use stale-while-revalidate pattern

**Current Behavior**:

- Fetches on every CodeLens provider call
- No caching implemented yet

**Future Enhancement**: Add caching with configurable TTL

### QuickPick Performance

**Challenge**: Large number of environments (100+) in QuickPick

**Current Approach**:

- Load all environments at once
- VS Code QuickPick handles virtualization
- Search/filtering is instant (client-side)

**Potential Improvement**:

- Implement pagination for 100+ environments
- Load environments on-demand as user scrolls

## Test Coverage

**Test File**: [blueprintCodeLens.test.ts](../src/test/suite/blueprint-authoring/blueprintCodeLens.test.ts)

**Test Suites**:

### Environment Count Display

- ✓ Show environment count in CodeLens
- ✓ Handle 0 active environments
- ✓ Handle multiple active environments
- ✓ Update count when environments change

### Command Registration

- ✓ Register showBlueprintEnvironments command
- ✓ Command accepts blueprint name and environments list

### QuickPick Functionality

- ✓ Display environments in QuickPick
- ✓ Show correct environment metadata
- ✓ Handle button clicks
- ✓ Call environment context handler on button click

### Error Scenarios

- ✓ Handle API errors gracefully
- ✓ Show error message on add to chat failure
- ✓ Keep QuickPick open after error

**Running Tests**:

```bash
npm test
```

## Configuration

**Extension Settings**:

No specific settings for this feature. It uses:

- `torque.url` - API endpoint
- `torque.token` - Authentication token
- `torque.space` or `torque.activeSpace` - Space context

**Dependencies**:

- Active space must be configured
- API client must be initialized
- Blueprint must be identified by schema reference

## Future Enhancements

Potential improvements to blueprint running environments:

- [ ] Cache environment counts for performance
- [ ] Show environment health status indicators (healthy, warning, error)
- [ ] Add "Open in Portal" action for each environment
- [ ] Show environment resource summary (e.g., "3 compute, 2 storage")
- [ ] Filter environments by owner, status, tags
- [ ] Sort environments by creation date, name, status
- [ ] Batch operations (add multiple environments to chat)
- [ ] Environment comparison (diff two environments)
- [ ] Terminate environment action in QuickPick
- [ ] Real-time environment status updates
- [ ] Show environment cost information
- [ ] Group environments by space
- [ ] Pagination for large environment lists
- [ ] Export environment list to CSV/JSON

## Related Documentation

- [Environment Context Injection](./environment_context_injection.md) - Adding environment details to AI chat
- [Blueprint YAML Support](./blueprint_yaml_support.md) - Blueprint file features and CodeLens
- [Extension Configuration](./extension_configuration.md) - Setup and authentication
- [Torque Space Selection](./torque_space_selection.md) - Managing spaces

## References

- **Torque API Documentation**: Environments endpoint
- **VS Code API**: QuickPick with buttons
- **Icon Reference**: `comment-discussion` (ThemeIcon)
