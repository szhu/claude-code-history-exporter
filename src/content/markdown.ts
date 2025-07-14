/**
 * Basic markdown processing utilities using Remark
 * Generic functions for parsing and manipulating markdown AST
 */

import { remark } from "npm:remark@15";
import remarkGfm from "npm:remark-gfm@4";
import { u } from "npm:unist-builder@4";
import { unistToHtml } from "./html.ts";
import type { Node } from "npm:@types/unist@3";
import type { AlignType, RootContent } from "npm:@types/mdast@4";

/**
 * Create a details/summary block as unist nodes
 */
export function createDetailsBlock(
  summary: Node[],
  contentNodes: RootContent[],
): RootContent[] {
  // Convert Node summary to HTML string for the summary tag
  const summaryHtml = unistToHtml(summary);

  // Convert content nodes to markdown
  const contentMarkdown = stringifyMarkdown(contentNodes);

  // Create the complete details block as raw HTML
  const detailsHtml =
    `<details><summary>${summaryHtml}</summary>\n\n${contentMarkdown}\n\n</details>`;

  return [u("html", detailsHtml)];
}

/**
 * Parse markdown string to AST nodes
 */
export function parseMarkdown(content: string): RootContent[] {
  const parsed = remark().use(remarkGfm).parse(content);
  return parsed.children as RootContent[];
}

/**
 * Convert AST nodes to markdown string
 */
export function stringifyMarkdown(nodes: RootContent[]): string {
  const ast = u("root", nodes);
  // @ts-ignore: Type compatibility between unist-builder and remark - runtime safe
  return remark().use(remarkGfm).stringify(ast);
}

/**
 * Create metadata table nodes from key-value pairs
 */
export function createMetadataTableNodes(
  metadata: Record<string, string>,
): RootContent[] {
  if (Object.keys(metadata).length === 0) return [];

  const rows = Object.entries(metadata).map(([key, value]) =>
    u("tableRow", [
      u("tableCell", [u("text", key)]),
      u("tableCell", [u("text", value)]),
    ])
  );

  const headerRow = u("tableRow", [
    u("tableCell", [u("text", "Property")]),
    u("tableCell", [u("text", "Value")]),
  ]);

  return [
    u("table", { align: ["left", "left"] as AlignType[] }, [
      headerRow,
      ...rows,
    ]),
  ];
}

/**
 * Create blockquote node
 */
export function createBlockquote(children: Node[]): Node {
  return u("blockquote", children);
}
