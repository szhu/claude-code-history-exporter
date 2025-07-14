/**
 * Generic JSONL (JSON Lines) parsing utilities
 * Can be used with any JSONL format, not specific to any application
 */

/**
 * Parse a JSONL file into an array of parsed JSON objects
 * @param filePath Path to the JSONL file
 * @param validator Optional validation function for each line
 * @returns Array of parsed objects
 */
export async function parseJsonlFile<T>(
  filePath: string,
  validator?: (obj: unknown) => T,
): Promise<T[]> {
  const content = await Deno.readTextFile(filePath);
  const lines = content.trim().split("\n").filter((line) => line.trim());
  const entries: T[] = [];

  for (const [index, line] of lines.entries()) {
    try {
      const json = JSON.parse(line);
      const entry = validator ? validator(json) : json;
      entries.push(entry);
    } catch (error) {
      console.warn(
        `Warning: Failed to parse line ${index + 1} in ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return entries;
}

/**
 * Write objects to a JSONL file
 * @param filePath Path to write the JSONL file
 * @param objects Array of objects to write
 */
export async function writeJsonlFile<T>(
  filePath: string,
  objects: T[],
): Promise<void> {
  const jsonlContent = objects.map((obj) => JSON.stringify(obj)).join("\n");
  await Deno.writeTextFile(filePath, jsonlContent);
}

/**
 * Stream through a JSONL file line by line
 * @param filePath Path to the JSONL file
 * @param processor Function to process each parsed object
 * @param validator Optional validation function for each line
 */
export async function streamJsonlFile<T>(
  filePath: string,
  processor: (entry: T, index: number) => void | Promise<void>,
  validator?: (obj: unknown) => T,
): Promise<void> {
  const content = await Deno.readTextFile(filePath);
  const lines = content.trim().split("\n").filter((line) => line.trim());

  for (const [index, line] of lines.entries()) {
    try {
      const json = JSON.parse(line);
      const entry = validator ? validator(json) : json;
      await processor(entry, index);
    } catch (error) {
      console.warn(
        `Warning: Failed to parse line ${index + 1} in ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
