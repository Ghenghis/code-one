import { describe, it, expect } from "vitest";
import { IPC_CHANNELS, getChannelDescriptor } from "./channels.js";

describe("IPC Channel Registry", () => {
  it("has all required channels", () => {
    const required = [
      "command:execute",
      "command:list",
      "event:emit",
      "event:subscribe",
      "settings:get",
      "settings:set",
      "settings:get-scope",
      "layout:get",
      "layout:set",
      "module:list",
      "permission:check",
    ];
    for (const ch of required) {
      expect(IPC_CHANNELS).toContain(ch);
    }
  });

  it("returns descriptor for valid channel", () => {
    const desc = getChannelDescriptor("command:execute");
    expect(desc).toBeDefined();
    expect(desc!.channel).toBe("command:execute");
    expect(desc!.direction).toBeDefined();
    expect(desc!.module).toBeDefined();
    expect(desc!.description).toBeTruthy();
  });

  it("returns undefined for unknown channel", () => {
    expect(getChannelDescriptor("does:not-exist")).toBeUndefined();
  });

  it("every channel has a descriptor", () => {
    for (const ch of IPC_CHANNELS) {
      const desc = getChannelDescriptor(ch);
      expect(desc, `missing descriptor for ${ch}`).toBeDefined();
    }
  });

  it("channel names follow module:action format", () => {
    for (const ch of IPC_CHANNELS) {
      expect(ch).toMatch(/^[a-z]+:[a-z][-a-z]*$/);
    }
  });
});
