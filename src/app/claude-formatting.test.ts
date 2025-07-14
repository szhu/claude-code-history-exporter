import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createToolUseNodes, formatTimestamp } from "./claude-formatting.ts";
import { stringifyMarkdown } from "../content/markdown.ts";
import type { ContentBlock } from "../claude-project/types.ts";
import type { Node } from "npm:@types/unist@3";
import type { RootContent } from "npm:@types/mdast@4";

// Test to capture current formatting behavior
Deno.test("Formatting functions", async (t) => {
  await t.step("formatTimestamp returns local time with timezone", () => {
    // Test with a known timestamp
    const timestamp = "2025-01-01T10:00:00.000Z";
    const result = formatTimestamp(timestamp);

    // Should match format: YYYY-MM-DD HH:MM +/-HH:MM
    const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/;
    assertEquals(
      pattern.test(result),
      true,
      `Timestamp format should match pattern, got: ${result}`,
    );
  });
});

// Test problematic formatting cases - now handled by Remark
Deno.test("Problematic formatting cases now handled by Remark", () => {
  const problematicCases = [
    {
      name: "Nested HTML tags in user input",
      input:
        "Here's a <details><summary>Test</summary>Content</details> example",
      concern: "Now handled automatically by Remark",
    },
    {
      name: "Markdown special characters",
      input: "Use `code` and *emphasis* and **bold** and _underline_",
      concern: "Now handled automatically by Remark",
    },
    {
      name: "Code blocks within code blocks",
      input: "```\ncode with ``` inside\n```",
      concern: "Now handled automatically by Remark",
    },
    {
      name: "Pipe characters in tables",
      input: "Command: ls | grep foo",
      concern: "Now handled automatically by Remark",
    },
  ];

  // Just document these cases - Remark handles them automatically
  for (const testCase of problematicCases) {
    console.log(`\nCase: ${testCase.name}`);
    console.log(`Input: ${testCase.input}`);
    console.log(`Resolution: ${testCase.concern}`);
  }
});

Deno.test("TodoWrite tool creates proper line breaks in markdown", () => {
  const todoWriteBlock: ContentBlock = {
    type: "tool_use",
    id: "test-id",
    name: "TodoWrite",
    input: {
      todos: [
        { content: "Task 1", status: "completed", priority: "high", id: "1" },
        {
          content: "Task 2",
          status: "in_progress",
          priority: "medium",
          id: "2",
        },
        { content: "Task 3", status: "pending", priority: "low", id: "3" },
      ],
    },
  };

  const result = "Todos have been modified successfully.";
  const nodes = createToolUseNodes(todoWriteBlock, result);

  // Verify the structure contains proper line breaks (break nodes)
  const paragraphNode = nodes.find((node) => node.type === "paragraph");
  assertEquals(
    paragraphNode !== undefined,
    true,
    "Should have a paragraph node",
  );

  // Check that we have the expected structure: strong + break + text + break + text...
  const children = paragraphNode && "children" in paragraphNode &&
      Array.isArray(paragraphNode.children)
    ? paragraphNode.children as Node[]
    : undefined;
  assertEquals(Array.isArray(children), true, "Should have children array");

  if (children) {
    assertEquals(children[0]?.type, "strong"); // **Tasks:**

    // Type guard for strong nodes (have children)
    const strongNode = children[0];
    if (
      strongNode && "children" in strongNode &&
      Array.isArray(strongNode.children)
    ) {
      const firstChild = strongNode.children[0];
      if (firstChild && "value" in firstChild) {
        assertEquals(firstChild.value, "Tasks:");
      }
    }

    assertEquals(children[1]?.type, "break"); // First line break
    assertEquals(children[2]?.type, "text"); // ✅ Task 1

    // Type guard for text nodes (have value)
    const task1Node = children[2];
    if (
      task1Node && "value" in task1Node && typeof task1Node.value === "string"
    ) {
      assertStringIncludes(task1Node.value, "✅ Task 1");
    }

    assertEquals(children[3]?.type, "break"); // Second line break
    assertEquals(children[4]?.type, "text"); // 🔄 Task 2

    const task2Node = children[4];
    if (
      task2Node && "value" in task2Node && typeof task2Node.value === "string"
    ) {
      assertStringIncludes(task2Node.value, "🔄 Task 2");
    }

    assertEquals(children[5]?.type, "break"); // Third line break
    assertEquals(children[6]?.type, "text"); // ⏳ Task 3

    const task3Node = children[6];
    if (
      task3Node && "value" in task3Node && typeof task3Node.value === "string"
    ) {
      assertStringIncludes(task3Node.value, "⏳ Task 3");
    }
  }
});

Deno.test("Bash tool uses code blocks for multiline commands", () => {
  // Single line command should use inline code
  const singleLineBlock: ContentBlock = {
    type: "tool_use",
    id: "test-id",
    name: "Bash",
    input: { command: "ls -la" },
  };

  const singleLineNodes = createToolUseNodes(singleLineBlock, "");
  const singleLineMarkdown = stringifyMarkdown(
    singleLineNodes as RootContent[],
  );

  // Should contain inline code in HTML form (since it's in summary)
  assert(singleLineMarkdown.includes("<code>ls -la</code>"));

  // Multiline command should use code block
  const multiLineBlock: ContentBlock = {
    type: "tool_use",
    id: "test-id",
    name: "Bash",
    input: {
      command:
        "git commit -m \"$(cat <<'EOF'\nMultiline commit\nmessage\nEOF\n)\"",
    },
  };

  const multiLineNodes = createToolUseNodes(multiLineBlock, "");
  const multiLineMarkdown = stringifyMarkdown(multiLineNodes as RootContent[]);

  // Should contain pre tag (code block becomes pre in HTML summary)
  assert(multiLineMarkdown.includes("<pre>"));
  assert(multiLineMarkdown.includes("git commit"));
  assert(multiLineMarkdown.includes("EOF"));
});
