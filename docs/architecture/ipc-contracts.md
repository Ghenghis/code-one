# IPC Contracts

Typed message contracts between Electron main process and renderer process.

## Design Principles

- All IPC messages are typed via shared-types
- Renderer never accesses Node.js APIs directly
- Main process exposes capabilities through typed handlers
- Messages are serializable (no functions, no circular refs)

## Channel Naming Convention

```
{module}:{action}
```

Examples:
- `workspace:read-file`
- `workspace:write-file`
- `workspace:list-dir`
- `terminal:create`
- `terminal:write`
- `terminal:resize`
- `editor:get-content`
- `ai:chat-stream`
- `ai:complete`
- `settings:get`
- `settings:set`

## Message Shape

```typescript
interface IPCRequest<T = unknown> {
  channel: string;
  id: string;        // correlation ID for request/response matching
  payload: T;
}

interface IPCResponse<T = unknown> {
  channel: string;
  id: string;        // matches request ID
  payload?: T;
  error?: { code: string; message: string };
}

interface IPCEvent<T = unknown> {
  channel: string;
  payload: T;
}
```

## Security

- All IPC channels are explicitly registered in a whitelist
- No `eval()` or dynamic channel creation
- Renderer context isolation enabled
- Node integration disabled in renderer
- preload script exposes only typed API
