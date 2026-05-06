import { ensureCompiler, getCompilerFS } from "./compiler.js";

interface LibraryEntry {
  name: string;
  library: string;
  signature: string;
  description: string;
}

let index: LibraryEntry[] | null = null;

function parseLibFile(filename: string, content: string): LibraryEntry[] {
  const entries: LibraryEntry[] = [];
  const lines = content.split("\n");
  const lib = filename.replace(/\.lib$/, "");

  let pendingDoc: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Collect doc comments (lines starting with //)
    const docMatch = line.match(/^\s*\/\/\s*(.*)$/);
    if (docMatch) {
      pendingDoc.push(docMatch[1].trim());
      continue;
    }

    // Match function definitions: name = ...  or  name(args) = ...
    const funcMatch = line.match(
      /^(\w[\w.]*)\s*(\([^)]*\))?\s*=\s*/
    );
    if (funcMatch) {
      const name = funcMatch[1];
      const params = funcMatch[2] || "";

      // Skip internal/private names (starting with underscore or single chars)
      if (name.startsWith("_") || name.length <= 1) {
        pendingDoc = [];
        continue;
      }

      const description = pendingDoc
        .filter((l) => l.length > 0)
        .join(" ")
        .replace(/^[-=]+$/, "")
        .trim();

      entries.push({
        name,
        library: lib,
        signature: `${name}${params}`,
        description: description || `Function from ${lib}.lib`,
      });

      pendingDoc = [];
      continue;
    }

    // Non-comment, non-function line — reset pending doc
    if (line.trim().length > 0 && !docMatch) {
      pendingDoc = [];
    }
  }

  return entries;
}

async function buildIndex(): Promise<LibraryEntry[]> {
  if (index) return index;

  await ensureCompiler();
  const fs = getCompilerFS();
  if (!fs) throw new Error("Compiler filesystem not available");

  index = [];
  const libDirs = ["/usr/share/faust", "/usr/local/share/faust"];

  for (const dir of libDirs) {
    let files: string[];
    try {
      files = fs.readdir(dir) as string[];
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".lib")) continue;
      try {
        const content = fs.readFile(`${dir}/${file}`, {
          encoding: "utf8",
        }) as string;
        const entries = parseLibFile(file, content);
        index.push(...entries);
      } catch {
        // skip unreadable files
      }
    }
  }

  return index;
}

export async function searchLibraries(
  query: string,
  limit: number = 20
): Promise<LibraryEntry[]> {
  const entries = await buildIndex();
  const q = query.toLowerCase();

  const scored = entries
    .map((entry) => {
      let score = 0;
      const nameLower = entry.name.toLowerCase();
      const descLower = entry.description.toLowerCase();
      const libLower = entry.library.toLowerCase();

      if (nameLower === q) score += 100;
      else if (nameLower.startsWith(q)) score += 50;
      else if (nameLower.includes(q)) score += 30;

      if (libLower.includes(q)) score += 20;
      if (descLower.includes(q)) score += 10;

      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.entry);
}

export async function getLibraryContent(
  library: string
): Promise<string | null> {
  await ensureCompiler();
  const fs = getCompilerFS();
  if (!fs) return null;

  const libName = library.endsWith(".lib") ? library : `${library}.lib`;
  const libDirs = ["/usr/share/faust", "/usr/local/share/faust"];

  for (const dir of libDirs) {
    try {
      return fs.readFile(`${dir}/${libName}`, {
        encoding: "utf8",
      }) as string;
    } catch {
      continue;
    }
  }

  return null;
}

export async function listLibraries(): Promise<string[]> {
  await ensureCompiler();
  const fs = getCompilerFS();
  if (!fs) return [];

  const libs: string[] = [];
  const libDirs = ["/usr/share/faust", "/usr/local/share/faust"];

  for (const dir of libDirs) {
    try {
      const files = fs.readdir(dir) as string[];
      for (const f of files) {
        if (f.endsWith(".lib")) libs.push(f.replace(/\.lib$/, ""));
      }
    } catch {
      continue;
    }
  }

  return [...new Set(libs)].sort();
}
