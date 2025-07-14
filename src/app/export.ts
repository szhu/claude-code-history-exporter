/**
 * Claude Code chat export functionality
 * Orchestrates the export process from Claude projects to markdown
 */

import { basename } from "https://deno.land/std@0.208.0/path/mod.ts";
import { u } from "npm:unist-builder@4";
import type { RootContent } from "npm:@types/mdast@4";
import {
  createMetadataTableNodes,
  stringifyMarkdown,
} from "../content/markdown.ts";
import {
  extractChatMetadata,
  findChatFiles,
  parseClaudeChatFile,
  sortChatFilesByTime,
} from "../claude-project/claude-project.ts";
import {
  type AppCliOptions,
  createChatEntryNodes,
  createExportMetadata,
  mergeToolResults,
} from "./chat-processing.ts";
import { formatTimestamp } from "./claude-formatting.ts";

/**
 * Build the complete markdown document from chat files
 */
async function buildMarkdownDocument(
  title: string,
  chatFiles: string[],
  options: AppCliOptions,
): Promise<string> {
  const documentNodes: RootContent[] = [];

  // Main title
  documentNodes.push(u("heading", { depth: 1 as const }, [u("text", title)]));

  // Export metadata table (only for multi-chat exports)
  if (chatFiles.length > 1) {
    const exportMetadata = createExportMetadata(
      basename(chatFiles[0]).split("/").slice(-2, -1)[0] || "Chat",
      chatFiles,
      options,
    );
    const exportMetadataNodes = createMetadataTableNodes(exportMetadata);
    documentNodes.push(...exportMetadataNodes);
    documentNodes.push(u("thematicBreak"));
  }

  // Sort chat files by chronological order
  const sortedChatFiles = await sortChatFilesByTime(chatFiles);

  for (const chatFile of sortedChatFiles) {
    const chatId = basename(chatFile, ".jsonl");
    console.error(`Processing chat: ${chatId}`);

    // Chat heading
    documentNodes.push(
      u("heading", { depth: 2 as const }, [u("text", `Chat: ${chatId}`)]),
    );

    try {
      const entries = await parseClaudeChatFile(chatFile);
      console.error(`  Found ${entries.length} entries`);

      // Add metadata table for this chat
      const metadata = extractChatMetadata(entries);
      // Apply timestamp formatting to metadata
      const formattedMetadata = { ...metadata };
      if (formattedMetadata["Start Time"]) {
        formattedMetadata["Start Time"] = formatTimestamp(
          formattedMetadata["Start Time"],
        );
      }
      if (formattedMetadata["End Time"]) {
        formattedMetadata["End Time"] = formatTimestamp(
          formattedMetadata["End Time"],
        );
      }

      const metadataNodes = createMetadataTableNodes(formattedMetadata);
      documentNodes.push(...metadataNodes);

      // Process entries and merge tool results with tool uses
      const processedEntries = mergeToolResults(entries);

      for (const entry of processedEntries) {
        const entryNodes = createChatEntryNodes(entry, options);
        documentNodes.push(...entryNodes);
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.error(`Error processing ${chatFile}:`, errorMessage);
      documentNodes.push(
        u("paragraph", [
          u("emphasis", [
            u("text", `Error processing this chat: ${errorMessage}`),
          ]),
        ]),
      );
    }

    // Add separator
    documentNodes.push(u("thematicBreak"));
  }

  // Build and return markdown
  return stringifyMarkdown(documentNodes);
}

/**
 * Export a Claude project to markdown
 */
export async function exportProject(
  projectPath: string,
  options: AppCliOptions,
): Promise<void> {
  const projectName = basename(projectPath);

  // Find chat files
  const chatFiles = await findChatFiles(projectPath, options.chats);
  console.error(`Found ${chatFiles.length} chat file(s)`);

  // Build markdown document
  const title = `${projectName} - Claude Code History Export`;
  const markdown = await buildMarkdownDocument(title, chatFiles, options);

  // Output result
  if (options.output) {
    await Deno.writeTextFile(options.output, markdown);
    console.error(`✅ Export completed: ${options.output}`);
  } else {
    // Output to stdout
    console.log(markdown);
  }
}

/**
 * Export a single chat file to markdown
 */
export async function exportChat(
  chatPath: string,
  options: AppCliOptions,
): Promise<void> {
  const chatName = basename(chatPath, ".jsonl");
  console.error(`Processing chat: ${chatName}`);

  // Build markdown document with single chat
  const title = `${chatName} - Claude Code Chat Export`;
  const markdown = await buildMarkdownDocument(title, [chatPath], options);

  // Output result
  if (options.output) {
    await Deno.writeTextFile(options.output, markdown);
    console.error(`✅ Export completed: ${options.output}`);
  } else {
    // Output to stdout
    console.log(markdown);
  }
}
