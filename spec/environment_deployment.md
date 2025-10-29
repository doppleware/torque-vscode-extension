# Environment Deployment

## Overview

The Torque VS Code extension provides integrated support for deploying blueprint environments directly from blueprint YAML files. This functionality includes interactive deployment forms, input validation, allowed values fetching, and seamless integration with the Torque platform.

## Features

### 1. Deploy Blueprint Command

**Command ID**: `torque.blueprintActions` (with deploy action)

**Access Points**:

- CodeLens: "Deploy" action above blueprint YAML files
- Command Palette: "Torque: Blueprint Actions" > Select "Deploy"

**Behavior**:

1. Parses blueprint YAML file to extract inputs
2. Fetches allowed values for inputs from Torque API
3. Shows interactive deployment form with all inputs
4. Auto-selects single allowed values
5. Validates all required fields are filled
6. Deploys environment to Torque platform
7. Opens portal URL to view deployment

**Implementation**: [DeployBlueprintAction.ts](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts)

### 2. Blueprint Parsing

The extension parses the blueprint YAML file to extract input definitions:

**Parsed Information**:

| Field              | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `inputs`           | Array of input parameter definitions          |
| `inputs[].name`    | Input parameter name                          |
| `inputs[].type`    | Input data type (string, number, agent, etc.) |
| `inputs[].default` | Default value for input                       |

**YAML Structure**:

```yaml
spec_version: 2
description: "My application"
inputs:
  - name: instance_type
    type: string
    default: t2.micro
  - name: region
    type: string
  - name: agent
    type: agent
grains:
  # grain definitions...
```

**Implementation**: [DeployBlueprintAction.ts:74-128](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L74-L128)

### 3. Allowed Values API Integration

Before showing the deployment form, the extension fetches allowed values for inputs from the Torque platform.

**API Endpoint**:

```
POST /api/spaces/{spaceName}/catalog/inputs_allowed_values
```

**Request Payload**:

```typescript
{
  input_values: Record<string, string>,      // Current input values
  input_definitions: InputDefinition[]        // Blueprint input definitions
}
```

**Response**:

```typescript
[
  {
    name: string,                            // Input name
    errors: string[],                        // Validation errors
    allowed_values: [                        // Available options
      {
        value: string,                       // Actual value
        display_value: string | null,        // Display name
        extra_details?: {                    // Optional metadata
          agent_type?: string,
          quali_owned?: boolean,
          status?: string
        }
      }
    ]
  }
]
```

**Implementation**:

- Service: [SpacesService.ts:284-323](../src/api/services/SpacesService.ts#L284-L323)
- Usage: [DeployBlueprintAction.ts:144-167](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L144-L167)

### 4. Interactive Deployment Form

The deployment form provides a multi-step interface for configuring environment deployment.

**Form Features**:

- **Environment Name Field**: Auto-generated with timestamp (e.g., `my-blueprint-20251024T181757`)
- **Input Fields**: One field per blueprint input
- **Field Types**:
  - **Input**: Free-text entry for inputs without allowed values
  - **Select**: Dropdown for inputs with allowed values
- **Auto-Selection**: Automatically selects when only one allowed value exists
- **Field Status**: Shows current value or "(not set)"
- **Validation**: Ensures all required fields are filled before deployment
- **Actions**:
  - Deploy: Submits the deployment
  - Cancel: Cancels the deployment

**Form Display**:

```
Deploy my-blueprint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

$(edit) Environment Name
└─ my-blueprint-20251024T181757
   Type: string

$(edit) instance_type
└─ t2.micro
   Select from 3 option(s)

$(edit) region
└─ (not set)
   Type: string

$(check) Deploy
└─ Deploy the environment with these settings
   All required inputs have been configured

$(close) Cancel
└─ Cancel deployment
```

**Implementation**: [DeploymentForm.ts](../src/domains/blueprint-authoring/commands/actions/DeploymentForm.ts)

### 5. Field Validation

The form validates inputs before allowing deployment:

**Validation Rules**:

1. **Environment Name**: Must not be empty or whitespace-only
2. **Required Inputs**: All input fields must have values
3. **Whitespace Handling**: Whitespace-only values treated as empty

**Validation Errors**:

When validation fails, the form displays an error at the top:

```
$(error) Missing fields: instance_type, region
└─ Please fill in the missing fields above
```

**Implementation**: [DeploymentForm.ts:138-166](../src/domains/blueprint-authoring/commands/actions/DeploymentForm.ts#L138-L166)

### 6. Value Caching

The extension caches deployment values in workspace state for reuse:

**Cached Data**:

- Environment name
- Input values for each field

**Cache Key**: `torque.lastDeploymentValues.{blueprintName}`

**Behavior**:

- When deploying the same blueprint again, previously used values are pre-filled
- User can modify cached values before deploying
- Cache persists across VS Code sessions

**Implementation**: [DeployBlueprintAction.ts:197-207](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L197-L207)

### 7. Environment Deployment

Once the form is validated and submitted, the extension deploys the environment to Torque.

**API Endpoint**:

```
POST /api/spaces/{spaceName}/environments
```

**Request Payload**:

```typescript
{
  environment_name: string,              // User-provided environment name
  blueprint_name: string,                // Blueprint file name (without extension)
  inputs: Record<string, string>,        // Key-value pairs of input values
  duration?: string,                     // Optional environment duration
  automation?: boolean,                  // Optional automation flag
  description?: string                   // Optional description
}
```

**Response**:

```typescript
{
  id: string,                            // Environment ID
  ticket_id: string | null               // Optional ticket ID
}
```

**Implementation**: [SpacesService.ts:326-349](../src/api/services/SpacesService.ts#L326-L349)

### 8. Portal Integration

After successful deployment, the extension offers to open the environment in the Torque portal.

**Portal URL Format**:

```
{torqueUrl}/spaces/{spaceName}/environments/{environmentId}
```

**User Experience**:

1. Deployment succeeds
2. Information message appears: "Environment deployed: {environmentName}"
3. Action button: "View in Portal"
4. Clicking button opens portal URL in default browser

**Implementation**: [DeployBlueprintAction.ts:241-252](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L241-L252)

## Prerequisites

### Required Configuration

Before deploying, the following must be configured:

1. **Torque URL**: Extension setting `torque.url`
2. **API Token**: Stored in VS Code SecretStorage
3. **Active Space**: Either:
   - Global setting: `torque.space`
   - Workspace setting: `torque.activeSpace`

### Prerequisite Checks

The extension validates prerequisites before showing the deployment form:

**Error Messages**:

| Condition           | Error Message                                                                  |
| ------------------- | ------------------------------------------------------------------------------ |
| No API client       | "Torque is not configured. Please run 'Torque: Setup Extension' to configure." |
| No space configured | "No space is configured. Please set an active space first."                    |

**Implementation**: [DeployBlueprintAction.ts:129-142](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L129-L142)

## Error Handling

### API Errors

**Allowed Values Fetch Errors**:

- Logs error but continues with deployment
- Form shows inputs without allowed values (free-text entry)

**Deployment Errors**:

- Shows error message to user
- Returns to form (user can retry or cancel)

**Error Display**:

```
Failed to deploy environment: {error message}
```

**Implementation**: [DeployBlueprintAction.ts:224-239](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L224-L239)

### YAML Parsing Errors

**Invalid YAML**:

- Error message: "Failed to parse blueprint: {error details}"
- Deployment is aborted

**Missing Inputs Section**:

- Treated as blueprint with no inputs
- Form only shows environment name field

**Implementation**: [DeployBlueprintAction.ts:86-104](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L86-L104)

## Auto-Selection Behavior

When an input has exactly one allowed value, the extension automatically selects it:

**Behavior**:

1. Fetch allowed values for input
2. If `allowed_values.length === 1`:
   - Pre-fill input with the single value
   - Still show field in form (user can see auto-selected value)
   - Log: "Auto-selected single allowed value for {input}: {value}"

**Example**:

If input "agent" has only one allowed value "aws-agent-1":

```
$(edit) agent
└─ aws-agent-1
   Select from 1 option(s)
```

**Implementation**: [DeployBlueprintAction.ts:183-190](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L183-L190)

## Default Values

Blueprint inputs can specify default values that are used if the user doesn't provide a value:

**YAML Example**:

```yaml
inputs:
  - name: instance_type
    type: string
    default: t2.micro
```

**Behavior**:

1. Parse blueprint to extract default values
2. Pre-fill form with defaults
3. User can override defaults
4. If user clears field, validation will require a value

**Implementation**: [DeployBlueprintAction.ts:106-113](../src/domains/blueprint-authoring/commands/actions/DeployBlueprintAction.ts#L106-L113)

## Test Coverage

The deployment functionality is thoroughly tested across multiple test files.

**Test Suites**:

### DeployBlueprintAction Tests ([deployBlueprintAction.test.ts](../src/test/suite/blueprint-authoring/deployBlueprintAction.test.ts))

**Deployment Flow**:

- ✓ Deploy blueprint with user-provided inputs
- ✓ Auto-select single allowed value
- ✓ Cache deployment values for reuse

**Blueprint Parsing**:

- ✓ Parse blueprint inputs correctly
- ✓ Handle blueprint with no inputs
- ✓ Use default values for inputs
- ✓ Handle YAML parsing errors

**Prerequisites**:

- ✓ Show error when no API client configured
- ✓ Show error when no space configured
- ✓ Use active space when configured

**Error Handling**:

- ✓ Handle API errors during allowed values fetch
- ✓ Handle API errors during deployment

**Portal Integration**:

- ✓ Generate correct portal URL
- ✓ Handle user clicking 'View in Portal'

### DeploymentForm Tests ([deploymentForm.test.ts](../src/test/suite/blueprint-authoring/deploymentForm.test.ts))

**Form Display**:

- ✓ Show all fields in the form
- ✓ Generate default environment name with timestamp
- ✓ Use cached environment name when provided
- ✓ Show field type for input fields
- ✓ Show option count for select fields

**Field Editing**:

- ✓ Allow editing environment name
- ✓ Allow text input for fields without allowed values
- ✓ Allow selection from allowed values
- ✓ Display current field values
- ✓ Show '(not set)' for empty fields

**Form Validation**:

- ✓ Validate all required fields are filled
- ✓ Show validation error for missing environment name
- ✓ Clear validation error when user edits a field
- ✓ Allow deployment when all fields are filled

**User Actions**:

- ✓ Return undefined when user cancels with Cancel button
- ✓ Return undefined when user dismisses the form
- ✓ Continue showing form when user dismisses input box
- ✓ Return deployment values when user completes the form

**Edge Cases**:

- ✓ Handle blueprint with no inputs
- ✓ Handle allowed values with null display_value
- ✓ Handle whitespace-only values as empty

### Blueprint Actions Command Tests ([blueprintActionsCommand.test.ts](../src/test/suite/blueprint-authoring/blueprintActionsCommand.test.ts))

**Command Integration**:

- ✓ Execute deploy action when selected
- ✓ Show deployment form when deploy is selected

**Running Tests**:

```bash
npm test
```

## Usage Examples

### Deploying an Environment via CodeLens

1. Open a blueprint YAML file (e.g., `my-app.yaml`)
2. Click the "Deploy" CodeLens above the file
3. Fill in the deployment form:
   - Verify/edit environment name
   - Fill in or select input values
4. Click "$(check) Deploy"
5. Wait for deployment to complete
6. Click "View in Portal" to see the environment

### Deploying via Command Palette

1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Torque: Blueprint Actions"
3. Press Enter
4. Select "$(rocket) Deploy" from the actions menu
5. Follow the deployment form steps

### Deploying with Cached Values

1. Deploy a blueprint once (values are cached)
2. Deploy the same blueprint again
3. Previous values are pre-filled
4. Modify any values as needed
5. Click Deploy

### Example Deployment Flow

**Blueprint**:

```yaml
spec_version: 2
description: "Web application"
inputs:
  - name: instance_type
    type: string
    default: t2.micro
  - name: region
    type: string
  - name: agent
    type: agent
grains:
  - name: web-server
    kind: terraform
    # ...
```

**Deployment Steps**:

1. **Open Form**: Shows 3 input fields + environment name
2. **Auto-Selection**: Agent field auto-selects if only one agent available
3. **Fill Inputs**:
   - Environment Name: `web-app-20251024T181757`
   - instance_type: `t2.micro` (default)
   - region: Select `us-east-1` from dropdown
   - agent: `aws-agent-1` (auto-selected)
4. **Deploy**: Click Deploy button
5. **Success**: Message shows "Environment deployed: web-app-20251024T181757"
6. **Portal**: Click "View in Portal" to monitor deployment

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
│   DeployBlueprintAction.execute()       │
│   (DeployBlueprintAction.ts)            │
│                                         │
│  • Parse blueprint YAML                 │
│  • Extract inputs                       │
│  • Check prerequisites                  │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Fetch Allowed Values                  │
│   (SpacesService.getInputAllowedValues) │
│                                         │
│  • POST /catalog/inputs_allowed_values  │
│  • Build allowed values map             │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Prepare Input List                    │
│                                         │
│  • Auto-select single values            │
│  • Apply default values                 │
│  • Load cached values                   │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Show Deployment Form                  │
│   (DeploymentForm.show())               │
│                                         │
│  • Display all fields                   │
│  • Handle user input                    │
│  • Validate on submit                   │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Deploy Environment                    │
│   (SpacesService.deployEnvironment)     │
│                                         │
│  • POST /spaces/{space}/environments    │
│  • Return environment ID                │
└────────────────┬────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────┐
│   Cache Values & Show Portal Link       │
│                                         │
│  • Store values in workspace state      │
│  • Show "View in Portal" button         │
│  • Open portal URL if clicked           │
└─────────────────────────────────────────┘
```

### Data Flow

1. **User Action**: User clicks "Deploy" CodeLens or selects deploy from command palette
2. **Document Read**: Extension reads blueprint YAML content from active editor
3. **YAML Parsing**: Uses `js-yaml` library to parse blueprint structure
4. **API Call #1**: Fetches allowed values for inputs from Torque API
5. **Form Display**: Shows interactive QuickPick form with all inputs
6. **User Input**: User fills/selects values for each input
7. **Validation**: Checks all required fields are filled
8. **API Call #2**: Deploys environment with collected input values
9. **Caching**: Stores values in workspace state for future use
10. **Portal Link**: Offers to open environment in Torque portal

## Dependencies

**Required**:

- VS Code API 1.85.0 or higher
- `js-yaml` - YAML parsing library
- Configured Torque API client

**Optional**:

- Active space configuration (can be set during deploy if not configured)

## Configuration

**Extension Settings**:

| Setting              | Description                      | Required |
| -------------------- | -------------------------------- | -------- |
| `torque.url`         | Torque API endpoint URL          | Yes      |
| `torque.token`       | API access token (SecretStorage) | Yes      |
| `torque.space`       | Default space name               | Optional |
| `torque.activeSpace` | Active workspace space           | Optional |

**Workspace State Keys**:

| Key                                       | Value                         | Purpose                 |
| ----------------------------------------- | ----------------------------- | ----------------------- |
| `torque.lastDeploymentValues.{blueprint}` | `{ environmentName, inputs }` | Cache deployment values |

## Future Enhancements

Potential improvements to environment deployment:

- [ ] Support for deployment tags and labels
- [ ] Duration/scheduling configuration in form
- [ ] Deployment description field
- [ ] Multi-environment batch deployment
- [ ] Deployment templates/presets
- [ ] Input validation rules from blueprint
- [ ] Conditional inputs (depends_on)
- [ ] Real-time deployment status tracking
- [ ] Integration with VS Code tasks
- [ ] Deployment history view

## Related Documentation

- [Environment Validation](./environment_validation.md)
- [Blueprint YAML Support](./blueprint_yaml_support.md)
- [Extension Configuration](./extension_configuration.md)
- [Torque Space Selection](./torque_space_selection.md)

## References

- **API Documentation**: Torque REST API v2
- **Blueprint Spec**: Torque Blueprint Specification v2
- **YAML Library**: https://github.com/nodeca/js-yaml
