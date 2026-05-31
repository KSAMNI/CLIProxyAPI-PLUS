# Coding Conventions

## Formatting (verifiable)
- Indentation: follow the file's native style; prefer 2 spaces in JSON, markdown, TSX, and shell snippets.
- Formatter: run the repo's documented formatter/build commands before committing changes.
- Linter: the documented build/type-check commands must pass for touched areas.

## Naming
- Files: use descriptive, kebab-case or upstream-matching names.
- Variables/functions: use descriptive camelCase or upstream conventions already present in the file.
- Constants: use UPPER_SNAKE_CASE where the file already follows that pattern.

## File structure
- Keep files focused; split if a file starts mixing patching, UI, and data logic.
- Import order: external packages first, then internal modules, then relative imports.

## General rules
- No dead code or unused imports.
- Comments must match the existing codebase's language.
- Prefer minimal edits that preserve upstream compatibility.
