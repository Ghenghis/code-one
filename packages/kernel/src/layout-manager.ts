import type {
  ILayoutManager,
  LayoutChangeEvent,
  LayoutChangeHandler,
  LayoutNode,
  LayoutState,
  PanelNode,
  TabState,
} from "@code-one/shared-types";

interface Subscription {
  handler: LayoutChangeHandler;
}

/**
 * Manages the spatial arrangement of panels, panes, and tabs.
 *
 * - Tree-based layout model (split nodes + panel leaves)
 * - Tab group management for the center editor area
 * - Sidebar collapse state tracking
 * - Save/restore for session persistence
 */
export class LayoutManager implements ILayoutManager {
  private state: LayoutState;
  private subscriptions = new Set<Subscription>();
  private persistFn?: () => Promise<void>;
  private restoreFn?: () => Promise<LayoutState | null>;

  constructor() {
    this.state = LayoutManager.defaultLayout();
  }

  getState(): LayoutState {
    return this.state;
  }

  setState(state: LayoutState): void {
    this.state = state;
    this.notify({ type: "layout-restored", state: this.state });
  }

  addPanel(panel: PanelNode): void {
    // Add to root children if root is a split node
    if (this.state.root.kind === "split") {
      this.state.root.children.push(panel);
    }
    this.notify({ type: "panel-added", panelId: panel.id, state: this.state });
  }

  removePanel(panelId: string): void {
    this.removePanelFromNode(this.state.root, panelId);
    this.notify({
      type: "panel-removed",
      panelId,
      state: this.state,
    });
  }

  togglePanel(panelId: string): void {
    const panel = this.findPanel(this.state.root, panelId);
    if (panel) {
      panel.visible = !panel.visible;
      this.notify({
        type: "panel-toggled",
        panelId,
        state: this.state,
      });
    }
  }

  resizePanel(panelId: string, weight: number): void {
    const panel = this.findPanel(this.state.root, panelId);
    if (panel) {
      panel.weight = weight;
      this.notify({
        type: "panel-resized",
        panelId,
        state: this.state,
      });
    }
  }

  openTab(groupId: string, tab: TabState): void {
    const group = this.state.tabGroups.find((g) => g.id === groupId);
    if (!group) return;

    // Don't duplicate tabs for the same URI
    const existing = tab.uri ? group.tabs.find((t) => t.uri === tab.uri) : undefined;
    if (existing) {
      group.activeTabId = existing.id;
    } else {
      group.tabs.push(tab);
      group.activeTabId = tab.id;
    }

    this.notify({
      type: "tab-opened",
      tabId: tab.id,
      state: this.state,
    });
  }

  closeTab(groupId: string, tabId: string): void {
    const group = this.state.tabGroups.find((g) => g.id === groupId);
    if (!group) return;

    const index = group.tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    group.tabs.splice(index, 1);

    // Move active tab if we closed the active one
    if (group.activeTabId === tabId) {
      group.activeTabId = group.tabs[Math.min(index, group.tabs.length - 1)]?.id;
    }

    this.notify({
      type: "tab-closed",
      tabId,
      state: this.state,
    });
  }

  activateTab(groupId: string, tabId: string): void {
    const group = this.state.tabGroups.find((g) => g.id === groupId);
    if (!group) return;

    if (group.tabs.some((t) => t.id === tabId)) {
      group.activeTabId = tabId;
      this.notify({
        type: "tab-activated",
        tabId,
        state: this.state,
      });
    }
  }

  focusPanel(panelId: string): void {
    this.state.focusedPanelId = panelId;
    this.notify({
      type: "focus-changed",
      panelId,
      state: this.state,
    });
  }

  toggleSidebar(position: "left" | "right" | "bottom"): void {
    this.state.sidebarCollapsed[position] = !this.state.sidebarCollapsed[position];
    this.notify({
      type: "panel-toggled",
      state: this.state,
    });
  }

  onChange(handler: LayoutChangeHandler): { dispose(): void } {
    const sub: Subscription = { handler };
    this.subscriptions.add(sub);
    return {
      dispose: () => {
        this.subscriptions.delete(sub);
      },
    };
  }

  async save(): Promise<void> {
    if (this.persistFn) {
      await this.persistFn();
    }
  }

  async restore(): Promise<void> {
    if (this.restoreFn) {
      const saved = await this.restoreFn();
      if (saved) {
        this.state = saved;
        this.notify({ type: "layout-restored", state: this.state });
      }
    }
  }

  resetToDefault(): void {
    this.state = LayoutManager.defaultLayout();
    this.notify({ type: "layout-restored", state: this.state });
  }

  /** Set persistence callbacks (injected by the shell at runtime) */
  setPersistence(
    persistFn: () => Promise<void>,
    restoreFn: () => Promise<LayoutState | null>,
  ): void {
    this.persistFn = persistFn;
    this.restoreFn = restoreFn;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private notify(event: LayoutChangeEvent): void {
    for (const sub of this.subscriptions) {
      try {
        sub.handler(event);
      } catch {
        // Subscribers must not crash the layout manager.
      }
    }
  }

  private findPanel(node: LayoutNode, panelId: string): PanelNode | undefined {
    if (node.kind === "panel") {
      return node.id === panelId ? node : undefined;
    }
    for (const child of node.children) {
      const found = this.findPanel(child, panelId);
      if (found) return found;
    }
    return undefined;
  }

  private removePanelFromNode(node: LayoutNode, panelId: string): boolean {
    if (node.kind !== "split") return false;
    const index = node.children.findIndex((c) => c.kind === "panel" && c.id === panelId);
    if (index >= 0) {
      node.children.splice(index, 1);
      return true;
    }
    for (const child of node.children) {
      if (this.removePanelFromNode(child, panelId)) return true;
    }
    return false;
  }

  /** The default IDE layout matching the design spec */
  static defaultLayout(): LayoutState {
    return {
      root: {
        kind: "split",
        id: "root",
        direction: "horizontal",
        children: [
          {
            kind: "panel",
            id: "sidebar-left",
            panelType: "sidebar",
            position: "left",
            visible: true,
            weight: 0.2,
          },
          {
            kind: "panel",
            id: "editor-center",
            panelType: "editor",
            position: "center",
            visible: true,
            weight: 0.55,
          },
          {
            kind: "panel",
            id: "sidebar-right",
            panelType: "chat",
            position: "right",
            visible: true,
            weight: 0.25,
          },
        ],
      },
      tabGroups: [
        {
          id: "main",
          tabs: [],
          activeTabId: undefined,
        },
      ],
      focusedPanelId: "editor-center",
      sidebarCollapsed: {
        left: false,
        right: false,
        bottom: false,
      },
      panelSizes: {},
    };
  }
}
