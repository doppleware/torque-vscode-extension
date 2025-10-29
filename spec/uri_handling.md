# URI Handling and Deep Linking

## Overview

The Torque VS Code extension implements a custom URI scheme handler that enables deep linking into the extension from external sources such as web browsers, emails, documentation, and other applications. This feature allows seamless integration between the Torque web platform and the VS Code environment.

## Features

### 1. Custom URI Scheme

**Scheme**: `vscode://quali.torque-ai/`

**Format**: `vscode://quali.torque-ai/{path}?{query}`

**Example**:

```
vscode://quali.torque-ai/chat/context/add/environment/my-space/abc123
```

**Behavior**:

- Clicking URL in browser opens VS Code
- VS Code activates Torque AI extension
- Extension routes request to appropriate handler
- User sees immediate action (e.g., environment added to chat)

**Implementation**: [extension.ts:701-732](../src/extension.ts#L701-L732)

### 2. URI Router

The extension uses an Express-like routing system for handling URI requests.

**Router Features**:

- Pattern-based route matching
- Parameter extraction from paths
- Query string parsing
- Type-safe route handlers
- Automatic URL decoding

**Implementation**: [UriRouter.ts](../src/uris/UriRouter.ts)

### 3. Route Registration

**Method**: `uriRouter.route(pattern, handler)`

**Pattern Syntax**:

```typescript
"/path/:param1/:param2"; // Named parameters
"/path/*"; // Wildcard
"/path/fixed"; // Fixed path
```

**Handler Signature**:

```typescript
type RouteHandler = (
  params: Record<string, string>, // Path parameters
  query: Record<string, string>, // Query parameters
  uri: vscode.Uri // Full URI object
) => Promise<void>;
```

**Implementation**: [UriRouter.ts:24-34](../src/uris/UriRouter.ts#L24-L34)

### 4. Registered Routes

The extension registers the following routes:

#### Environment Context Route

**Pattern**: `/chat/context/add/environment/:space_name/:environment_id`

**Parameters**:

- `space_name` - Torque space name
- `environment_id` - Environment identifier

**Example**:

```
vscode://quali.torque-ai/chat/context/add/environment/Hyper-reasoning/PFQRtjMNyue2
```

**Action**:

1. Extracts space name and environment ID from URL
2. Calls `handleEnvironmentContextUrl()` with parameters
3. Fetches environment details from Torque API
4. Attaches environment context to AI chat
5. Opens related blueprint file (if found)

**Implementation**: [extension.ts:327-338](../src/extension.ts#L327-L338)

**Related**: [Environment Context Injection Specification](./environment_context_injection.md)

---

#### Webview Open Route

**Pattern**: `/webview/open`

**Query Parameters**:

- `url` - URL to open in webview

**Example**:

```
vscode://quali.torque-ai/webview/open?url=https://portal.torque.io/environments/abc123
```

**Action**:

1. Extracts URL from query string
2. Validates URL against configured Torque domain
3. Creates webview panel in VS Code
4. Loads URL in iframe within webview

**Security**:

- Only allows URLs from same base domain as configured Torque URL
- Prevents opening arbitrary external URLs
- Domain comparison uses base domain extraction

**Implementation**: [extension.ts:340-362](../src/extension.ts#L340-L362)

## URI Router Architecture

### Route Matching

The router uses `path-to-regexp` library for pattern matching:

**Process**:

1. Convert pattern to regular expression
2. Extract parameter keys from pattern
3. Match incoming URI path against regex
4. Extract parameter values
5. Call handler with parameters and query

**Implementation**: [UriRouter.ts:24-34](../src/uris/UriRouter.ts#L24-L34)

### Parameter Extraction

**Path Parameters**:

Given pattern: `/environment/:space/:id`

And URI: `/environment/my-space/env-123`

Extracted params:

```typescript
{
  space: "my-space",
  id: "env-123"
}
```

**Query Parameters**:

Given URI: `/webview/open?url=https://example.com&foo=bar`

Extracted query:

```typescript
{
  url: "https://example.com",
  foo: "bar"
}
```

**Implementation**: [UriRouter.ts:36-75](../src/uris/UriRouter.ts#L36-L75)

### URL Decoding

All parameters are automatically URL-decoded:

**Example**:

```
Input:  /environment/Hyper%20reasoning/PFQRtjMNyue2
Output: { space_name: "Hyper reasoning", environment_id: "PFQRtjMNyue2" }
```

## Webview Handler

The webview handler creates an embedded browser within VS Code.

**Features**:

- Full-page iframe display
- Script execution enabled
- Context retained when hidden
- Error handling for load failures
- Styled error messages

**HTML Structure**:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Torque Webview</title>
    <style>
      /* Fullscreen iframe styling */
    </style>
  </head>
  <body>
    <iframe src="{url}"></iframe>
  </body>
</html>
```

**Implementation**: [webview.ts](../src/uris/handlers/webview.ts)

## Security Considerations

### Domain Whitelisting

The webview handler only allows URLs from the configured Torque domain:

**Validation Logic**:

```typescript
const settingsUrl = await settingsManager.getSetting("url");
const settingsBaseDomain = getBaseDomain(settingsUrl);
const urlBaseDomain = getBaseDomain(requestedUrl);

if (settingsBaseDomain === urlBaseDomain) {
  // Allow
} else {
  // Reject with error message
}
```

**Base Domain Extraction**:

```typescript
// Example: "https://portal.torque.io" -> "torque.io"
const getBaseDomain = (url: string): string => {
  const hostname = new URL(url).hostname;
  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
};
```

**Implementation**: [extension.ts:45-49, 344-361](../src/extension.ts#L45-L49)

### Authentication

URI handlers don't require additional authentication because:

- Extension is already authenticated (has token)
- API calls use stored credentials
- User must explicitly click URI link (not automatic)
- VS Code security model isolates extensions

### Input Validation

**Parameter Validation**:

- Required parameters checked before processing
- Empty/missing parameters cause graceful failures
- Invalid URLs rejected with error messages

**Error Messages**:

```
Invalid URL domain. Only URLs from {domain} are allowed.
No handler found for URL: {url}
Failed to add environment to chat: {error}
```

## User Experience

### From Web Browser

**Scenario**: User clicks environment link in Torque web portal

1. User clicks "Open in VS Code" button
2. Browser asks to open `vscode://` link
3. User confirms (browser security prompt)
4. VS Code launches and activates extension
5. Environment context is added to chat
6. VS Code shows success notification

**Example Flow**:

```
Portal: "Analyze environment in VS Code"
   ↓
Browser: "Open VS Code?"
   ↓
VS Code: "Loading Environment Context..."
   ↓
VS Code: "Environment details have been added to the chat context"
```

### From Email or Documentation

**Scenario**: User receives environment link via email

1. Email contains link: `vscode://quali.torque-ai/chat/context/add/environment/...`
2. User clicks link
3. Email client opens link in system
4. Operating system launches VS Code
5. Extension handles URI and adds environment to chat

### From Command Line

**Scenario**: Developer has URI in terminal/script

```bash
# Open VS Code with environment context
open "vscode://quali.torque-ai/chat/context/add/environment/my-space/env-123"
```

**Platform-specific**:

- macOS: `open "vscode://..."`
- Windows: `start "vscode://..."`
- Linux: `xdg-open "vscode://..."`

## Error Handling

### Route Not Found

**Scenario**: URI path doesn't match any registered route

**Error Message**:

```
No handler found for URL: vscode://quali.torque-ai/unknown/path
```

**Behavior**:

- Warning notification shown to user
- Error logged to output channel
- VS Code remains open

**Implementation**: [extension.ts:710-716](../src/extension.ts#L710-L716)

### Handler Errors

**Scenario**: Route handler throws error during processing

**Error Message**:

```
Failed to handle URI: {error details}
```

**Behavior**:

- Error notification shown to user
- Full error logged with stack trace
- VS Code remains open and functional

**Implementation**: [extension.ts:722-730](../src/extension.ts#L722-L730)

### Invalid Domain

**Scenario**: Webview URL is not from allowed domain

**Error Message**:

```
Invalid URL domain. Only URLs from {torque-domain} are allowed.
```

**Behavior**:

- Error notification shown
- Webview not created
- Security violation logged

**Implementation**: [extension.ts:354-361](../src/extension.ts#L354-L361)

## Integration Examples

### Portal Integration

The Torque web portal can generate URIs for various actions:

**Environment Analysis**:

```html
<a
  href="vscode://quali.torque-ai/chat/context/add/environment/{{ space_name }}/{{ environment_id }}"
>
  Analyze in VS Code
</a>
```

**Environment Portal**:

```html
<a href="vscode://quali.torque-ai/webview/open?url={{ portal_url }}">
  Open in VS Code
</a>
```

### Documentation Links

Technical documentation can include direct links:

```markdown
To analyze this environment in VS Code, click:
[Open Environment](vscode://quali.torque-ai/chat/context/add/environment/production/env-abc123)
```

### Email Notifications

Automated emails can include action links:

```html
<p>Environment deployed successfully!</p>
<a href="vscode://quali.torque-ai/chat/context/add/environment/...">
  View in VS Code
</a>
```

### Slack/Teams Integration

Chat bots can post deep links:

```
Environment `production-api` is ready!
Open in VS Code: vscode://quali.torque-ai/chat/context/add/environment/...
```

## Testing

**Test Files**:

- [uriRouter.test.ts](../src/test/suite/uris/uriRouter.test.ts) - Router functionality
- [uriHandlerIntegration.test.ts](../src/test/suite/uris/uriHandlerIntegration.test.ts) - End-to-end URI handling

**Test Suites**:

### Route Matching

- ✓ Match exact paths
- ✓ Extract path parameters
- ✓ Parse query strings
- ✓ Handle URL encoding
- ✓ Return false for unmatched routes

### Handler Execution

- ✓ Call handler with correct parameters
- ✓ Pass query parameters
- ✓ Handle handler errors gracefully

### Security

- ✓ Validate webview domains
- ✓ Reject invalid domains
- ✓ Allow same-domain URLs

**Running Tests**:

```bash
npm test
```

## Configuration

**Extension Settings**:

| Setting               | Purpose          | Required for              |
| --------------------- | ---------------- | ------------------------- |
| `torque.url`          | API endpoint     | Environment context route |
| `torque.token`        | Authentication   | Environment context route |
| `torque.url` (domain) | Domain whitelist | Webview route             |

**No additional configuration needed** - URI handling works automatically when extension is installed.

## Logging

All URI handling activities are logged:

**Log Entries**:

```
[URI Handler] Received URI: vscode://quali.torque-ai/...
[URI Handler] URI scheme: vscode, authority: quali.torque-ai, path: /...
[URI Handler] Successfully handled URI: vscode://...
```

**Error Logs**:

```
[URI Handler] No route found for URI: vscode://...
[URI Handler] Failed to handle URI: {error}
```

**Log Location**: VS Code Output panel > "Torque AI"

## Platform Support

### Operating Systems

| Platform | Support | Notes                             |
| -------- | ------- | --------------------------------- |
| macOS    | ✅ Full | Native `vscode://` scheme support |
| Windows  | ✅ Full | Native `vscode://` scheme support |
| Linux    | ✅ Full | Requires xdg-utils for CLI        |

### Browsers

| Browser     | Support | Notes                        |
| ----------- | ------- | ---------------------------- |
| Chrome/Edge | ✅ Full | Prompts user to open VS Code |
| Firefox     | ✅ Full | Prompts user to open VS Code |
| Safari      | ✅ Full | Prompts user to open VS Code |

All modern browsers support custom URI schemes with user confirmation.

## Future Enhancements

Potential improvements to URI handling:

- [ ] Additional routes for blueprint operations (validate, deploy)
- [ ] Route for setting active space
- [ ] Route for opening specific blueprint files
- [ ] Deep link to specific environment resources
- [ ] Deep link to workflow execution
- [ ] Support for batch operations via URI
- [ ] QR code generation for URIs
- [ ] URI shortening service integration
- [ ] Analytics for URI usage
- [ ] Custom URI handler for `torque://` scheme
- [ ] URI builder utility/API
- [ ] Clipboard integration (copy URI to clipboard)

## Related Documentation

- [Environment Context Injection](./environment_context_injection.md) - Environment context route implementation
- [Extension Configuration](./extension_configuration.md) - Setup and authentication
- [Blueprint YAML Support](./blueprint_yaml_support.md) - Blueprint file features

## References

- **VS Code API**: `vscode.window.registerUriHandler`
- **Pattern Matching**: `path-to-regexp` library
- **URI Spec**: RFC 3986
- **Custom URI Schemes**: Protocol handlers in operating systems
