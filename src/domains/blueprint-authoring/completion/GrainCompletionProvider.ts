/**
 * Grain Completion Provider
 *
 * Provides autocomplete suggestions for grain names in blueprint YAML files.
 * Fetches IAC assets from the Torque catalog API and caches results for performance.
 *
 * Features:
 * - Fetches grain names from Torque catalog
 * - Provides completion items with grain metadata (type, repository)
 * - Caches results per space with 5-minute TTL
 * - Clears cache when space configuration changes
 * - Filters suggestions based on user input
 *
 * @see {@link file://../../spec/blueprint_autocomplete.md} Blueprint Autocomplete Specification
 */

import * as vscode from "vscode";
import type { ApiClient } from "../../../api/ApiClient";
import type { IacAsset } from "../../../api/services/types";
import { logger } from "../../../utils/Logger";
import type { SettingsManager } from "../../setup/SettingsManager";

/**
 * Cache entry for IAC assets
 */
interface CacheEntry {
  assets: IacAsset[];
  timestamp: number;
}

/**
 * Additional data stored with completion items for lazy resolution
 */
interface GrainCompletionData {
  asset: IacAsset;
  grainName: string;
  spaceName: string;
  isSourceSection: boolean;
}

/**
 * Provides completion items for grain names in blueprint YAML files
 */
export class GrainCompletionProvider
  implements
    vscode.CompletionItemProvider<
      vscode.CompletionItem & { grainData?: GrainCompletionData }
    >
{
  // Cache of IAC assets per space
  private readonly cache = new Map<string, CacheEntry>();

  // Cache TTL: 5 minutes
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly settingsManager: SettingsManager,
    private readonly getApiClient: () => ApiClient | null
  ) {
    // Clear cache when space configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("torque-ai.space") ||
        event.affectsConfiguration("torque-ai.activeSpace")
      ) {
        logger.debug("Space configuration changed, clearing grain cache");
        this.clearCache();
      }
    });
  }

  /**
   * Clears the entire cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidates cache for a specific space
   */
  public invalidateSpace(spaceName: string): void {
    this.cache.delete(spaceName);
    logger.debug(`Invalidated grain cache for space: ${spaceName}`);
  }

  /**
   * Refreshes the cache for the current active space
   */
  public async refreshCache(): Promise<void> {
    const apiClient = this.getApiClient();
    if (!apiClient) {
      return;
    }

    const activeSpace =
      await this.settingsManager.getSetting<string>("activeSpace");
    const defaultSpace = await this.settingsManager.getSetting<string>("space");
    const effectiveSpace = activeSpace ?? defaultSpace;

    if (effectiveSpace) {
      this.invalidateSpace(effectiveSpace);
      await this.getIacAssets(effectiveSpace, apiClient);
    }
  }

  /**
   * Gets IAC assets from cache or API
   */
  private async getIacAssets(
    spaceName: string,
    apiClient: ApiClient
  ): Promise<IacAsset[]> {
    // Check cache
    const cached = this.cache.get(spaceName);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      const age = Math.round((now - cached.timestamp) / 1000);
      logger.info(
        `Using cached IAC assets for space: ${spaceName} (age: ${age}s, count: ${cached.assets.length})`
      );
      return cached.assets;
    }

    // Fetch all pages from API
    logger.info(`Fetching all IAC assets from API for space: ${spaceName}`);
    try {
      const response = await apiClient.spaces.getAllIacAssets(spaceName);
      logger.info(
        `API response received: ${response.iac_assets.length} assets across ${response.paging_info.total_pages} page(s), ${response.paging_info.full_count} total`
      );
      const assets = response.iac_assets;

      // Update cache
      this.cache.set(spaceName, {
        assets,
        timestamp: now
      });

      logger.info(`Cached ${assets.length} IAC assets for space: ${spaceName}`);
      return assets;
    } catch (error) {
      logger.error(
        `Failed to fetch IAC assets for space: ${spaceName}`,
        error as Error
      );
      throw error;
    }
  }

  /**
   * Provides completion items for the document at the given position
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[] | undefined> {
    try {
      logger.info("=== Grain Completion Provider Called ===");
      logger.info(`Document: ${document.fileName}`);
      logger.info(`Language: ${document.languageId}`);
      logger.info(
        `Position: Line ${position.line}, Character ${position.character}`
      );

      // Only provide completions for YAML files
      if (document.languageId !== "yaml") {
        logger.info("Not a YAML file, skipping completion");
        return undefined;
      }

      // Check if this is a blueprint file
      const isBlueprint = this.isBlueprintFile(document);
      logger.info(`Is blueprint file: ${isBlueprint}`);
      if (!isBlueprint) {
        logger.info("Not a blueprint file, skipping completion");
        return undefined;
      }

      // Check if we're in a valid position for grain completion
      const inGrainsSection = this.isInGrainsSection(document, position);
      const sourceContext = this.getSourceContext(document, position);

      logger.info(`In grains section: ${inGrainsSection}`);
      logger.info(
        `In source section: ${sourceContext.inSourceSection}, expected kind: ${sourceContext.expectedKind ?? "any"}`
      );

      if (!inGrainsSection && !sourceContext.inSourceSection) {
        logger.info(
          "Not in grains section or source section, skipping completion"
        );
        return undefined;
      }

      // Get the API client
      const apiClient = this.getApiClient();
      if (!apiClient) {
        logger.warn("API client not available for grain completion");
        return undefined;
      }
      logger.info("API client is available");

      // Get the active space
      const activeSpace =
        await this.settingsManager.getSetting<string>("activeSpace");
      const defaultSpace =
        await this.settingsManager.getSetting<string>("space");
      const effectiveSpace = activeSpace ?? defaultSpace;

      logger.info(`Active space: ${activeSpace ?? "not set"}`);
      logger.info(`Default space: ${defaultSpace ?? "not set"}`);
      logger.info(`Effective space: ${effectiveSpace ?? "not set"}`);

      if (!effectiveSpace) {
        logger.warn("No space configured for grain completion");
        return undefined;
      }

      // Get IAC assets (from cache or API)
      logger.info(`Fetching IAC assets for space: ${effectiveSpace}`);
      const iacAssets = await this.getIacAssets(effectiveSpace, apiClient);

      logger.info(`Retrieved ${iacAssets.length} IAC assets`);
      if (iacAssets.length > 0) {
        logger.info(
          `Sample assets: ${iacAssets
            .slice(0, 3)
            .map((a) => a.name)
            .join(", ")}`
        );
      }

      // Filter assets by kind if we're in a source section
      let filteredAssets = iacAssets;
      if (sourceContext.inSourceSection && sourceContext.expectedKind) {
        filteredAssets = iacAssets.filter(
          (asset) =>
            asset.iac_resource_type.toLowerCase() ===
            sourceContext.expectedKind?.toLowerCase()
        );
        logger.info(
          `Filtered to ${filteredAssets.length} assets matching kind: ${sourceContext.expectedKind}`
        );
      }

      // Create completion items for each IAC asset
      const completionItems = filteredAssets.map((asset) => {
        // Extract the grain name from the path (last segment)
        const grainName = asset.path.split("/").pop() ?? asset.path;

        // Show "grain-name (Type)" in the label, with emoji for building blocks
        const isDesignerLibrary = asset.in_designer_library ?? false;
        const buildingBlockIcon = isDesignerLibrary ? "📦 " : "";
        const label = `${buildingBlockIcon}${grainName} (${asset.iac_resource_type})`;

        const item = new vscode.CompletionItem(
          label,
          vscode.CompletionItemKind.Module
        );

        // Set the detail (shown on the right side)
        item.detail = `${asset.repository}/${asset.path}`;

        // Build comprehensive documentation
        const docParts: string[] = [];

        docParts.push(`**${asset.name}**`);
        docParts.push("");
        docParts.push(`Type: ${asset.iac_resource_type}`);
        if (isDesignerLibrary) {
          docParts.push(`📦 Building Block`);
        }
        docParts.push(`Repository: ${asset.repository}`);
        docParts.push(`Path: ${asset.path}`);

        if (asset.branch) {
          docParts.push(`Branch: ${asset.branch}`);
        }

        if (asset.labels && asset.labels.length > 0) {
          docParts.push("");
          docParts.push(
            `Labels: ${asset.labels.map((l) => l.name).join(", ")}`
          );
        }

        if (
          asset.average_hourly_cost !== undefined &&
          asset.average_hourly_cost > 0
        ) {
          docParts.push("");
          docParts.push(
            `Average hourly cost: $${asset.average_hourly_cost.toFixed(2)}`
          );
        }

        if (asset.blueprint_count !== undefined) {
          docParts.push("");
          docParts.push(`Used in ${asset.blueprint_count} blueprint(s)`);
        }

        item.documentation = new vscode.MarkdownString(docParts.join("\n"));

        // Insert snippet - different based on context
        if (sourceContext.inSourceSection) {
          // In source section, only insert store and path (no catalog fetch needed)
          const snippetValue = [
            `store: '${asset.repository}'`,
            `path: '${asset.path}'`
          ].join("\n");
          item.insertText = new vscode.SnippetString(snippetValue);
        } else {
          // In grains section, store metadata for command-based insertion
          const grainData: GrainCompletionData = {
            asset,
            grainName,
            spaceName: effectiveSpace,
            isSourceSection: false
          };

          // Set insertText to empty string to prevent label from being inserted
          // The command will handle the actual insertion
          item.insertText = "";

          // Add command to fetch catalog data and insert complete grain structure
          item.command = {
            command: "torque.insertGrainWithInputs",
            title: "Insert grain with inputs",
            arguments: [grainData]
          };
        }

        // Set filter text to the grain name for matching
        item.filterText = grainName;

        // Set range to replace any partial grain name the user has typed
        const currentLine = document.lineAt(position.line);
        const lineText = currentLine.text;
        const linePrefix = lineText.substring(0, position.character);
        const matchRegex = /^\s+([a-zA-Z0-9_-]*)$/;
        const match = matchRegex.exec(linePrefix);
        if (match) {
          const startChar = linePrefix.length - match[1].length;
          item.range = new vscode.Range(
            position.line,
            startChar,
            position.line,
            position.character
          );
        }

        // Sort by: building blocks first (in_designer_library), then by usage count
        const usageCount = asset.total_usage_count ?? 0;
        // Use 0 for building blocks, 1 for regular assets, then sort by usage within each category
        const categoryPrefix = isDesignerLibrary ? "0" : "1";
        item.sortText =
          `${categoryPrefix}-${10000 - usageCount}`.padStart(7, "0") +
          asset.name;

        // Add tags for filtering
        if (asset.in_error) {
          item.tags = [vscode.CompletionItemTag.Deprecated];
        }

        return item;
      });

      logger.info(`Returning ${completionItems.length} completion items`);
      return completionItems;
    } catch (error) {
      logger.error("Error providing grain completions", error as Error);
      return undefined;
    }
  }

  /**
   * Resolves a completion item to add detailed snippet with actual inputs from catalog
   * Called when the user selects a specific grain from the completion list
   */
  async resolveCompletionItem(
    item: vscode.CompletionItem & { grainData?: GrainCompletionData }
  ): Promise<vscode.CompletionItem> {
    try {
      logger.info(`=== resolveCompletionItem CALLED ===`);
      logger.info(
        `Item label: ${typeof item.label === "string" ? item.label : JSON.stringify(item.label)}`
      );
      logger.info(`Has grainData: ${!!item.grainData}`);

      // Only resolve items that have grain data (items in grains section)
      if (!item.grainData) {
        logger.info(`No grainData found, returning item as-is`);
        return item;
      }

      const { asset, grainName, spaceName } = item.grainData;

      logger.info(`=== Resolving Completion Item for Grain: ${grainName} ===`);
      logger.info(`Space: ${spaceName}`);
      logger.info(`Asset: ${asset.name}`);
      logger.info(`Repository: ${asset.repository}`);

      // Get the API client
      const apiClient = this.getApiClient();
      if (!apiClient) {
        logger.warn("API client not available for catalog resolution");
        return item;
      }

      // Fetch catalog data to get actual inputs
      // Note: The catalog API requires "qtorque" as the repository name for building blocks
      const catalogRepositoryName = asset.in_designer_library
        ? "qtorque"
        : asset.repository;

      logger.info(
        `Using repository name: ${catalogRepositoryName} for catalog fetch`
      );
      logger.info(
        `Is building block (in_designer_library): ${asset.in_designer_library ?? false}`
      );

      try {
        const catalogData = await apiClient.spaces.getCatalogAsset(
          spaceName,
          asset.name,
          catalogRepositoryName
        );

        logger.info(`Catalog data received for ${grainName}`);
        logger.info(
          `Inputs count: ${catalogData.details?.inputs?.length ?? 0}`
        );

        // Generate snippet with actual inputs from catalog
        const snippetLines: string[] = [
          `${grainName}:`,
          `  kind: '${asset.iac_resource_type.toLowerCase()}'`,
          `  spec:`,
          `    source:`,
          `      store: '${asset.repository}'`,
          `      path: '${asset.path}'`
        ];

        // Add agent section
        snippetLines.push(`    agent:`);
        snippetLines.push(`      name: '\${1:AGENT_NAME}'`);

        // Add inputs section with actual catalog inputs
        if (
          catalogData.details?.inputs &&
          catalogData.details.inputs.length > 0
        ) {
          snippetLines.push(`    inputs:`);

          let tabStopIndex = 2;
          catalogData.details.inputs.forEach((input) => {
            const inputName = input.name;
            const hasDefault = input.has_default_value;
            const defaultValue = input.default_value;

            let inputValue: string;
            if (hasDefault && defaultValue !== null) {
              // Use default value if available
              inputValue = defaultValue;
            } else {
              // Inputs without defaults get a placeholder
              inputValue = `\${${tabStopIndex}:${inputName}}`;
              tabStopIndex++;
            }

            snippetLines.push(`      - ${inputName}: '${inputValue}'`);
          });
        } else {
          // No inputs from catalog, use placeholder
          snippetLines.push(`    inputs:`);
          snippetLines.push(`      - \${2:input_name}: '\${3:value}'`);
        }

        // Add commands section
        snippetLines.push(`    commands:`);
        snippetLines.push(`      - '\${0:dep up ${asset.path}}'`);

        // Update the insert text with the resolved snippet
        item.insertText = new vscode.SnippetString(snippetLines.join("\n"));

        logger.info(`Successfully resolved completion item for ${grainName}`);
      } catch (error) {
        logger.error(
          `Failed to fetch catalog data for ${grainName}`,
          error as Error
        );
        // Keep the placeholder snippet if catalog fetch fails
      }

      return item;
    } catch (error) {
      logger.error("Error resolving completion item", error as Error);
      return item;
    }
  }

  /**
   * Gets the source context to determine if we're in a source section
   * and what kind of grain is expected
   */
  private getSourceContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { inSourceSection: boolean; expectedKind?: string } {
    // Get text from start to current position
    const textBeforeCursor = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );

    // Look for the current grain definition by finding the most recent grain name
    // Pattern: lines with indentation followed by a name and colon (grain name)
    const grainMatches = [
      ...textBeforeCursor.matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*$/gm)
    ];

    if (grainMatches.length === 0) {
      return { inSourceSection: false };
    }

    // Get the last grain definition
    const lastGrainMatch = grainMatches[grainMatches.length - 1];
    const grainStartIndex = lastGrainMatch.index ?? 0;

    // Get text from the last grain definition to cursor
    const grainText = textBeforeCursor.substring(grainStartIndex);

    // Check if we're in the source section
    const sourceMatch = /\n\s+spec:\s*\n\s+source:\s*$/m.test(grainText);
    if (!sourceMatch) {
      return { inSourceSection: false };
    }

    // Look for the kind field to determine expected type
    const kindMatch = /kind:\s*['"]?(\w+)['"]?/i.exec(grainText);
    const expectedKind = kindMatch ? kindMatch[1] : undefined;

    logger.info(
      `Found source section context, expected kind: ${expectedKind ?? "not specified"}`
    );

    return {
      inSourceSection: true,
      expectedKind
    };
  }

  /**
   * Checks if the document is a blueprint file
   * The schema MUST be defined in the first line of the file
   */
  private isBlueprintFile(document: vscode.TextDocument): boolean {
    // Get the first line of the document
    if (document.lineCount === 0) {
      return false;
    }

    const firstLine = document.lineAt(0).text;

    // Check for the yaml-language-server schema directive with blueprint-spec2-schema
    // This is the definitive way to identify a Torque blueprint file
    return firstLine.includes("blueprint-spec2-schema.json");
  }

  /**
   * Checks if the current position is within the grains section
   */
  private isInGrainsSection(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    // Get text from start to current position
    const textBeforeCursor = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );

    // Check if we're after a "grains:" line
    const grainsMatch = /^grains:\s*$/m.test(textBeforeCursor);
    logger.info(`Found 'grains:' section: ${grainsMatch}`);
    if (!grainsMatch) {
      return false;
    }

    // Get the line at the current position
    const currentLine = document.lineAt(position.line).text;
    const currentLinePrefix = currentLine.substring(0, position.character);

    logger.info(`Current line: "${currentLine}"`);
    logger.info(`Line prefix: "${currentLinePrefix}"`);

    // Check if we're at the start of a grain name (2+ spaces indent, no colon yet)
    // We want to trigger when:
    // 1. User is on an empty line with indentation: "  "
    // 2. User is typing the grain name: "  hello-w"
    // We DON'T want to trigger if there's already a colon (grain already defined)
    const isGrainNamePosition = /^\s{2,}[a-zA-Z0-9_-]*$/.test(
      currentLinePrefix
    );
    logger.info(
      `Is grain name position (2+ spaces, no colon): ${isGrainNamePosition}`
    );

    return isGrainNamePosition;
  }
}

/**
 * Registers the grain completion provider and sets up cache refresh triggers
 */
export function registerGrainCompletionProvider(
  settingsManager: SettingsManager,
  getApiClient: () => ApiClient | null
): { disposable: vscode.Disposable; provider: GrainCompletionProvider } {
  const provider = new GrainCompletionProvider(settingsManager, getApiClient);

  // Register command to fetch catalog data and replace placeholder after insertion
  const commandDisposable = vscode.commands.registerCommand(
    "torque.insertGrainWithInputs",
    async (grainData: GrainCompletionData) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const apiClient = getApiClient();
      if (!apiClient) {
        return;
      }

      const { asset, grainName, spaceName } = grainData;
      const catalogRepositoryName = asset.in_designer_library
        ? "qtorque"
        : asset.repository;

      logger.info(`=== Command torque.insertGrainWithInputs CALLED ===`);
      logger.info(`Grain: ${grainName}`);
      logger.info(`Space: ${spaceName}`);
      logger.info(`Repository: ${catalogRepositoryName}`);

      try {
        // Fetch catalog data
        logger.info(`Fetching catalog data...`);
        const catalogData = await apiClient.spaces.getCatalogAsset(
          spaceName,
          asset.name,
          catalogRepositoryName
        );

        logger.info(
          `Catalog data received: ${catalogData.details?.inputs?.length ?? 0} inputs`
        );

        // Build the complete grain structure
        const snippetLines: string[] = [
          `${grainName}:`,
          `  kind: '${asset.iac_resource_type.toLowerCase()}'`,
          `  spec:`,
          `    source:`,
          `      store: '${asset.repository}'`,
          `      path: '${asset.path}'`,
          `    agent:`,
          `      name: '\${1:AGENT_NAME}'`,
          `    inputs:`
        ];

        // Add inputs from catalog
        if (
          catalogData.details?.inputs &&
          catalogData.details.inputs.length > 0
        ) {
          let tabStopIndex = 2;
          catalogData.details.inputs.forEach((input) => {
            const inputName = input.name;
            const hasDefault = input.has_default_value;
            const defaultValue = input.default_value;

            let inputValue: string;
            if (hasDefault && defaultValue !== null) {
              inputValue = defaultValue;
            } else {
              inputValue = `\${${tabStopIndex}:${inputName}}`;
              tabStopIndex++;
            }

            snippetLines.push(`      - ${inputName}: '${inputValue}'`);
          });
        } else {
          // Fallback if no inputs
          snippetLines.push(`      - \${2:input_name}: '\${3:value}'`);
        }

        // Insert the complete snippet at cursor
        const snippet = new vscode.SnippetString(snippetLines.join("\n"));
        const success = await editor.insertSnippet(snippet);

        logger.info(`Insert ${success ? "succeeded" : "failed"}`);

        if (success) {
          logger.info(
            `Successfully inserted grain with ${catalogData.details?.inputs?.length ?? 0} inputs`
          );
        }
      } catch (error) {
        logger.error(
          `Failed to fetch catalog data for ${grainName}`,
          error as Error
        );

        // Fallback: insert basic structure without inputs
        const fallbackSnippet = new vscode.SnippetString(
          [
            `${grainName}:`,
            `  kind: '${asset.iac_resource_type.toLowerCase()}'`,
            `  spec:`,
            `    source:`,
            `      store: '${asset.repository}'`,
            `      path: '${asset.path}'`,
            `    agent:`,
            `      name: '\${1:AGENT_NAME}'`,
            `    inputs:`,
            `      - \${2:input_name}: '\${3:value}'`,
            `    commands:`,
            `      - '\${0:dep up ${asset.path}}'`
          ].join("\n")
        );

        await editor.insertSnippet(fallbackSnippet);
      }
    }
  );

  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    { language: "yaml", pattern: "**/*.{yaml,yml}" },
    provider,
    ":" // Trigger on colon as well
  );

  // Refresh cache when blueprint files are opened
  const openDisposable = vscode.workspace.onDidOpenTextDocument(
    async (document) => {
      if (document.languageId === "yaml") {
        // Check if it's a blueprint file (schema must be in first line)
        if (document.lineCount > 0) {
          const firstLine = document.lineAt(0).text;
          if (firstLine.includes("blueprint-spec2-schema.json")) {
            logger.info(
              `Blueprint file opened: ${document.fileName}, refreshing grain cache`
            );
            await provider.refreshCache();
          }
        }
      }
    }
  );

  // Combine disposables
  const disposable = vscode.Disposable.from(
    commandDisposable,
    completionDisposable,
    openDisposable
  );

  logger.info(
    "Registered grain completion provider with cache refresh and command"
  );
  return { disposable, provider };
}
