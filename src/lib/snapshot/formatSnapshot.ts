export interface AXNode {
  nodeId: string;
  ignored: boolean;
  role?: { type: string; value: string };
  name?: { type: string; value: string };
  value?: { type: string; value: string };
  childIds?: string[];
  backendDOMNodeId?: number;
  parentId?: string;
}

const SKIP_ROLES = new Set(['none', 'generic', 'InlineTextBox', 'LineBreak', 'presentation']);
const MAX_TEXT_LEN = 120;
const MAX_LINES = 1500;

function truncate(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_TEXT_LEN ? `${collapsed.slice(0, MAX_TEXT_LEN)}…` : collapsed;
}

/** Filters AX-tree noise down to elements worth showing the model: anything
 * with real content/interactivity, skipping pure layout wrappers. */
function isKeepable(node: AXNode): boolean {
  if (node.ignored) return false;
  if (node.backendDOMNodeId === undefined) return false;
  const role = node.role?.value ?? '';
  if (SKIP_ROLES.has(role)) return false;
  return true;
}

export interface FormatResult {
  text: string;
  uidCount: number;
  truncated: boolean;
}

export function formatSnapshot(
  nodes: AXNode[],
  register: (backendNodeId: number) => string,
): FormatResult {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));

  const lines: string[] = [];
  let uidCount = 0;
  let truncated = false;

  function walk(node: AXNode, depth: number): void {
    if (truncated) return;
    if (lines.length >= MAX_LINES) {
      truncated = true;
      return;
    }

    const keep = isKeepable(node);
    let nextDepth = depth;

    if (keep) {
      const uid = register(node.backendDOMNodeId!);
      uidCount += 1;
      const role = node.role?.value ?? 'unknown';
      const name = node.name?.value ? ` "${truncate(node.name.value)}"` : '';
      const value = node.value?.value ? ` value="${truncate(node.value.value)}"` : '';
      lines.push(`${'  '.repeat(depth)}${role}${name}${value} [uid=${uid}]`);
      nextDepth = depth + 1;
    }

    for (const childId of node.childIds ?? []) {
      const child = byId.get(childId);
      if (child) walk(child, nextDepth);
    }
  }

  for (const root of roots) walk(root, 0);

  return {
    text: lines.join('\n') || '(empty page or no accessible content)',
    uidCount,
    truncated,
  };
}
