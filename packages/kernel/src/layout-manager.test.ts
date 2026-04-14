import { describe, it, expect, vi } from "vitest";
import { LayoutManager } from "./layout-manager.js";
import type { PanelNode, TabState } from "@code-one/shared-types";

describe("LayoutManager", () => {
  it("initializes with default layout", () => {
    const lm = new LayoutManager();
    const state = lm.getState();

    expect(state.root.kind).toBe("split");
    expect(state.tabGroups).toHaveLength(1);
    expect(state.focusedPanelId).toBe("editor-center");
    expect(state.sidebarCollapsed.left).toBe(false);
  });

  it("adds a panel to the layout", () => {
    const lm = new LayoutManager();
    const handler = vi.fn();
    lm.onChange(handler);

    const panel: PanelNode = {
      kind: "panel",
      id: "new-panel",
      panelType: "custom",
      position: "bottom",
      visible: true,
      weight: 0.3,
    };
    lm.addPanel(panel);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe("panel-added");

    const root = lm.getState().root;
    if (root.kind === "split") {
      expect(root.children).toHaveLength(4); // 3 default + 1 new
    }
  });

  it("removes a panel from the layout", () => {
    const lm = new LayoutManager();
    lm.removePanel("sidebar-left");

    const root = lm.getState().root;
    if (root.kind === "split") {
      expect(root.children).toHaveLength(2);
    }
  });

  it("toggles panel visibility", () => {
    const lm = new LayoutManager();
    const handler = vi.fn();
    lm.onChange(handler);

    lm.togglePanel("sidebar-left");
    const root = lm.getState().root;
    if (root.kind === "split") {
      const panel = root.children.find(
        (c) => c.kind === "panel" && c.id === "sidebar-left",
      );
      expect(panel && panel.kind === "panel" && !panel.visible).toBe(true);
    }

    lm.togglePanel("sidebar-left");
    if (root.kind === "split") {
      const panel = root.children.find(
        (c) => c.kind === "panel" && c.id === "sidebar-left",
      );
      expect(panel && panel.kind === "panel" && panel.visible).toBe(true);
    }
  });

  it("resizes a panel", () => {
    const lm = new LayoutManager();
    lm.resizePanel("sidebar-left", 0.35);

    const root = lm.getState().root;
    if (root.kind === "split") {
      const panel = root.children.find(
        (c) => c.kind === "panel" && c.id === "sidebar-left",
      );
      expect(panel && panel.kind === "panel" && panel.weight).toBe(0.35);
    }
  });

  it("opens and activates tabs", () => {
    const lm = new LayoutManager();
    const tab: TabState = {
      id: "tab-1",
      type: "editor",
      title: "index.ts",
      uri: "/src/index.ts",
    };

    lm.openTab("main", tab);
    const group = lm.getState().tabGroups[0];
    expect(group.tabs).toHaveLength(1);
    expect(group.activeTabId).toBe("tab-1");
  });

  it("does not duplicate tabs with same URI", () => {
    const lm = new LayoutManager();
    const tab1: TabState = { id: "tab-1", type: "editor", title: "a.ts", uri: "/a.ts" };
    const tab2: TabState = { id: "tab-2", type: "editor", title: "a.ts", uri: "/a.ts" };

    lm.openTab("main", tab1);
    lm.openTab("main", tab2);

    const group = lm.getState().tabGroups[0];
    expect(group.tabs).toHaveLength(1);
    expect(group.activeTabId).toBe("tab-1"); // Re-activated the existing tab
  });

  it("closes tabs and adjusts active tab", () => {
    const lm = new LayoutManager();
    lm.openTab("main", { id: "t1", type: "editor", title: "a.ts" });
    lm.openTab("main", { id: "t2", type: "editor", title: "b.ts" });
    lm.openTab("main", { id: "t3", type: "editor", title: "c.ts" });

    // Active is t3 (last opened)
    expect(lm.getState().tabGroups[0].activeTabId).toBe("t3");

    lm.closeTab("main", "t3");
    // Should fall back to t2
    expect(lm.getState().tabGroups[0].activeTabId).toBe("t2");
    expect(lm.getState().tabGroups[0].tabs).toHaveLength(2);
  });

  it("activates a specific tab", () => {
    const lm = new LayoutManager();
    lm.openTab("main", { id: "t1", type: "editor", title: "a.ts" });
    lm.openTab("main", { id: "t2", type: "editor", title: "b.ts" });

    lm.activateTab("main", "t1");
    expect(lm.getState().tabGroups[0].activeTabId).toBe("t1");
  });

  it("focuses a panel", () => {
    const lm = new LayoutManager();
    const handler = vi.fn();
    lm.onChange(handler);

    lm.focusPanel("sidebar-right");
    expect(lm.getState().focusedPanelId).toBe("sidebar-right");
    expect(handler.mock.calls[0][0].type).toBe("focus-changed");
  });

  it("toggles sidebar collapse state", () => {
    const lm = new LayoutManager();
    expect(lm.getState().sidebarCollapsed.left).toBe(false);

    lm.toggleSidebar("left");
    expect(lm.getState().sidebarCollapsed.left).toBe(true);

    lm.toggleSidebar("left");
    expect(lm.getState().sidebarCollapsed.left).toBe(false);
  });

  it("setState replaces entire layout", () => {
    const lm = new LayoutManager();
    const handler = vi.fn();
    lm.onChange(handler);

    const custom = LayoutManager.defaultLayout();
    custom.focusedPanelId = "custom";
    lm.setState(custom);

    expect(lm.getState().focusedPanelId).toBe("custom");
    expect(handler.mock.calls[0][0].type).toBe("layout-restored");
  });

  it("resetToDefault restores initial layout", () => {
    const lm = new LayoutManager();
    lm.toggleSidebar("left");
    lm.focusPanel("sidebar-right");

    lm.resetToDefault();
    expect(lm.getState().sidebarCollapsed.left).toBe(false);
    expect(lm.getState().focusedPanelId).toBe("editor-center");
  });

  it("dispose stops change notifications", () => {
    const lm = new LayoutManager();
    const handler = vi.fn();
    const sub = lm.onChange(handler);

    lm.toggleSidebar("left");
    expect(handler).toHaveBeenCalledTimes(1);

    sub.dispose();
    lm.toggleSidebar("right");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
