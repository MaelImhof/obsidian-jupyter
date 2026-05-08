/**
 * This script checks for broken documentation links in the source code,
 * GitHub workflow files, and root markdown files such as README.md and
 * SECURITY.md.
 * 
 * It looks for links that point to the documentation site
 * (https://jupyter.mael.im) and verifies that the corresponding markdown
 * files exist in the local "docs" directory. If any broken links are found,
 * it reports them with the filename, line number, the URL, and the expected
 * file path that should exist in the "docs" directory.
 * 
 * Usage:
 *   tsx scripts/check-links.ts
 *   npm run check-links
 * 
 * The script will exit with a non-zero status code if any broken links are
 * found, making it suitable for use in CI pipelines to ensure documentation
 * links remain valid.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";

const DOCS_URL = "https://jupyter.mael.im";
const DOCS_DIR = resolve(__dirname, "..", "docs");

interface BrokenLink {
  file: string;
  line: number;
  url: string;
  expectedPath: string;
}

/** List existing files with the given extensions in the given directory. */
function findFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      files.push(...findFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Converts a documentation URL path of the form
 * 
 * https://jupyter.mael.im/path/to/doc to the corresponding local file path
 */
function urlToDocsPath(urlPath: string): string {
  const path = urlPath.split("#")[0];

  // If the path ends with a slash, it corresponds to an index.md file in
  // that directory
  // (e.g. https://jupyter.mael.im/guide/ -> docs/guide/index.md)
  if (path.endsWith("/")) {
    return join(DOCS_DIR, path.slice(1), "index.md");
  }

  // Otherwise, it corresponds to a markdown file with the same name
  // (e.g. https://jupyter.mael.im/guide/usage -> docs/guide/usage.md)
  return join(DOCS_DIR, path.slice(1)) + ".md";
}

/** Check if a file exists at the given path. */
function fileExists(filePath: string): boolean {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check a file's content for documentation links, and for each of them
 * check if it is broken.
 */
function checkFile(filePath: string): BrokenLink[] {
  const content = readFileSync(filePath, "utf-8");
  // Assume a link is always on a single line for simplicity, I don't think
  // I would ever split a link across multiple lines anyway
  const lines = content.split("\n");
  const broken: BrokenLink[] = [];

  // Escape special regex characters from the DOCS_URL constant
  const escapedUrl = DOCS_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkRegex = new RegExp(`(${escapedUrl}/[^\\s"')]+)`, "g");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;

    linkRegex.lastIndex = 0;
    while ((match = linkRegex.exec(line)) !== null) {
      const url = match[1];
      const urlPath = url.replace(/https?:\/\/jupyter\.mael\.im/, "");
      const docsPath = urlToDocsPath(urlPath);

      if (!fileExists(docsPath)) {
        broken.push({
          file: relative(process.cwd(), filePath),
          line: i + 1,
          url,
          expectedPath: relative(process.cwd(), docsPath),
        });
      }
    }
  }

  return broken;
}

function main() {
  const filesToCheck: string[] = [];

  const rootFiles = ["README.md", "SECURITY.md"];
  for (const file of rootFiles) {
    try {
      statSync(resolve(__dirname, "..", file));
      filesToCheck.push(resolve(__dirname, "..", file));
    } catch {
      // File does not exist, skip
    }
  }

  filesToCheck.push(...findFiles(resolve(__dirname, "..", "src"), [".ts"]));
  filesToCheck.push(...findFiles(resolve(__dirname, "..", ".github"), [".yml", ".yaml"]));

  const allBroken: BrokenLink[] = [];

  for (const file of filesToCheck) {
    allBroken.push(...checkFile(file));
  }

  if (allBroken.length > 0) {
    console.error("Found broken documentation links:\n");
    for (const broken of allBroken) {
      console.error(`  ${broken.file}:${broken.line}`);
      console.error(`    Link: ${broken.url}`);
      console.error(`    Expected file: ${broken.expectedPath}\n`);
    }
    console.error(`${allBroken.length} broken link(s) found.`);
    process.exit(1);
  }

  console.log("All documentation links are valid.");
}

main();
