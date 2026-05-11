import { describe, it, expect } from 'vitest';
import { entryNode, nextNode } from '../../src/ui/DialogueRunner';
import type { DialogueNode } from '../../src/content/types';

const tree: DialogueNode[] = [
  { id: 'n0', text: 'hello', choices: [{ label: 'a', next: 'nA' }, { label: 'b', next: 'nB' }] },
  { id: 'nA', text: 'you chose A', next: 'nEnd', setFlag: 'flagA' },
  { id: 'nB', text: 'you chose B', launch: 'shrine', end: true },
  { id: 'nEnd', text: 'bye', end: true }
];

describe('DialogueRunner', () => {
  it('entryNode is the first node', () => { expect(entryNode(tree).id).toBe('n0'); });
  it('a choice node follows the chosen branch', () => {
    const r = nextNode(tree, 'n0', 0);
    expect(r.node.id).toBe('nA'); expect(r.setFlag).toBe('flagA'); expect(r.end).toBe(false);
  });
  it('a linear node follows .next; reaching an end node reports end', () => {
    const r = nextNode(tree, 'nA');
    expect(r.node.id).toBe('nEnd'); expect(r.end).toBe(true);
  });
  it('surfaces launch on the resolved node', () => {
    const r = nextNode(tree, 'n0', 1);
    expect(r.node.id).toBe('nB'); expect(r.launch).toBe('shrine'); expect(r.end).toBe(true);
  });
  it('throws on a dangling next id', () => {
    const bad: DialogueNode[] = [{ id: 'x', text: 't', next: 'missing' }];
    expect(() => nextNode(bad, 'x')).toThrow();
  });
  it('throws when a choice index is out of range', () => { expect(() => nextNode(tree, 'n0', 9)).toThrow(); });
});
