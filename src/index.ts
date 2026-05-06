#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { compileFaust, ensureCompiler, getCompilerVersion } from "./compiler.js";
import {
  searchLibraries,
  getLibraryContent,
  listLibraries,
} from "./library-index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RESOURCES = {
  "magda-conventions": {
    uri: "faust://magda-conventions",
    name: "MAGDA Faust Conventions",
    description:
      "Parameter metadata annotations, slot indexing, I/O conventions, and best practices for writing Faust DSP code targeting MAGDA",
    file: path.join(__dirname, "../docs/magda-conventions.md"),
  },
};

class FaustMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "faust-mcp-magda", version: "0.1.0" },
      { capabilities: { resources: {}, tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: Object.values(RESOURCES).map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: "text/markdown",
      })),
    }));

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const resource = Object.values(RESOURCES).find(
          (r) => r.uri === request.params.uri
        );
        if (!resource) throw new Error(`Resource not found: ${request.params.uri}`);
        if (!fs.existsSync(resource.file))
          throw new Error(`Resource file not found: ${resource.file}`);

        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: "text/markdown",
              text: fs.readFileSync(resource.file, "utf-8"),
            },
          ],
        };
      }
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "compile_faust",
          description:
            "Compile Faust DSP code and return structured metadata (parameters, I/O, UI layout) on success, or compilation errors on failure",
          inputSchema: {
            type: "object" as const,
            properties: {
              code: {
                type: "string",
                description: "Faust DSP source code",
              },
              name: {
                type: "string",
                description: "Name for the DSP module (default: FaustDSP)",
              },
              args: {
                type: "array",
                items: { type: "string" },
                description:
                  "Additional Faust compiler arguments (e.g. [\"-vec\"])",
              },
            },
            required: ["code"],
          },
        },
        {
          name: "search_faust_libraries",
          description:
            "Search the Faust standard library for functions by name or keyword",
          inputSchema: {
            type: "object" as const,
            properties: {
              query: {
                type: "string",
                description:
                  "Search query (function name, library name, or keyword)",
              },
              limit: {
                type: "number",
                description: "Maximum results to return (default: 20)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "get_faust_library",
          description:
            "Get the source code of a Faust standard library file (e.g. filters, envelopes, oscillators)",
          inputSchema: {
            type: "object" as const,
            properties: {
              library: {
                type: "string",
                description:
                  'Library name, with or without .lib extension (e.g. "filters", "envelopes.lib")',
              },
            },
            required: ["library"],
          },
        },
        {
          name: "list_faust_libraries",
          description:
            "List all available Faust standard libraries",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "compile_faust": {
            const { code, name: dspName, args: compilerArgs } = args as {
              code: string;
              name?: string;
              args?: string[];
            };

            await ensureCompiler();
            const result = await compileFaust(
              code,
              dspName || "FaustDSP",
              compilerArgs || []
            );

            if (result.success) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(result.metadata, null, 2),
                  },
                ],
              };
            } else {
              return {
                content: [
                  { type: "text" as const, text: `Compilation error: ${result.error}` },
                ],
                isError: true,
              };
            }
          }

          case "search_faust_libraries": {
            const { query, limit } = args as {
              query: string;
              limit?: number;
            };
            const results = await searchLibraries(query, limit);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          case "get_faust_library": {
            const { library } = args as { library: string };
            const content = await getLibraryContent(library);
            if (!content) {
              const available = await listLibraries();
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Library "${library}" not found. Available: ${available.join(", ")}`,
                  },
                ],
                isError: true,
              };
            }
            return {
              content: [{ type: "text" as const, text: content }],
            };
          }

          case "list_faust_libraries": {
            const libs = await listLibraries();
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(libs, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(
      `Faust MCP server running (compiler: ${getCompilerVersion() || "loading..."})`
    );
  }
}

const server = new FaustMCPServer();
server.run().catch(console.error);
