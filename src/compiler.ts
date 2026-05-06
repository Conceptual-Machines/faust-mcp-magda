import * as path from "path";
import { fileURLToPath } from "url";
// The @grame/faustwasm package has a broken "main" pointing to CJS,
// so we import from the ESM dist directly.
import {
  instantiateFaustModuleFromFile,
  LibFaust,
  FaustCompiler,
  FaustMonoDspGenerator,
  type FaustDspMeta,
} from "@grame/faustwasm/dist/esm/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let compiler: FaustCompiler | null = null;
let compilerFS: typeof FS | null = null;

export async function ensureCompiler(): Promise<FaustCompiler> {
  if (compiler) return compiler;

  const jsFile = path.join(
    __dirname,
    "../node_modules/@grame/faustwasm/libfaust-wasm/libfaust-wasm.js"
  );
  const faustModule = await instantiateFaustModuleFromFile(jsFile);
  const libFaust = new LibFaust(faustModule);
  compiler = new FaustCompiler(libFaust);
  compilerFS = compiler.fs();
  return compiler;
}

export function getCompilerFS(): typeof FS | null {
  return compilerFS;
}

export interface CompileResult {
  success: true;
  metadata: FaustDspMeta;
}

export interface CompileError {
  success: false;
  error: string;
}

export async function compileFaust(
  code: string,
  name: string = "FaustDSP",
  args: string[] = []
): Promise<CompileResult | CompileError> {
  const c = await ensureCompiler();
  const generator = new FaustMonoDspGenerator();

  const allArgs = ["-ftz", "2", ...args].join(" ");

  try {
    const result = await generator.compile(c, name, code, allArgs);
    if (!result) {
      return { success: false, error: c.getErrorMessage() || "Compilation failed" };
    }

    const jsonStr = generator.getJSON();
    if (!jsonStr) {
      return { success: false, error: "Compilation produced no metadata" };
    }

    const metadata: FaustDspMeta = JSON.parse(jsonStr);
    return { success: true, metadata };
  } catch (e: any) {
    const errorMsg = c.getErrorMessage() || e.message || "Unknown compilation error";
    return { success: false, error: errorMsg };
  }
}

export function getCompilerVersion(): string | null {
  return compiler?.version() ?? null;
}
