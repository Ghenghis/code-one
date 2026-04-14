# Research Note: Security Sandboxing

**Source:** Multiple (OpenHands Docker runtime, VS Code extension sandbox model, Deno permissions, WASM isolation patterns)  
**Date reviewed:** 2026-04-14

## What pattern it proves

Agent-generated code must execute in isolation. The host machine should never be directly exposed to arbitrary commands from an autonomous agent without explicit capability grants.

## Why it matters

- Autonomous agents can run terminal commands, write files, and spawn processes
- A single bad command (rm -rf, credential exfiltration, network calls) can cause irreversible damage
- Sandboxing provides defense in depth beyond the approval gate system

## How we adapt it

### Trust Levels (from our design)

| Level      | Scope                          | Isolation                        |
| ---------- | ------------------------------ | -------------------------------- |
| Trusted    | Read-only ops                  | None needed                      |
| Guarded    | Local file mutations           | Working directory scoped         |
| Restricted | Terminal commands              | Command validation + allowlist   |
| Isolated   | Agent-generated code execution | Process-level or container-level |
| Remote     | SSH, deploy, API calls         | Always require approval + audit  |

### Implementation Phases

**Phase 1 (Milestone 5):** Process-level isolation

- Agent commands run in a child process with restricted env
- Working directory locked to project root
- PATH restricted to safe executables
- Network access logged

**Phase 2 (Milestone 6+):** Container isolation (optional)

- Docker-based sandbox for untrusted code execution
- Disposable containers per agent task
- Filesystem mounted read-only except for workspace
- Network policies enforced

**Phase 3 (Tier 7):** WASM sandbox (optional)

- For lightweight code evaluation without Docker overhead
- Language-specific WASM runtimes for Python, JS, etc.

### Command Validation

```typescript
interface CommandPolicy {
  allowPatterns: RegExp[]; // commands that can auto-execute
  denyPatterns: RegExp[]; // commands that are always blocked
  warnPatterns: RegExp[]; // commands that require approval
}
```

Default deny patterns:

- `rm -rf /`, `rm -rf ~`, any recursive delete outside project
- `curl | sh`, `wget | bash` — pipe-to-shell patterns
- `chmod 777`, `chown` — permission changes
- `ssh-keygen`, credential access commands
- `git push --force` to protected branches
- Environment variable exfiltration (`env`, `printenv` piped to network)

## What we will not copy

- **OpenHands mandatory Docker**: Too heavy for local development. Sandbox should be opt-in.
- **Deno-style granular permissions per syscall**: Over-engineered for an IDE context.

## Risks

- Sandbox escape is always possible with sufficient creativity
- Docker adds startup latency to agent tasks
- Some legitimate dev workflows require broad system access

## Validation checklist

- [ ] Restricted commands trigger approval gate
- [ ] Denied commands are blocked and logged
- [ ] Agent cannot read files outside project root in isolated mode
- [ ] Network calls from agent code are logged
- [ ] Container sandbox starts and stops correctly (when enabled)
