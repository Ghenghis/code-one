import type { TabState } from "../App.js";
import "./TabBar.css";

interface TabBarProps {
  tabs: TabState[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
  onOpenFile: () => void;
}

export function TabBar({ tabs, activeIndex, onSelect, onClose, onOpenFile }: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab, i) => (
          <div
            key={tab.filePath}
            className={`tab ${i === activeIndex ? "tab--active" : ""}`}
            onClick={() => onSelect(i)}
            title={tab.filePath}
          >
            <span className="tab__name">
              {tab.dirty && <span className="tab__dirty" />}
              {tab.fileName}
            </span>
            <button
              className="tab__close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(i);
              }}
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="tab-bar__open" onClick={onOpenFile} title="Open File (Ctrl+O)">
        +
      </button>
    </div>
  );
}
