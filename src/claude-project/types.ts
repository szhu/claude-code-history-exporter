import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ContentBlockSchema = z.object({
  type: z.enum(["text", "tool_use", "tool_result", "thinking"]),
  text: z.string().optional(),
  thinking: z.string().optional(),
  signature: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.any().optional(),
  tool_use_id: z.string().optional(),
  content: z.union([z.string(), z.array(z.any())]).optional(),
});

const UsageSchema = z.object({
  input_tokens: z.number(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  output_tokens: z.number(),
  service_tier: z.string().nullable().optional(),
});

const UserMessageSchema = z.object({
  role: z.literal("user"),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
});

const AssistantMessageSchema = z.object({
  id: z.string(),
  type: z.literal("message"),
  role: z.literal("assistant"),
  model: z.string(),
  content: z.array(ContentBlockSchema),
  stop_reason: z.string().nullable(),
  stop_sequence: z.string().nullable(),
  usage: UsageSchema,
});

const SystemMessageSchema = z.object({
  parentUuid: z.string().nullable(),
  isSidechain: z.boolean(),
  userType: z.literal("external"),
  cwd: z.string(),
  sessionId: z.string(),
  version: z.string(),
  type: z.literal("system"),
  content: z.string(),
  uuid: z.string(),
  timestamp: z.string(),
  isMeta: z.boolean().optional(),
  level: z.string().optional(),
});

const ChatMessageSchema = z.object({
  parentUuid: z.string().nullable(),
  isSidechain: z.boolean(),
  userType: z.literal("external"),
  cwd: z.string(),
  sessionId: z.string(),
  version: z.string(),
  type: z.enum(["user", "assistant"]),
  message: z.union([UserMessageSchema, AssistantMessageSchema]),
  uuid: z.string(),
  timestamp: z.string(),
  isMeta: z.boolean().optional(),
  requestId: z.string().optional(),
  toolUseResult: z.any().optional(),
});

const SummaryMessageSchema = z.object({
  type: z.literal("summary"),
  summary: z.string(),
  leafUuid: z.string(),
});

export const ChatEntrySchema = z.union([
  ChatMessageSchema,
  SystemMessageSchema,
  SummaryMessageSchema,
]);

export const ProjectExportOptionsSchema = z.object({
  projectPath: z.string(),
  outputPath: z.string().optional(),
  chatIds: z.array(z.string()).optional(),
  includeTimestamps: z.boolean().optional(),
  includeMeta: z.boolean().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type SystemMessage = z.infer<typeof SystemMessageSchema>;
export type UserMessage = z.infer<typeof UserMessageSchema>;
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type SummaryMessage = z.infer<typeof SummaryMessageSchema>;
export type ChatEntry = z.infer<typeof ChatEntrySchema>;
export type ProjectExportOptions = z.infer<typeof ProjectExportOptionsSchema>;
