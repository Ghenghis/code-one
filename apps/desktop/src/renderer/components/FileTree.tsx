import { useState, useCallback, useEffect } from "react";
import type { DirEntry } from "../../preload/api.js";
import "./FileTree.css";

interface FileTreeProps {
  workspacePath: string;
  activeFilePath: string | null;
  onFileSelect: (filePath: string) => void;
}

interface TreeNode extends DirEntry {
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

function TreeItem({
  node,
  depth,
  activeFilePath,
  onFileSelect,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  activeFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  onToggle: (node: TreeNode) => void;
}) {
  const isActive = node.path === activeFilePath;
  const paddingLeft = 8 + depth * 16;

  const handleClick = () => {
    if (node.isDirectory) {
      onToggle(node);
    } else {
      onFileSelect(node.path);
    }
  };

  return (
    <>
      <div
        className={`file-tree__item ${isActive ? "file-tree__item--active" : ""}`}
        style={{ paddingLeft }}
        onClick={handleClick}
        title={node.path}
      >
        <span className="file-tree__icon">
          {node.isDirectory ? (node.expanded ? "\u25BE" : "\u25B8") : "\u2022"}
        </span>
        <span className="file-tree__name">{node.name}</span>
      </div>
      {node.isDirectory &&
        node.expanded &&
        node.children?.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            onFileSelect={onFileSelect}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

export function FileTree({ workspacePath, activeFilePath, onFileSelect }: FileTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);

  const loadDirectory = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    try {
      const entries = await window.codeone.listDirectory(dirPath);
      return entries.map((e) => ({
        ...e,
        expanded: false,
        children: e.isDirectory ? [] : undefined,
      }));
    } catch (err) {
      console.error("Failed to list directory:", dirPath, err);
      return [];
    }
  }, []);

  // Load root directory
  useEffect(() => {
    loadDirectory(workspacePath).then(setNodes);
  }, [workspacePath, loadDirectory]);

  const toggleNode = useCallback(
    async (target: TreeNode) => {
      if (!target.isDirectory) return;

      const toggle = async (items: TreeNode[]): Promise<TreeNode[]> => {
        const result: TreeNode[] = [];
        for (const node of items) {
          if (node.path === target.path) {
            if (!node.expanded) {
              // Expand: load children if not loaded
              const children =
                node.children && node.children.length > 0
                  ? node.children
                  : await loadDirectory(node.path);
              result.push({ ...node, expanded: true, children });
            } else {
              result.push({ ...node, expanded: false });
            }
          } else if (node.isDirectory && node.children) {
            result.push({ ...node, children: await toggle(node.children) });
          } else {
            result.push(node);
          }
        }
        return result;
      };

      setNodes(await toggle(nodes));
    },
    [nodes, loadDirectory],
  );

  if (nodes.length === 0) {
    return <div className="file-tree__empty">No files found</div>;
  }

  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          onToggle={toggleNode}
        />
      ))}
    </div>
  );
}
