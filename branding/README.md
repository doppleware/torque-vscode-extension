# Branding

Each subfolder is one shipped brand: a `brand.json` describing its identity and a
`logo.png` used as the marketplace icon. `npm run package:all` produces one VSIX
per brand into `dist/`, and `npm run verify:packages` asserts each package really
carries the identity its brand claims.

## Brands

| Brand              | Extension name        | Display name     | Extension id                |
| ------------------ | --------------------- | ---------------- | --------------------------- |
| `torque`           | `torque-ai`           | Torque AI        | `quali.torque-ai`           |
| `stack-automation` | `stack-automation-ai` | Stack Automation | `quali.stack-automation-ai` |

`torque` is the base brand: the checked-in `package.json` already carries its
identity, so building it applies no replacements. Every other brand is produced by
overlaying its `brand.json` onto that same manifest at package time.

## What a brand controls

`brand.json` holds one key, `manifest`, whose fields are written over `package.json`
verbatim: `name`, `displayName` and `icon`. Every brand file has the same shape —
there is no privileged brand, only a base manifest that already happens to carry the
`torque` identity.

Prose is rebranded automatically, derived from the display names rather than
hand-listed. Building brand X from brand Y substitutes:

- `Y.displayName` → `X.displayName` (e.g. `Torque AI` → `Stack Automation`)
- the same names with a trailing ` AI` dropped (e.g. `Torque` → `Stack Automation`)

Longest form first, so `Torque AI` is consumed before `Torque`. Substitution applies
to `description` and everything under `contributes`, and skips URL substrings — so a
setting description gets rebranded while the link inside it is left alone. Building
the base brand from itself is a no-op, which is why `torque` needs no special case.

Renaming `name` also rekeys the `contributes.configuration` properties and the
`onUri:quali.<name>` activation event, because settings and the portal deep link are
namespaced by extension name.

## Identifiers

Every identifier is derived from the extension name, so no two brands share one and
both can be installed in the same editor. The base brand reproduces today's values
exactly, so existing keybindings keep working.

| Kind                | Derivation                  | `torque`                         | `stack-automation`                         |
| ------------------- | --------------------------- | -------------------------------- | ------------------------------------------ |
| Settings            | `<name>.<key>`              | `torque-ai.space`                | `stack-automation-ai.space`                |
| Commands            | `<slug>.<suffix>`           | `torque.setup`                   | `stack-automation.setup`                   |
| File template       | `<slug>.blueprint`          | `torque.blueprint`               | `stack-automation.blueprint`               |
| Diagnostics source  | `<slug>-blueprint`          | `torque-blueprint`               | `stack-automation-blueprint`               |
| Language model tool | base name, slug substituted | `torque_get_environment_details` | `stack_automation_get_environment_details` |
| MCP provider        | `<camelSlug>McpProvider`    | `torqueMcpProvider`              | `stackAutomationMcpProvider`               |
| MCP server          | `<slug>`                    | `torque`                         | `stack-automation`                         |

`slug` is the extension name with a trailing `-ai` removed.

`src/brandNaming.ts` is the single definition of these rules and of the base brand's
identity. It is imported by all three consumers — `src/branding.ts` at runtime,
`scripts/brand.ts` when packaging, and `scripts/verifyVsix.ts` when verifying — so
they cannot drift. `verifyVsix.ts` recomputes every expected identifier from the base
manifest plus those rules and compares it against the packaged manifest, which is why
a rule change that misses one consumer fails the build instead of shipping.

In source, never write an identifier as a literal — use `getCommandId`,
`getDiagnosticCollectionName`, `getToolName`, `getMcpProviderId` or
`getConfigurationKey` from `src/branding.ts`, and the `*_TOOL` constants from
`src/brandNaming.ts` for base tool names.

Two deliberate exceptions:

- **Persistence keys are not brand-derived.** `DEPLOYMENT_VALUES_KEY` in
  `DeployBlueprintAction.ts` is a fixed literal, because `workspaceState` is already
  scoped per extension and a brand rename would otherwise orphan cached values.
- **Anything created at module scope must resolve its name lazily**, since
  `initializeBranding` runs during `activate()` — after imports. The output channel in
  `src/utils/Logger.ts` and the diagnostic collection in `blueprintActionsCommand.ts`
  both do this.

## What is deliberately shared

All brands ship one identical `out/extension.js`; only the manifest, icon and readme
differ between packages.

`README.md` is rewritten at package time, because VS Code renders it as the extension
details page and it must read naturally as Torque on GitHub. `scripts/brandText.ts`
substitutes outside URL substrings only, so prose is rebranded while the badge and
repository links are left intact.

The Copilot instruction template in `docs/` is shared and substituted at runtime when
the extension writes `.github/copilot-instructions.md` into a workspace: `{{PLATFORM}}`
becomes the platform name, and base tool names are replaced with their branded forms.
Write new prose there with `{{PLATFORM}}` and the real base tool names, never a brand
name.

Two brands installed together will still each write that workspace file, so the last
one to activate wins.

## Vocabulary

A brand may also present the platform's concepts under different names. `brand.json`
declares those in `glossary`, keyed by the platform's own term:

```json
"glossary": {
  "environment": "Deployment",
  "catalog": "Solution Hub",
  "credential": "Integration"
}
```

The value is written verbatim, because these are product nouns that read as proper
names ("the Deployment is ready"). Regular plurals are handled automatically, so
`environments` becomes `Deployments`.

Substitution is word-boundary anchored and skips URLs and path-shaped strings, which
is what keeps `torque_get_environment_details`, `environment_id` and
`/api/spaces/x/environments/y` intact while rebranding the prose around them.

An optional `phrases` map handles collisions where a naive word swap reads badly —
`"environment deployment": "Deployment"` prevents "Environment Deployment
Specification" becoming "Deployment Deployment Specification". Longer keys win, and
`phrases` is used for substitution only; it never appears in the terminology the AI
is given.

In source, wrap user-facing prose in `getTerm("environment")` rather than writing the
word directly. Only do this where the word means the _platform_ concept. Three senses
are deliberately left alone:

- OS environment variables (`getGlobalSettingsFolderPath.ts`)
- the runtime environment ("this VS Code version or environment")
- debug log lines that describe the API itself, since the wire format really does say
  `environments` and rewriting them would make logs misleading

`agent` is deliberately absent from the glossary: in this extension it always means a
chat agent (Copilot, Kiro, Cursor), never a platform execution agent. Mapping it would
produce "Configure Management Servers" for choosing your AI chat.

### What the AI is told

Human-facing text is substituted, including language model tool descriptions, because
those drive how well a request like "show my deployments" matches a tool. The data the
model receives still uses the platform's own field names, so both model-facing surfaces
also carry a generated terminology block from `getTerminologyBridge()`: the
`{{TERMINOLOGY}}` placeholder in the instruction template, and the per-environment
context file written on chat hand-off. It tells the model to reason in the platform's
terms and speak in the brand's. Brands without a glossary get an empty string.

## Adding a brand

1. Create `branding/<id>/brand.json` and `branding/<id>/logo.png`.
2. Add `package:<id>` to `scripts` and chain it into `package:all`.
3. Run `npm run package:all && npm run verify:packages`.
