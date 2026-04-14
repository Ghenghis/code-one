# Research Note: Aider

**Source:** github.com/paul-gauthier/aider  
**Date reviewed:** 2026-04-14

## What pattern it proves

Tree-sitter + PageRank repo maps give LLMs effective codebase awareness without sending full files. Multi-model strategies (primary/editor/utility) optimize cost and quality. Polymorphic edit formats adapt to different model capabilities.

## Why it matters

- Repo map is the highest-value context assembly technique: ranked file/symbol signatures instead of raw file dumps
- Architect mode (two-model pipeline) separates planning from execution
- SEARCH/REPLACE edit blocks with fuzzy matching are more reliable than whole-file rewrites
- Multi-model routing optimizes cost: strong model plans, cheap model edits, tiny model summarizes

## How we adapt it

### Repo Map (Context Engine, Tier 3)

- Tree-sitter parses all project files, extracts symbol tags via language-specific queries
- Build dependency graph of definitions and references across files
- PageRank ranks files/symbols by relevance to current context (seeded by open files)
- Produce condensed listing of ranked files with key signatures
- Dynamically size to fit within token budget

### Multi-Model Strategy (AI Gateway, Tier 2)

- **Primary model**: Main conversation, planning, complex reasoning
- **Editor model**: Generates edit blocks from architect plans (cheaper/faster)
- **Utility model**: Commit messages, summaries, embeddings (cheapest)

### Edit Format System (Agent Core, Tier 4)

- SearchReplace: SEARCH/REPLACE blocks with fuzzy matching (default)
- WholeFile: Full file replacement for new files
- UnifiedDiff: Standard diff format
- Modular engine — strategies coexist, selected by model capability

### Git Integration

- Auto-generated commit suggestions (human-reviewable)
- Dirty file detection before editing
- Scoped commit messages with traceability

## What we will not copy

- **No branch-per-task by default**: We want branch-per-task as an option (from our blueprint)
- **litellm dependency**: We build our own provider adapter layer for tighter control
- **Conversation-driven REPL**: Our agent loop is event-driven, not REPL-based

## Risks

- Tree-sitter parsing can be slow on very large repos (need async/incremental)
- PageRank quality depends on good symbol extraction queries per language

## Validation checklist

- [ ] Repo map generates correctly for a multi-file project
- [ ] PageRank produces sensible relevance rankings
- [ ] SEARCH/REPLACE edits apply correctly with fuzzy matching
- [ ] Edit format selection adapts to model capability
