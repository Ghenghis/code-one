# Research Note: KiloCode

**Source:** github.com/kilocode (Roo Code / Cline lineage)  
**Date reviewed:** 2026-04-14

## What pattern it proves

Mode-based agent systems with configurable tool permission sets provide clean separation between autonomous and human-controlled workflows. Custom modes as JSON configuration enable extensibility without code changes.

## Why it matters

- Multiple built-in modes (Code, Architect, Ask, Debug) each with different tool access levels
- Custom modes defined as JSON: slug, name, tool allowlist, system prompt override
- User approval by default with configurable auto-approval per tool category
- XML-style tool calls parsed from LLM output (structured but flexible)
- `.kilocoderules` file provides persistent project-level instructions

## How we adapt it

### Mode System (Agent Core, Tier 4)
Built-in modes with tool permission sets:
- **Ask**: No tools, conversational Q&A only
- **Architect**: Read-only tools, produces plans
- **Code**: Full read/write, approval required for writes
- **Debug**: Read + terminal, approval for edits
- **Agent**: Full autonomy with approval gates

### Custom Modes
Users define custom modes in `.hybrid-ide/modes.json`:
```json
{
  "slug": "reviewer",
  "name": "Code Reviewer",
  "tools": ["read_file", "search_content"],
  "autoApprove": ["read_file", "search_content"],
  "systemPrompt": "Review code for quality and security."
}
```

### Permission Model
Three layers:
1. Mode defines available tools
2. Auto-approve rules per tool
3. Programmable hooks for runtime decisions

### Project Rules
`.hybridrules` file (our equivalent of `.kilocoderules`) injects persistent project-level instructions into the system prompt.

## What we will not copy

- **XML-style tool call format**: We use standard function calling / tool_use format from the LLM provider API
- **VS Code extension architecture**: We're building a standalone Electron app
- **Flat permission model**: We add programmable hooks as a third permission layer (from Claude Code)

## Risks

- Mode switching mid-conversation needs careful context handling
- Custom modes could grant excessive permissions if not validated

## Validation checklist

- [ ] Each built-in mode correctly restricts tool access
- [ ] Custom modes load from config and apply correctly
- [ ] Auto-approve and require-approval rules work per tool
- [ ] Mode switch preserves conversation context
- [ ] .hybridrules file loads and injects into system prompt
