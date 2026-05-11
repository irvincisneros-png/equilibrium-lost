import type { DialogueNode } from '../content/types';

export function dialogueIndex(tree: DialogueNode[]): Map<string, DialogueNode> {
  const m = new Map<string, DialogueNode>();
  for (const n of tree) m.set(n.id, n);
  return m;
}

export function entryNode(tree: DialogueNode[]): DialogueNode {
  if (!tree.length) throw new Error('empty dialogue tree');
  return tree[0]!;
}

export interface NextNodeResult {
  node: DialogueNode;
  end: boolean;
  setFlag?: string;
  launch?: string;
}

export function nextNode(tree: DialogueNode[], currentId: string, choiceIndex?: number): NextNodeResult {
  const idx = dialogueIndex(tree);
  const cur = idx.get(currentId);
  if (!cur) throw new Error(`dialogue: no node "${currentId}"`);
  let targetId: string | undefined;
  if (cur.choices && cur.choices.length) {
    if (typeof choiceIndex !== 'number' || choiceIndex < 0 || choiceIndex >= cur.choices.length) {
      throw new Error(`dialogue: bad choice index ${choiceIndex} at "${currentId}"`);
    }
    targetId = cur.choices[choiceIndex]!.next;
  } else {
    targetId = cur.next;
  }
  if (!targetId) throw new Error(`dialogue: node "${currentId}" has no continuation`);
  const node = idx.get(targetId);
  if (!node) throw new Error(`dialogue: dangling next "${targetId}" from "${currentId}"`);
  const end = node.end === true || (!node.next && !(node.choices && node.choices.length));
  return { node, end, setFlag: node.setFlag, launch: node.launch };
}
