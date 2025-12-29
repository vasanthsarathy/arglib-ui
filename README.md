# ArgLib UI

Frontend app for authoring argument graphs and running analyses.

## Goals
- Graph editor + visualization (Cytoscape.js or similar).
- Evidence cards + supporting documents panel.
- Run diagnostics, credibility, critique, and mining workflows.

## Notes
This scaffold uses Vite + React (dependencies included in `package.json`).
Run `npm install` (or `pnpm install`) and `npm run dev` to start the UI.

## API types
Generate client types from the server OpenAPI spec:
```bash
npm run gen:api
```
