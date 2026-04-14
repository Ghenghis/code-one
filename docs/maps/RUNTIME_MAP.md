# Runtime Map

Execution flows — what actually happens when something runs.
Last updated: 2026-04-14

## Flow 1: User Sends a Chat Message

```
User types in Chat Panel
  → ChatPanel.onSubmit()
  → AgentRunner.run(message, mode)
  → ContextAssembler.build()
      ├── Load system prompt (mode-specific)
      ├── Load .hybridrules
      ├── Generate repo map (Tree-sitter + PageRank)
      ├── Include active files
      ├── RAG retrieve relevant files
      ├── Load session memory
      ├── Load persistent memory
      ├── Check token budget, compress if needed
      └── Return assembled context
  → AIGateway.stream(context)
      ├── Select provider adapter
      ├── Send HTTP request
      └── Stream response chunks
  → Parse response
      ├── Text → emit AssistantMessageEvent → update Chat Panel
      ├── Tool call → check permissions
      │     ├── Auto-approved → execute tool
      │     ├── Needs approval → show ApprovalDialog
      │     └── Denied → tell LLM
      └── Loop until no more tool calls
  → Emit completion event
```

## Flow 2: Agent Executes a Tool

```
AgentRunner detects tool call in LLM response
  → ToolRegistry.resolve(toolName)
  → PermissionEngine.check(tool, mode, user)
      ├── Layer 1: Is tool in mode's allowed list?
      ├── Layer 2: Is tool auto-approved?
      └── Layer 3: Run PreToolUse hooks
  → If approved:
      → Tool.execute(input)
      → Emit ToolCallEvent (append to EventStream)
      → Emit ToolResultEvent (append to EventStream)
      → Feed result back to LLM
  → If needs approval:
      → Emit ApprovalRequestEvent
      → Pause agent loop
      → User approves/rejects
      → Emit ApprovalResponseEvent
      → Resume or abort
```

## Flow 3: Smart Project Launch

```
User clicks "Run" or agent calls attempt_completion
  → PreviewModule.detectProjectType(workspacePath)
      ├── Check for index.html → Web project
      ├── Check for package.json scripts → Node project
      ├── Check for main.py → Python project
      ├── Check for Cargo.toml → Rust project
      ├── Check for Makefile → C/C++ project
      └── Fallback → generic file
  → Route to launcher:
      ├── Web → open in embedded BrowserView
      ├── Node (server) → start in terminal, open preview
      ├── Python script → run in terminal
      ├── Compiled → build then launch external window
      └── CLI → run in integrated terminal
```

## Flow 4: Task Graph Execution (Agent Mode)

```
User describes complex task
  → AgentRunner enters graph mode
  → PlannerNode.execute()
      ├── Analyze request + repo context
      └── Output task plan (ordered steps)
  → For each step:
      → CheckpointNode.save(state)
      → ExecutorNode.execute(step)
          ├── Run agent loop in Code mode
          ├── Execute tool calls
          └── Produce output
      → ReviewerNode.evaluate(output, plan)
          ├── Pass → continue
          ├── Needs revision → loop back to executor
          └── Fail → rollback to checkpoint
      → ApprovalGateNode (if risky)
          ├── Show diff to user
          ├── User approves → continue
          └── User rejects → rollback
  → All steps complete → emit TaskCompleteEvent
```

## Flow 5: Inline Code Completion

```
User types in Monaco Editor
  → Debounce (300ms)
  → CompletionProvider.provideInlineCompletions()
      ├── Get cursor position and surrounding code
      ├── Get file context (language, imports)
      ├── Build minimal prompt
      └── Send to AIGateway (utility model, low latency)
  → Receive completion text
  → Show as ghost text in editor
  → User accepts (Tab) or dismisses (Esc)
```
