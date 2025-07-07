import { type TreeItem } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
/*

convert "src/comonent.tsx" :code.... main.tsx:....    ,
 to
  [["src","component.tsx"],"main.tsx"]
*/
export function convertFilesToTreeItems(files: {
  [path: string]: string;
}): TreeItem[] {
  interface TreeNode {
    [key: string]: TreeNode | null;
  }
  const tree: TreeNode = {};
  const sortedPaths = Object.keys(files).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split("/");
    let curr = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!curr[part]) {
        curr[part] = {};
      }
      curr = curr[part];
    }
    //src/components/button.tsx
    const fileName = parts[parts.length - 1];
    curr[fileName] = null;
  }
  function convertNode(node: TreeNode, name?: string): TreeItem[] | TreeItem {
    const entries = Object.entries(node);
    if (entries.length === 0) return name || "";
    const children: TreeItem[] = [];
    for (const [key, value] of entries) {
      if (value === null) {
        children.push(key); // file
      } else {
        const subTree = convertNode(value, key);
        if (Array.isArray(subTree)) {
          children.push([key, ...subTree]);
        } else {
          children.push([key, subTree]);
        }
      }
    }
    return children;
  }
  const result = convertNode(tree);
  return Array.isArray(result) ? result : [result];
}
