import { useState, useCallback, useMemo } from "react";
import { TabBar } from "./components/TabBar.js";
import { EditorPane } from "./components/EditorPane.js";
import { FileTree } from "./components/FileTree.js";
import { StatusBar } from "./components/StatusBar.js";
import { WelcomeScreen } from "./components/WelcomeScreen.js";
import { CommandPalette } from "./components/CommandPalette.js";
import type { PaletteCommand } from "./components/CommandPalette.js";

export interface TabState {
  filePath: string;
  fileName: string;
  content: string;
  dirty: boolean;
  language: string;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    yml: "yaml",
    yaml: "yaml",
    py: "python",
    rs: "rust",
    go: "go",
    sh: "shell",
    bash: "shell",
    toml: "toml",
    sql: "sql",
    xml: "xml",
    svg: "xml",
  };
  return map[ext] ?? "plaintext";
}

function fileName(filePath: string): string {
  return filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
}

export function App() {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openWorkspace = useCallback(async () => {
    const folder = await window.codeone.openFolder();
    if (folder) setWorkspacePath(folder);
  }, []);

  const openFile = useCallback(
    async (filePath?: string) => {
      let paths: string[];
      if (filePath) {
        paths = [filePath];
      } else {
        paths = await window.codeone.openFileDialog();
        if (paths.length === 0) return;
      }

      for (const fp of paths) {
        // Don't open duplicates — focus existing tab
        const existing = tabs.findIndex((t) => t.filePath === fp);
        if (existing !== -1) {
          setActiveIndex(existing);
          continue;
        }

        try {
          const content = await window.codeone.readFile(fp);
          const newTab: TabState = {
            filePath: fp,
            fileName: fileName(fp),
            content,
            dirty: false,
            language: detectLanguage(fp),
          };
          setTabs((prev) => {
            const next = [...prev, newTab];
            setActiveIndex(next.length - 1);
            return next;
          });
        } catch (err) {
          console.error("Failed to open file:", fp, err);
        }
      }
    },
    [tabs],
  );

  const saveFile = useCallback(
    async (index: number) => {
      const tab = tabs[index];
      if (!tab || !tab.dirty) return;

      try {
        await window.codeone.writeFile(tab.filePath, tab.content);
        setTabs((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], dirty: false };
          return next;
        });
      } catch (err) {
        console.error("Failed to save file:", tab.filePath, err);
      }
    },
    [tabs],
  );

  const saveActiveFile = useCallback(() => {
    if (activeIndex >= 0) saveFile(activeIndex);
  }, [activeIndex, saveFile]);

  const closeTab = useCallback(
    (index: number) => {
      setTabs((prev) => {
        const next = prev.filter((_, i) => i !== index);
        // Adjust active index
        if (next.length === 0) {
          setActiveIndex(-1);
        } else if (index <= activeIndex) {
          setActiveIndex(Math.max(0, activeIndex - 1));
        }
        return next;
      });
    },
    [activeIndex],
  );

  const onContentChange = useCallback((index: number, newContent: string) => {
    setTabs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], content: newContent, dirty: true };
      return next;
    });
  }, []);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        openFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveActiveFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        if (activeIndex >= 0) closeTab(activeIndex);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "O") {
        e.preventDefault();
        openWorkspace();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    },
    [openFile, saveActiveFile, closeTab, activeIndex, openWorkspace],
  );

  const paletteCommands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "file.open",
        title: "Open File",
        keywords: ["file", "open", "load"],
        action: () => openFile(),
      },
      {
        id: "folder.open",
        title: "Open Folder",
        keywords: ["folder", "workspace", "directory"],
        action: () => openWorkspace(),
      },
      {
        id: "file.save",
        title: "Save File",
        keywords: ["save", "write", "persist"],
        action: () => saveActiveFile(),
      },
    ],
    [openFile, openWorkspace, saveActiveFile],
  );

  const activeTab = activeIndex >= 0 ? tabs[activeIndex] : null;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <TabBar
        tabs={tabs}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        onClose={closeTab}
        onOpenFile={() => openFile()}
      />

      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {workspacePath && (
          <div
            style={{
              width: 240,
              minWidth: 180,
              borderRight: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                color: "var(--text-secondary)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Explorer
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              <FileTree
                workspacePath={workspacePath}
                activeFilePath={activeTab?.filePath ?? null}
                onFileSelect={(fp) => openFile(fp)}
              />
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeTab ? (
            <EditorPane
              tab={activeTab}
              onChange={(content) => onContentChange(activeIndex, content)}
            />
          ) : (
            <WelcomeScreen onOpenFile={() => openFile()} onOpenFolder={openWorkspace} />
          )}
        </div>
      </div>

      <StatusBar tab={activeTab} tabCount={tabs.length} />

      {paletteOpen && (
        <CommandPalette commands={paletteCommands} onClose={() => setPaletteOpen(false)} />
      )}
    </div>
  );
}
