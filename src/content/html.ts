/**
 * HTML generation from unist nodes using DOM APIs
 * Converts unist AST nodes to HTML strings for use in summaries
 */

import { DOMParser } from "jsr:@b-fuze/deno-dom";
import type { Literal, Node, Parent } from "npm:@types/unist@3";

// Create a shared DOM document for all HTML operations
const document = new DOMParser().parseFromString("", "text/html");

// Type guards for unist node types
function isLiteral(node: Node): node is Literal {
  return "value" in node;
}

function isParent(node: Node): node is Parent {
  return "children" in node;
}

function hasUrl(node: Node): node is Node & { url: string } {
  return "url" in node && typeof (node as { url?: unknown }).url === "string";
}

/**
 * Convert unist nodes to HTML string using DOM APIs
 * Supports basic inline elements commonly used in summaries
 */
export function unistToHtml(nodes: Node[]): string {
  const container = document.createElement("div");

  for (const node of nodes) {
    const element = nodeToElement(node);
    if (element) {
      container.appendChild(element);
    }
  }

  return container.innerHTML;
}

/**
 * Convert a single unist node to a DOM element
 */
function nodeToElement(node: Node) {
  switch (node.type) {
    case "text":
      if (isLiteral(node)) {
        return document.createTextNode(String(node.value || ""));
      }
      return null;

    case "strong": {
      const element = document.createElement("strong");
      if (isParent(node)) {
        for (const child of node.children) {
          const childElement = nodeToElement(child);
          if (childElement) {
            element.appendChild(childElement);
          }
        }
      } else if (isLiteral(node)) {
        element.textContent = String(node.value || "");
      }
      return element;
    }

    case "code":
    case "inlineCode": {
      const element = document.createElement(
        node.type === "inlineCode" ? "code" : "pre",
      );
      if (isLiteral(node)) {
        element.textContent = String(node.value || "");
      }
      return element;
    }

    case "link": {
      const element = document.createElement("a");

      if (hasUrl(node)) {
        element.setAttribute("href", node.url);
      }

      if (isParent(node)) {
        for (const child of node.children) {
          const childElement = nodeToElement(child);
          if (childElement) {
            element.appendChild(childElement);
          }
        }
      } else if (isLiteral(node)) {
        element.textContent = String(node.value || "");
      }
      return element;
    }

    default:
      throw new Error(`Unsupported unist node type: ${node.type}`);
  }
}
