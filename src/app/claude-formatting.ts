/**
 * Claude Code specific formatting and content processing
 * Application-specific logic for formatting Claude chat exports
 */

import { remark } from "npm:remark@15";
import remarkGfm from "npm:remark-gfm@4";
import { u } from "npm:unist-builder@4";
import { unistToHtml } from "../content/html.ts";
import type { Node } from "npm:@types/unist@3";
import type { RootContent } from "npm:@types/mdast@4";
import { createDetailsBlock } from "../content/markdown.ts";
import type { ContentBlock } from "../claude-project/types.ts";

interface Todo {
  status: "completed" | "in_progress" | "pending";
  content: string;
}

/**
 * Process assistant content with smart collapsible truncation
 * Claude-specific logic for making long assistant messages more scannable
 */
export function processAssistantContent(
  contentNodes: RootContent[],
): RootContent[] {
  if (contentNodes.length === 0) {
    return [];
  }

  const visibleNodes: RootContent[] = [];
  const collapsedNodes: RootContent[] = [];

  let paragraphCount = 0;
  let shouldCollapse = false;

  for (const node of contentNodes) {
    if (shouldCollapse) {
      collapsedNodes.push(node);
      continue;
    }

    if (node.type === "paragraph") {
      paragraphCount++;
      if (paragraphCount <= 3) {
        visibleNodes.push(node);
      } else {
        shouldCollapse = true;
        collapsedNodes.push(node);
      }
    } else if (node.type === "heading") {
      // Headings ALWAYS trigger collapse (they make content hard to scan)
      shouldCollapse = true;
      collapsedNodes.push(node);
    } else {
      // Other non-paragraph blocks: only start collapsing if we've shown 3 paragraphs already
      if (paragraphCount >= 3) {
        shouldCollapse = true;
        collapsedNodes.push(node);
      } else {
        visibleNodes.push(node);
      }
    }
  }

  const result = [...visibleNodes];

  if (collapsedNodes.length > 0) {
    // @ts-ignore: Type compatibility between unist-builder and remark - runtime safe
    const collapsedMarkdown = remark().use(remarkGfm).stringify(
      // @ts-ignore: Type compatibility between unist-builder and remark - runtime safe
      u("root", collapsedNodes),
    ).trim();
    const hasDetailsBlocks = collapsedNodes.some((node) => {
      if (
        node.type === "html" && "value" in node &&
        typeof node.value === "string"
      ) {
        return node.value.includes("<details>");
      }
      return false;
    });

    if (hasDetailsBlocks) {
      // Don't wrap in outer details if tool uses are present (they have their own details)
      result.push(u("html", collapsedMarkdown));
    } else {
      // Wrap in "More..." details for regular content
      const summary = [u("text", "More...")];
      const detailsContent = createDetailsBlock(summary, collapsedNodes);
      result.push(...detailsContent);
    }
  }

  return result;
}

/**
 * Create tool use nodes with Claude-specific formatting
 */
export function createToolUseNodes(
  block: ContentBlock,
  result?: string,
): RootContent[] {
  const toolName = block.name || "unknown_tool";
  const nodes: RootContent[] = [];

  // Create tool summary using unified content system
  let summary = createToolSummary(toolName);

  // Add specific summaries for common Claude Code tools
  if (toolName === "TodoWrite" && block.input?.todos) {
    const todos = block.input.todos;
    const completed = todos.filter((t: Todo) =>
      t.status === "completed"
    ).length;
    const inProgress = todos.filter((t: Todo) =>
      t.status === "in_progress"
    ).length;
    const pending = todos.filter((t: Todo) => t.status === "pending").length;

    summary = createToolSummary(
      toolName,
      `Updated todo list (${completed} completed, ${inProgress} in progress, ${pending} pending)`,
    );

    // Show task summaries as formatted result (outside collapsible)
    const taskSummaries = todos.map((t: Todo) =>
      `${
        t.status === "completed"
          ? "✅"
          : t.status === "in_progress"
          ? "🔄"
          : "⏳"
      } ${t.content}`
    );
    const tasksText = `**Tasks:**\\\n${taskSummaries.join("\\\n")}`;

    const parsed = remark().use(remarkGfm).parse(tasksText);
    // @ts-ignore: Type compatibility issue with remark/unist
    nodes.push(...parsed.children);
  } else if (toolName === "Read" && block.input?.file_path) {
    const fileName = block.input.file_path.split("/").pop();
    const description = [
      u("text", "Read file "),
      u("inlineCode", fileName || ""),
    ];
    summary = createToolSummary(toolName, description);
  } else if (toolName === "Write" && block.input?.file_path) {
    const fileName = block.input.file_path.split("/").pop();
    const description = [
      u("text", "Created file "),
      u("inlineCode", fileName || ""),
    ];
    summary = createToolSummary(toolName, description);
  } else if (toolName === "Edit" && block.input?.file_path) {
    const fileName = block.input.file_path.split("/").pop();
    const description = [
      u("text", "Edited file "),
      u("inlineCode", fileName || ""),
    ];
    summary = createToolSummary(toolName, description);
  } else if (toolName === "MultiEdit" && block.input?.file_path) {
    const fileName = block.input.file_path.split("/").pop();
    const editCount = block.input.edits?.length || 0;
    const description = [
      u("text", `Made ${editCount} edits to `),
      u("inlineCode", fileName || ""),
    ];
    summary = createToolSummary(toolName, description);
  } else if (toolName === "Bash" && block.input?.command) {
    const description = [createCodeNode(block.input.command, "bash")];
    summary = createToolSummary(toolName, description);
  } else if (toolName === "Glob" && block.input?.pattern) {
    const description = [
      u("text", "Search pattern "),
      u("inlineCode", block.input.pattern),
    ];
    summary = createToolSummary(toolName, description);
  } else if (toolName === "Grep" && block.input?.pattern) {
    const description = [
      u("text", "Search for "),
      u("inlineCode", block.input.pattern),
    ];
    summary = createToolSummary(toolName, description);
  }

  // Build collapsible content
  const collapsibleParts: RootContent[] = [];

  // Add raw parameters
  if (block.input && Object.keys(block.input).length > 0) {
    collapsibleParts.push(
      u("paragraph", [u("strong", [u("text", "Parameters:")])]),
      u("code", { lang: "json" }, JSON.stringify(block.input, null, 2)),
    );
  }

  // Add result (except for Write and Edit which show openly)
  if (result) {
    if (toolName === "Write" || toolName === "Edit") {
      // Write and Edit results shown openly
      nodes.push(u("paragraph", [
        u("text", "📋 "),
        u("strong", [u("text", "Result:")]),
      ]));
      nodes.push(u("code", { lang: null }, result));
    } else {
      // All other results go in collapsible
      if (toolName === "Read") {
        collapsibleParts.push(
          u("paragraph", [u("strong", [u("text", "File Contents:")])]),
          u("code", { lang: null }, result),
        );
      } else {
        collapsibleParts.push(
          u("paragraph", [u("strong", [u("text", "Result:")])]),
          u("code", { lang: null }, result),
        );
      }
    }
  }

  // Create details/summary if there's collapsible content
  if (collapsibleParts.length > 0) {
    const detailsContent = createDetailsBlock(summary, collapsibleParts);
    nodes.unshift(...detailsContent);
  } else {
    nodes.unshift(u("html", unistToHtml(summary)));
  }

  return nodes;
}

/**
 * Create code node (inline or block) based on content
 */
function createCodeNode(content: string, language?: string): Node {
  return content.includes("\n")
    ? u("code", { lang: language || null }, content)
    : u("inlineCode", content);
}

/**
 * Create tool summary content (Claude Code specific pattern)
 */
function createToolSummary(
  toolName: string,
  description?: string | Node[],
): Node[] {
  const content: Node[] = [
    u("text", "🔧 "),
    u("strong", [u("text", toolName)]),
  ];

  if (description) {
    if (typeof description === "string") {
      content.push(u("text", `: ${description}`));
    } else {
      content.push(u("text", ": "), ...description);
    }
  }

  return content;
}

/**
 * Format timestamp in local time with timezone
 */
export function formatTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp);

  // Get local time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  // Get timezone offset
  const offsetMinutes = date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMins = Math.abs(offsetMinutes) % 60;
  const offsetSign = offsetMinutes <= 0 ? "+" : "-";
  const offsetString = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${
    String(offsetMins).padStart(2, "0")
  }`;

  return `${year}-${month}-${day} ${hours}:${minutes} ${offsetString}`;
}
