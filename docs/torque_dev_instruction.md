# Torque AI Agent Instructions

## Overview

You are working in a workspace with the Torque AI VS Code extension installed. This extension provides MCP (Model Context Protocol) tools for interacting with Quali's Torque platform to manage cloud environments.

## Available Tools

### TorqueEnvironmentDetailsTool

**Tool Name**: `torque_get_environment_details`

**Purpose**: Fetches comprehensive information about a specific Torque environment including status, resources, cost, connections, and workflow details.

**When to Use**:

- User asks about a specific Torque environment
- User needs to know the status of an environment
- User wants to see cost information for an environment
- User asks about connections or resources in an environment
- Troubleshooting environment issues
- Before making changes to an environment (to understand current state)
- When user mentions an environment by name or ID

**Parameters**:

- `space_name` (string, required): The name of the Torque space
- `environment_id` (string, required): The ID of the environment

**Example Usage Scenarios**:

- "What's the status of my production environment?"
- "Show me details about environment xyz-123 in the dev-space"
- "How much is my staging environment costing?"
- "What resources are running in my test environment?"
- "Is my environment still launching?"
- "What's the owner of environment abc in prod-space?"

**Response Format**:
The tool returns formatted markdown with:

- Environment status and basic info
- Owner details (name, email)
- Cost information (in USD)
- Active connections
- Reserved resources
- Annotations and tags
- EAC (Environment as Code) information
- Workflow details and execution status
- Estimated launch time

## When NOT to Use Torque Tools

- General coding questions unrelated to Torque
- File operations or code analysis
- Questions about other VS Code extensions
- Generic cloud infrastructure questions without specific environment context
- When the user hasn't provided enough information (space name or environment ID)

## Best Practices

1. **Ask for Missing Information**: If the user asks about an environment but doesn't provide the space name or environment ID, ask for these details before calling the tool.

2. **Use Natural Language**: When presenting tool results, convert the technical data into natural, conversational language that answers the user's specific question.

3. **Summarize Appropriately**: If the user asks a specific question (e.g., "What's the cost?"), extract and highlight that specific information from the tool response rather than showing everything.

4. **Handle Errors Gracefully**: If the tool fails (e.g., environment not found, API error), provide helpful guidance like:
   - Check the space name and environment ID are correct
   - Verify the Torque extension is configured (`torque.setup` command)
   - Suggest checking the Torque web portal

5. **Suggest Related Actions**: After showing environment details, suggest relevant next steps like:
   - "Would you like me to help you modify this environment?"
   - "Do you need information about other environments in this space?"

## Configuration

The extension must be configured with:

- `torque.url` - Torque API endpoint
- `torque.token` - API access token (stored securely)

If tools aren't working, suggest the user run the `Torque: Configure Torque AI` command.

## Example Interactions

**Good**:

```
User: "What's the status of my prod-env in my-space?"
Agent: [Calls torque_get_environment_details with space_name="my-space", environment_id="prod-env"]
Agent: "Your environment 'prod-env' is currently Active. It's owned by John Doe and has been running for 3 days. The current cost is $42 USD."
```

**Better** (asking for clarification):

```
User: "Show me my production environment"
Agent: "I can help you get details about your production environment. What's the space name and environment ID I should look up?"
User: "Space is 'prod-space' and environment is 'app-prod-001'"
Agent: [Calls tool with provided parameters]
```

**Best** (contextual follow-up):

```
User: "Is my environment healthy?"
Agent: [Calls tool]
Agent: "Yes, your environment 'api-staging' in 'dev-space' is Active and healthy. It's been running for 2 hours with no issues. The workflow execution completed successfully. Would you like me to check the specific resources or connections?"
```

## Integration with Development Workflow

Use Torque tools when users are:

- Deploying or testing applications that depend on Torque environments
- Debugging issues that might be environment-related
- Checking costs before/after changes
- Verifying environment configurations
- Planning infrastructure changes
- Collaborating with team members on shared environments

## Remember

- Always prioritize the user's actual question over showing all available data
- Make the interaction feel natural and helpful, not like a raw API response
- Suggest using Torque tools proactively when the conversation context indicates the user is working with cloud environments
- Respect that environments represent real infrastructure with real costs - treat the data seriously
