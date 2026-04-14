import type { TabState } from "../App.js";
import "./StatusBar.css";

interface StatusBarProps {
  tab: TabState | null;
  tabCount: number;
}

export function StatusBar({ tab, tabCount }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar__left">
        {tab ? (
          <>
            <span className="status-bar__item">{tab.language}</span>
            <span className="status-bar__item">{tab.dirty ? "Modified" : "Saved"}</span>
          </>
        ) : (
          <span className="status-bar__item">No file open</span>
        )}
      </div>
      <div className="status-bar__right">
        <span className="status-bar__item">{tabCount} tab{tabCount !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
