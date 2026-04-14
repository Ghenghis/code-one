import type { IPCChannelDescriptor } from "@code-one/shared-types";

const CHANNEL_DESCRIPTORS: IPCChannelDescriptor[] = [
  {
    channel: "command:execute",
    direction: "renderer-to-main",
    description: "Execute a registered command by ID",
    module: "kernel",
  },
  {
    channel: "command:list",
    direction: "renderer-to-main",
    description: "List all registered command descriptors",
    module: "kernel",
  },
  {
    channel: "event:emit",
    direction: "renderer-to-main",
    description: "Emit an event from renderer to main process event bus",
    module: "kernel",
  },
  {
    channel: "event:subscribe",
    direction: "bidirectional",
    description:
      "Subscribe to events; main forwards matching events to renderer",
    module: "kernel",
  },
  {
    channel: "settings:get",
    direction: "renderer-to-main",
    description: "Get a resolved setting value by key",
    module: "kernel",
  },
  {
    channel: "settings:set",
    direction: "renderer-to-main",
    description: "Set a setting value at a given scope",
    module: "kernel",
  },
  {
    channel: "settings:get-scope",
    direction: "renderer-to-main",
    description: "Get all settings at a specific scope",
    module: "kernel",
  },
  {
    channel: "layout:get",
    direction: "renderer-to-main",
    description: "Get the current layout state",
    module: "kernel",
  },
  {
    channel: "layout:set",
    direction: "renderer-to-main",
    description: "Replace the layout state",
    module: "kernel",
  },
  {
    channel: "module:list",
    direction: "renderer-to-main",
    description: "List all registered modules and their status",
    module: "kernel",
  },
  {
    channel: "permission:check",
    direction: "renderer-to-main",
    description: "Check if a permission is granted for a module + capability",
    module: "kernel",
  },
];

export const IPC_CHANNELS = CHANNEL_DESCRIPTORS.map((d) => d.channel);

const descriptorMap = new Map(CHANNEL_DESCRIPTORS.map((d) => [d.channel, d]));

export function getChannelDescriptor(
  channel: string,
): IPCChannelDescriptor | undefined {
  return descriptorMap.get(channel);
}
