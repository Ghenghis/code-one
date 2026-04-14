import { useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { TabState } from "../App.js";

interface EditorPaneProps {
  tab: TabState;
  onChange: (content: string) => void;
}

export function EditorPane({ tab, onChange }: EditorPaneProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onChange(value);
      }
    },
    [onChange],
  );

  return (
    <Editor
      height="100%"
      language={tab.language}
      value={tab.content}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleMount}
      path={tab.filePath}
      options={{
        fontSize: 14,
        lineNumbers: "on",
        minimap: { enabled: true },
        wordWrap: "off",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: "selection",
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
      }}
    />
  );
}
