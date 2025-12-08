# GraphQL Cascade Diagrams

This directory contains the visual diagrams used in the project's README.

## Files

- `*.mmd` - Mermaid diagram source files
- `*.png` - Rendered PNG images used in README.md

## Regenerating Diagrams

To regenerate all diagrams from source:

```bash
pnpm run diagrams
```

This command uses `mermaid-cli` to render all `.mmd` files to PNG format.

## Editing Diagrams

1. Edit the `.mmd` source files
2. Run `pnpm run diagrams` to regenerate PNGs
3. Commit both the `.mmd` source and `.png` output files

## Dependencies

- `@mermaid-js/mermaid-cli` (system-installed at `/usr/bin/mmdc`)
- Chromium browser (configured in `puppeteer-config.json`)
