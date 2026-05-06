# faust-mcp-magda

MCP server that gives AI assistants access to the [Faust](https://faust.grame.fr/) DSP compiler and standard library. Built as a companion tool for [MAGDA](https://github.com/Conceptual-Machines/magda-core).

The Faust compiler runs entirely in-process via WebAssembly — no external Faust installation required.

## Install

```bash
git clone https://github.com/Conceptual-Machines/faust-mcp-magda.git
cd faust-mcp-magda
npm install
npm run build
```

## Configure

Add to your MCP client config (e.g. `.claude/settings.json`, `mcp.json`, or Claude Desktop config):

```json
{
  "mcpServers": {
    "faust-mcp-magda": {
      "command": "node",
      "args": ["/path/to/faust-mcp-magda/dist/index.js"]
    }
  }
}
```

## Tools

### `compile_faust`

Compile Faust DSP code and get structured metadata (parameters, I/O count, UI layout) on success, or compilation errors on failure.

```json
{ "code": "process = +;", "name": "MyDSP", "args": ["-vec"] }
```

### `search_faust_libraries`

Search the Faust standard library for functions by name or keyword.

```json
{ "query": "lowpass", "limit": 5 }
```

### `get_faust_library`

Read the source of a Faust standard library file.

```json
{ "library": "filters" }
```

### `list_faust_libraries`

List all available Faust standard libraries.

## Resources

### `faust://magda-conventions`

MAGDA-specific Faust conventions: parameter metadata annotations (`[idx:N]`, `[unit:Hz]`, `[scale:log]`, `[style:menu{...}]`), the 64-slot parameter pool, and I/O conventions.

## Development

```bash
npm run dev    # run with tsx (no build step)
npm run build  # compile TypeScript
npm start      # run compiled server
```
