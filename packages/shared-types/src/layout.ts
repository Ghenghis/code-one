/**
 * Layout state type contracts.
 *
 * Manages the spatial arrangement of panels, panes, and tabs
 * within the Electron desktop shell.
 */

// ---------------------------------------------------------------------------
// Panel positions
// ---------------------------------------------------------------------------

export type PanelPosition = "left" | "right" | "bottom" | "center";

export type SplitDirection = "horizontal" | "vertical";

// ---------------------------------------------------------------------------
// Layout tree
// ---------------------------------------------------------------------------

/** A leaf node: a single panel with content */
export interface PanelNode {
  kind: "panel";
  id: string;
  /** Which panel is rendered here */
  panelType: string;
  /** Position hint for the shell */
  position: PanelPosition;
  /** Whether this panel is currently visible */
  visible: boolean;
  /** Relative size weight (within its parent split) */
  weight: number;
}

/** A branch node: splits space between children */
export interface SplitNode {
  kind: "split";
  id: string;
  direction: SplitDirection;
  children: LayoutNode[];
}

export type LayoutNode = PanelNode | SplitNode;

// ---------------------------------------------------------------------------
// Tab state
// ---------------------------------------------------------------------------

export interface TabState {
  id: string;
  /** What type of content this tab holds */
  type: "editor" | "preview" | "terminal" | "settings" | "welcome" | "custom";
  /** Display title */
  title: string;
  /** Associated resource (file path, URL, etc.) */
  uri?: string;
  /** Whether this tab has unsaved changes */
  dirty?: boolean;
  /** Custom metadata */
  meta?: Record<string, unknown>;
}

export interface TabGroupState {
  id: string;
  tabs: TabState[];
  activeTabId?: string;
}

// ---------------------------------------------------------------------------
// Full layout state
// ---------------------------------------------------------------------------

export interface LayoutState {
  /** Root of the layout tree */
  root: LayoutNode;
  /** Tab groups in the center area */
  tabGroups: TabGroupState[];
  /** Currently focused panel ID */
  focusedPanelId?: string;
  /** Sidebar collapsed states */
  sidebarCollapsed: {
    left: boolean;
    right: boolean;
    bottom: boolean;
  };
  /** Panel sizes (for restoring drag positions) */
  panelSizes: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Layout change events
// ---------------------------------------------------------------------------

export interface LayoutChangeEvent {
  type:
    | "panel-added"
    | "panel-removed"
    | "panel-resized"
    | "panel-moved"
    | "panel-toggled"
    | "tab-opened"
    | "tab-closed"
    | "tab-activated"
    | "focus-changed"
    | "layout-restored";
  panelId?: string;
  tabId?: string;
  state: LayoutState;
}

export type LayoutChangeHandler = (event: LayoutChangeEvent) => void;

// ---------------------------------------------------------------------------
// LayoutManager interface
// ---------------------------------------------------------------------------

export interface ILayoutManager {
  /** Get the current layout state */
  getState(): LayoutState;
  /** Replace the entire layout state (e.g., on restore) */
  setState(state: LayoutState): void;
  /** Add a panel */
  addPanel(panel: PanelNode): void;
  /** Remove a panel by ID */
  removePanel(panelId: string): void;
  /** Toggle panel visibility */
  togglePanel(panelId: string): void;
  /** Resize a panel (set weight) */
  resizePanel(panelId: string, weight: number): void;
  /** Open a tab in a tab group */
  openTab(groupId: string, tab: TabState): void;
  /** Close a tab */
  closeTab(groupId: string, tabId: string): void;
  /** Set the active tab in a group */
  activateTab(groupId: string, tabId: string): void;
  /** Set focus to a panel */
  focusPanel(panelId: string): void;
  /** Toggle sidebar collapse */
  toggleSidebar(position: "left" | "right" | "bottom"): void;
  /** Subscribe to layout changes */
  onChange(handler: LayoutChangeHandler): { dispose(): void };
  /** Save layout to persistence backend */
  save(): Promise<void>;
  /** Restore layout from persistence backend */
  restore(): Promise<void>;
  /** Reset to default layout */
  resetToDefault(): void;
}
