#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { config as loadEnv } from "dotenv";
import { ConfluenceClient } from "./confluence/client";
import { ConfluenceConverter } from "./converter/converter";
import { ConfluenceType } from "./types";

loadEnv();

const program = new Command();

program
  .name("confluence-to-markdown")
  .description("Convert Confluence pages to clean Markdown format")
  .version("1.0.0");

program
  .command("convert")
  .description("Convert a Confluence page to Markdown")
  .requiredOption("-p, --page-id <id>", "Confluence page ID")
  .option("-u, --base-url <url>", "Confluence base URL", process.env.CONFLUENCE_BASE_URL)
  .option("--username <user>", "Confluence username", process.env.CONFLUENCE_USERNAME)
  .option("--token <token>", "API token or password", process.env.CONFLUENCE_API_TOKEN)
  .option(
    "-t, --type <type>",
    'Confluence type: "cloud" or "datacenter"',
    process.env.CONFLUENCE_TYPE || "cloud"
  )
  .option("-o, --output <file>", "Output file path (default: stdout)")
  .option("--no-front-matter", "Disable YAML front matter")
  .option("--no-children", "Exclude child page links")
  .option("--no-macros", "Skip macro conversion")
  .action(async (opts) => {
    try {
      if (!opts.baseUrl || !opts.username || !opts.token) {
        console.error(
          "Error: Missing credentials. Provide --base-url, --username, --token or set CONFLUENCE_BASE_URL, CONFLUENCE_USERNAME, CONFLUENCE_API_TOKEN environment variables."
        );
        process.exit(1);
      }

      const client = ConfluenceClient.fromCredentials(
        {
          baseUrl: opts.baseUrl,
          username: opts.username,
          apiToken: opts.token,
        },
        opts.type as ConfluenceType
      );

      const converter = new ConfluenceConverter({
        frontMatter: opts.frontMatter,
        includeChildren: opts.children,
        convertMacros: opts.macros,
      });

      console.error(`Fetching page ${opts.pageId}...`);
      const page = await client.getPage(opts.pageId);

      console.error(`Converting "${page.title}"...`);
      const result = converter.convert(page);

      if (result.warnings.length > 0) {
        console.error("Warnings:");
        for (const w of result.warnings) {
          console.error(`  - ${w}`);
        }
      }

      if (opts.output) {
        const outPath = path.resolve(opts.output);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, result.markdown, "utf-8");
        console.error(`Written to ${outPath}`);
      } else {
        process.stdout.write(result.markdown);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program
  .command("tree")
  .description("Convert a Confluence page and all its descendants")
  .requiredOption("-p, --page-id <id>", "Root page ID")
  .option("-u, --base-url <url>", "Confluence base URL", process.env.CONFLUENCE_BASE_URL)
  .option("--username <user>", "Confluence username", process.env.CONFLUENCE_USERNAME)
  .option("--token <token>", "API token or password", process.env.CONFLUENCE_API_TOKEN)
  .option(
    "-t, --type <type>",
    'Confluence type: "cloud" or "datacenter"',
    process.env.CONFLUENCE_TYPE || "cloud"
  )
  .option("-o, --output-dir <dir>", "Output directory", "./output")
  .option("-d, --depth <n>", "Max tree depth", "5")
  .option("--no-front-matter", "Disable YAML front matter")
  .action(async (opts) => {
    try {
      if (!opts.baseUrl || !opts.username || !opts.token) {
        console.error(
          "Error: Missing credentials. Set environment variables or use --base-url, --username, --token."
        );
        process.exit(1);
      }

      const client = ConfluenceClient.fromCredentials(
        {
          baseUrl: opts.baseUrl,
          username: opts.username,
          apiToken: opts.token,
        },
        opts.type as ConfluenceType
      );

      const converter = new ConfluenceConverter({
        frontMatter: opts.frontMatter,
        includeChildren: true,
        convertMacros: true,
      });

      const depth = parseInt(opts.depth, 10);
      console.error(`Fetching page tree from ${opts.pageId} (depth: ${depth})...`);
      const pages = await client.getPageTree(opts.pageId, depth);
      console.error(`Found ${pages.length} page(s).`);

      const outDir = path.resolve(opts.outputDir);
      fs.mkdirSync(outDir, { recursive: true });

      for (const page of pages) {
        const result = converter.convert(page);
        const safeName = page.title
          .replace(/[^a-zA-Z0-9_\- ]/g, "")
          .replace(/\s+/g, "-")
          .toLowerCase();
        const filePath = path.join(outDir, `${safeName}.md`);
        fs.writeFileSync(filePath, result.markdown, "utf-8");
        console.error(`  ${page.title} -> ${filePath}`);

        if (result.warnings.length > 0) {
          for (const w of result.warnings) {
            console.error(`    Warning: ${w}`);
          }
        }
      }

      console.error(`Done. ${pages.length} file(s) written to ${outDir}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program
  .command("test-connection")
  .description("Test Confluence connection")
  .option("-u, --base-url <url>", "Confluence base URL", process.env.CONFLUENCE_BASE_URL)
  .option("--username <user>", "Confluence username", process.env.CONFLUENCE_USERNAME)
  .option("--token <token>", "API token or password", process.env.CONFLUENCE_API_TOKEN)
  .option(
    "-t, --type <type>",
    'Confluence type: "cloud" or "datacenter"',
    process.env.CONFLUENCE_TYPE || "cloud"
  )
  .action(async (opts) => {
    try {
      if (!opts.baseUrl || !opts.username || !opts.token) {
        console.error("Error: Missing credentials.");
        process.exit(1);
      }

      const client = ConfluenceClient.fromCredentials(
        {
          baseUrl: opts.baseUrl,
          username: opts.username,
          apiToken: opts.token,
        },
        opts.type as ConfluenceType
      );

      console.error("Testing connection...");
      const ok = await client.testConnection();
      if (ok) {
        console.error("Connection successful!");
      } else {
        console.error("Connection failed. Check your credentials and URL.");
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program.parse();
