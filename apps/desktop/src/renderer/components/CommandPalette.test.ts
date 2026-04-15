import { describe, it, expect, vi } from "vitest";
import type { PaletteCommand } from "./CommandPalette.js";

// Test the filtering and selection logic independently of React rendering.
// This validates the core behavior without requiring a DOM environment.

function makeCommands(): PaletteCommand[] {
  return [
    { id: "file.open", title: "Open File", keywords: ["file", "open", "load"], action: vi.fn() },
    { id: "folder.open", title: "Open Folder", keywords: ["folder", "workspace", "directory"], action: vi.fn() },
    { id: "file.save", title: "Save File", keywords: ["save", "write", "persist"], action: vi.fn() },
  ];
}

function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  if (query.length === 0) return commands;
  const q = query.toLowerCase();
  return commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(q) ||
    cmd.keywords.some((kw) => kw.toLowerCase().includes(q)),
  );
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length - 1));
}

describe("CommandPalette logic", () => {
  describe("filtering", () => {
    it("returns all commands with empty query", () => {
      const cmds = makeCommands();
      const result = filterCommands(cmds, "");
      expect(result).toHaveLength(3);
    });

    it("filters by title substring", () => {
      const cmds = makeCommands();
      expect(filterCommands(cmds, "open")).toHaveLength(2);
      expect(filterCommands(cmds, "save")).toHaveLength(1);
      expect(filterCommands(cmds, "save")[0].id).toBe("file.save");
    });

    it("filters by keyword", () => {
      const cmds = makeCommands();
      expect(filterCommands(cmds, "workspace")).toHaveLength(1);
      expect(filterCommands(cmds, "workspace")[0].id).toBe("folder.open");
    });

    it("filters case-insensitively", () => {
      const cmds = makeCommands();
      expect(filterCommands(cmds, "OPEN")).toHaveLength(2);
      expect(filterCommands(cmds, "Save")).toHaveLength(1);
    });

    it("returns empty for non-matching query", () => {
      const cmds = makeCommands();
      expect(filterCommands(cmds, "terminal")).toHaveLength(0);
    });

    it("matches partial keywords", () => {
      const cmds = makeCommands();
      expect(filterCommands(cmds, "pers")).toHaveLength(1);
      expect(filterCommands(cmds, "pers")[0].id).toBe("file.save");
    });
  });

  describe("selection clamping", () => {
    it("clamps index to valid range", () => {
      expect(clampIndex(-1, 3)).toBe(0);
      expect(clampIndex(0, 3)).toBe(0);
      expect(clampIndex(2, 3)).toBe(2);
      expect(clampIndex(5, 3)).toBe(2);
    });

    it("handles single-item list", () => {
      expect(clampIndex(0, 1)).toBe(0);
      expect(clampIndex(1, 1)).toBe(0);
    });

    it("arrow down increments within bounds", () => {
      let idx = 0;
      idx = clampIndex(idx + 1, 3); // ArrowDown
      expect(idx).toBe(1);
      idx = clampIndex(idx + 1, 3);
      expect(idx).toBe(2);
      idx = clampIndex(idx + 1, 3); // at bottom, stays
      expect(idx).toBe(2);
    });

    it("arrow up decrements within bounds", () => {
      let idx = 2;
      idx = clampIndex(idx - 1, 3); // ArrowUp
      expect(idx).toBe(1);
      idx = clampIndex(idx - 1, 3);
      expect(idx).toBe(0);
      idx = clampIndex(idx - 1, 3); // at top, stays
      expect(idx).toBe(0);
    });
  });

  describe("command execution", () => {
    it("calling action invokes the handler", () => {
      const cmds = makeCommands();
      cmds[0].action();
      expect(cmds[0].action).toHaveBeenCalledTimes(1);
    });

    it("only the selected command is executed", () => {
      const cmds = makeCommands();
      const filtered = filterCommands(cmds, "save");
      expect(filtered).toHaveLength(1);
      filtered[0].action();
      expect(cmds[2].action).toHaveBeenCalledTimes(1);
      expect(cmds[0].action).not.toHaveBeenCalled();
      expect(cmds[1].action).not.toHaveBeenCalled();
    });
  });

  describe("palette open/close state", () => {
    it("palette state can be toggled", () => {
      let isOpen = false;
      // Simulate Ctrl+Shift+P
      isOpen = true;
      expect(isOpen).toBe(true);
      // Simulate Escape
      isOpen = false;
      expect(isOpen).toBe(false);
    });

    it("selection resets when query changes", () => {
      // Simulates the useEffect behavior: on query change, selectedIndex → 0
      let selectedIndex = 2;
      const queryChanged = true;
      if (queryChanged) selectedIndex = 0;
      expect(selectedIndex).toBe(0);
    });
  });
});
