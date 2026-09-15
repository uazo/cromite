import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PATCH_CACHE_DB_PREFIX = "tools/gerrit/cache/patches";
const PATCH_CACHE_DIRECTORY = path.join(__dirname, "cache", "patches");

export type ParsedDiffFile = {
  oldPath: string | null;
  newPath: string;
  changeType: string | null;
  addedLines: Array<{
    oldLineNumber: number | null;
    newLineNumber: number | null;
    text: string;
  }>;
  addedCount: number;
  removedCount: number;
};

export type ParsedDiff = {
  files: ParsedDiffFile[];
  addedLines: number;
  removedLines: number;
};

export function extractDiffFilePaths(diffText: string): string[] {
  const filePaths = new Set<string>();

  for (const line of diffText.split(/\r?\n/)) {
    const diffHeader = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (diffHeader) {
      filePaths.add(diffHeader[1]);
      filePaths.add(diffHeader[2]);
      continue;
    }

    const oldPath = /^(?:rename|copy) from (.+)$/.exec(line);
    if (oldPath) {
      filePaths.add(oldPath[1]);
      continue;
    }

    const newPath = /^(?:rename|copy) to (.+)$/.exec(line);
    if (newPath) {
      filePaths.add(newPath[1]);
    }
  }

  return [...filePaths];
}
export function trimAddedText(value: string): string {
  return value.length <= 1000 ? value : value.slice(0, 1000);
}

export function getPatchCacheRelativePath(changeNumber: number, revisionNumber: number): string {
  const shard = String(changeNumber).slice(0, 2).padStart(2, "0");
  return path.posix.join(
    PATCH_CACHE_DB_PREFIX,
    shard,
    `${changeNumber}.${revisionNumber}.patch.diff`,
  );
}

export function isPatchCacheRelativePath(relativePath: string): boolean {
  return /^tools[\\/]gerrit[\\/]cache[\\/]patches[\\/]\d{2}[\\/]\d+\.\d+\.patch\.diff$/.test(
    relativePath,
  );
}
export function getPatchCacheAbsolutePath(relativePath: string): string {
  if (!isPatchCacheRelativePath(relativePath)) {
    throw new Error(`Invalid Gerrit patch cache path: ${relativePath}`);
  }
  const normalized = relativePath.replace(/\\/g, "/");
  const prefix = "tools/gerrit/cache/patches/";
  return path.join(PATCH_CACHE_DIRECTORY, normalized.slice(prefix.length));
}

export async function writeDiffCache(
  changeNumber: number,
  revisionNumber: number,
  diffText: string,
): Promise<string> {
  const relativePath = getPatchCacheRelativePath(changeNumber, revisionNumber);
  const absolutePath = getPatchCacheAbsolutePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, diffText, "utf8");
  return relativePath;
}

export async function readDiffCache(relativePath: string): Promise<string> {
  return readFile(getPatchCacheAbsolutePath(relativePath), "utf8");
}

export async function diffCacheExists(relativePath: string): Promise<boolean> {
  try {
    await access(getPatchCacheAbsolutePath(relativePath));
    return true;
  } catch {
    return false;
  }
}

function parseHunkHeader(line: string): { oldLine: number; newLine: number } | null {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
  if (!match) {
    return null;
  }
  return {
    oldLine: Number(match[1]),
    newLine: Number(match[2]),
  };
}

function normalizeDiffPath(value: string): string | null {
  if (value === "/dev/null") {
    return null;
  }
  return value.replace(/^[ab]\//, "");
}

export function parseDiff(diffText: string): ParsedDiff {
  const files: ParsedDiffFile[] = [];
  let currentFile: ParsedDiffFile | null = null;
  let oldLineNumber: number | null = null;
  let newLineNumber: number | null = null;

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      currentFile = {
        oldPath: match ? match[1] : null,
        newPath: match ? match[2] : "unknown",
        changeType: null,
        addedLines: [],
        addedCount: 0,
        removedCount: 0,
      };
      files.push(currentFile);
      oldLineNumber = null;
      newLineNumber = null;
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("new file mode")) {
      currentFile.changeType = "added";
      continue;
    }
    if (line.startsWith("deleted file mode")) {
      currentFile.changeType = "deleted";
      continue;
    }
    if (line.startsWith("rename from ")) {
      currentFile.changeType = "renamed";
      currentFile.oldPath = line.slice("rename from ".length);
      continue;
    }
    if (line.startsWith("rename to ")) {
      currentFile.changeType = "renamed";
      currentFile.newPath = line.slice("rename to ".length);
      continue;
    }
    if (line.startsWith("--- ")) {
      currentFile.oldPath = normalizeDiffPath(line.slice(4).trim());
      continue;
    }
    if (line.startsWith("+++ ")) {
      currentFile.newPath = normalizeDiffPath(line.slice(4).trim()) ?? currentFile.newPath;
      continue;
    }

    const hunk = parseHunkHeader(line);
    if (hunk) {
      oldLineNumber = hunk.oldLine;
      newLineNumber = hunk.newLine;
      continue;
    }

    if (oldLineNumber === null || newLineNumber === null) {
      continue;
    }

    if (line.startsWith("+")) {
      currentFile.addedLines.push({
        oldLineNumber: null,
        newLineNumber,
        text: line.slice(1),
      });
      currentFile.addedCount += 1;
      newLineNumber += 1;
      continue;
    }

    if (line.startsWith("-")) {
      currentFile.removedCount += 1;
      oldLineNumber += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      oldLineNumber += 1;
      newLineNumber += 1;
    }
  }

  return {
    files,
    addedLines: files.reduce((sum, file) => sum + file.addedCount, 0),
    removedLines: files.reduce((sum, file) => sum + file.removedCount, 0),
  };
}

