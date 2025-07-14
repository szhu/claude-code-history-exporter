/**
 * Generic CLI argument parsing utilities
 * Reusable across different command-line applications
 */

import { parseArgs } from "https://deno.land/std@0.208.0/cli/parse_args.ts";

/**
 * Generic CLI options interface that can be extended by specific applications
 */
export interface BaseCliOptions {
  help?: boolean;
}

/**
 * Parse command line arguments with type safety
 * @param args Command line arguments (defaults to Deno.args)
 * @param config Parse configuration
 * @returns Parsed arguments
 */
export function parseCliArgs<T extends BaseCliOptions>(
  args: string[] = Deno.args,
  config: {
    string?: string[];
    boolean?: string[];
    collect?: string[];
    alias?: Record<string, string>;
  },
): T {
  const parsedArgs = parseArgs(args, {
    string: config.string || [],
    collect: config.collect || [],
    boolean: [...(config.boolean || []), "help"],
    alias: {
      h: "help",
      ...config.alias,
    },
  });

  return parsedArgs as T;
}

/**
 * Show help information for a CLI application
 * @param appName Name of the application
 * @param description Brief description
 * @param usage Usage string
 * @param options Array of option descriptions
 * @param examples Array of example commands
 */
export function showHelp(
  appName: string,
  description: string,
  usage: string,
  options: Array<{ flag: string; description: string }>,
  examples: Array<{ description: string; command: string }>,
) {
  console.log(`
${appName}

${description}

Usage: ${usage}

Options:`);

  for (const option of options) {
    console.log(`  ${option.flag.padEnd(25)} ${option.description}`);
  }

  console.log(`
Examples:`);

  for (const example of examples) {
    console.log(`  # ${example.description}`);
    console.log(`  ${example.command}`);
    console.log();
  }
}
