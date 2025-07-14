import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";

const testDir = "./test_data";
const testProjectDir = join(testDir, "test-project");

async function setupTestData() {
  await ensureDir(testProjectDir);

  const sampleChat1 = [
    {
      "parentUuid": null,
      "isSidechain": false,
      "userType": "external",
      "cwd": "/test/project",
      "sessionId": "test-session-1",
      "version": "1.0.0",
      "type": "user",
      "message": {
        "role": "user",
        "content": "Hello, can you help me with my code?",
      },
      "uuid": "user-1",
      "timestamp": "2025-01-01T10:00:00.000Z",
    },
    {
      "parentUuid": "user-1",
      "isSidechain": false,
      "userType": "external",
      "cwd": "/test/project",
      "sessionId": "test-session-1",
      "version": "1.0.0",
      "type": "assistant",
      "message": {
        "id": "msg_123",
        "type": "message",
        "role": "assistant",
        "model": "claude-3",
        "content": [
          {
            "type": "text",
            "text":
              "Of course! I'd be happy to help you with your code. What specific issue are you working on?",
          },
        ],
        "stop_reason": null,
        "stop_sequence": null,
        "usage": {
          "input_tokens": 10,
          "output_tokens": 20,
          "service_tier": "standard",
        },
      },
      "uuid": "assistant-1",
      "timestamp": "2025-01-01T10:01:00.000Z",
      "requestId": "req_123",
    },
  ];

  const sampleChat2 = [
    {
      "type": "summary",
      "summary": "User asked about TypeScript configuration",
      "leafUuid": "summary-1",
    },
    {
      "parentUuid": null,
      "isSidechain": false,
      "userType": "external",
      "cwd": "/test/project",
      "sessionId": "test-session-2",
      "version": "1.0.0",
      "type": "user",
      "message": {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "How do I configure TypeScript?",
          },
        ],
      },
      "uuid": "user-2",
      "timestamp": "2025-01-01T11:00:00.000Z",
      "isMeta": true,
    },
  ];

  await Deno.writeTextFile(
    join(testProjectDir, "chat1.jsonl"),
    sampleChat1.map((entry) => JSON.stringify(entry)).join("\n"),
  );

  await Deno.writeTextFile(
    join(testProjectDir, "chat2.jsonl"),
    sampleChat2.map((entry) => JSON.stringify(entry)).join("\n"),
  );
}

async function cleanupTestData() {
  try {
    await Deno.remove(testDir, { recursive: true });
  } catch {
    // Ignore if directory doesn't exist
  }
}

Deno.test("CLI exports all chats from project", async () => {
  await setupTestData();

  try {
    const outputFile = join(testDir, "output.md");

    // Run the CLI
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "src/app/cli.ts",
        testProjectDir,
        "--output",
        outputFile,
      ],
    });

    const { code, stdout: _stdout, stderr } = await command.output();

    assertEquals(
      code,
      0,
      `CLI failed with stderr: ${new TextDecoder().decode(stderr)}`,
    );

    // Check output file exists and contains expected content
    const content = await Deno.readTextFile(outputFile);

    assertStringIncludes(
      content,
      "# test-project - Claude Code History Export",
    );
    assertStringIncludes(content, "## Chat: chat1");
    assertStringIncludes(content, "## Chat: chat2");
    assertStringIncludes(content, "Hello, can you help me with my code?");
    assertStringIncludes(content, "Of course! I'd be happy to help you");
    assertStringIncludes(content, "## Summary");
    assertStringIncludes(content, "User asked about TypeScript configuration");

    // Check metadata tables are present
    assertStringIncludes(content, "| Property");
    assertStringIncludes(content, "| Session ID");
    assertStringIncludes(content, "| Total Messages");
  } finally {
    await cleanupTestData();
  }
});

Deno.test("CLI exports single chat file", async () => {
  await setupTestData();

  try {
    const outputFile = join(testDir, "single-chat-output.md");
    const chatFile = join(testProjectDir, "chat1.jsonl");

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "src/app/cli.ts",
        chatFile,
        "--output",
        outputFile,
      ],
    });

    const { code } = await command.output();
    assertEquals(code, 0);

    const content = await Deno.readTextFile(outputFile);

    assertStringIncludes(content, "# chat1 - Claude Code Chat Export");
    assertStringIncludes(content, "Hello, can you help me with my code?");
    // Should not include chat2 content
    assertEquals(content.includes("TypeScript configuration"), false);
  } finally {
    await cleanupTestData();
  }
});

Deno.test("CLI includes timestamps as headings for user messages", async () => {
  await setupTestData();

  try {
    const outputFile = join(testDir, "timestamp-output.md");

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "src/app/cli.ts",
        testProjectDir,
        "--output",
        outputFile,
      ],
    });

    const { code } = await command.output();
    assertEquals(code, 0);

    const content = await Deno.readTextFile(outputFile);

    // Should include timestamp headings (local format with timezone)
    assertStringIncludes(content, "### 2025-01-01 05:0");
  } finally {
    await cleanupTestData();
  }
});

Deno.test("CLI shows help when requested", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "src/app/cli.ts",
      "--help",
    ],
  });

  const { code, stdout } = await command.output();
  const output = new TextDecoder().decode(stdout);

  assertEquals(code, 0);
  assertStringIncludes(output, "Claude Code History Exporter");
  assertStringIncludes(output, "Usage:");
  assertStringIncludes(output, "<input>");
});

Deno.test("CLI handles invalid project path", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "src/app/cli.ts",
      "/nonexistent/path",
    ],
  });

  const { code, stderr } = await command.output();
  const errorOutput = new TextDecoder().decode(stderr);

  assertEquals(code, 1);
  assertStringIncludes(errorOutput, "Project directory not found");
});
