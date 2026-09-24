# p2i-gui

Local, interactive exploration of real PyTorch execution.

## Boundary

React/TypeScript Explore, Compute, Runtime and Edit views; tensor heatmaps, operation microscope and skill library. Owns the local FastAPI bridge and production frontend assets. Views consume actual observed IR and must not invent architecture semantics.

## Migration status

**Repository initialized; GUI code has not been moved yet.** The working UI lives in [PtwoI/p2i](https://github.com/PtwoI/p2i), under `frontend/` and `src/p2i/server/`. Run that project until extraction retains the single local URL, browser tests and wheel assets.

[p2i-core](https://github.com/PtwoI/p2i-core) owns the analysis and schemas. [p2i-cli](https://github.com/PtwoI/p2i-cli) launches the local server.

MIT licensed.
