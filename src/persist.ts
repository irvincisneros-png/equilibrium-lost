import type Phaser from 'phaser';
import { SaveManager } from './systems/SaveManager';
import type { SaveData, GameContent } from './content/types';
import type { QuizEngine } from './systems/QuizEngine';

/**
 * One place to read the shared game objects off the Phaser registry and to write the save to
 * `localStorage`. `BootScene` calls `bindRegistry` before doing anything else; scenes call
 * `persist()` after any change that mutates the save.
 */

let registryRef: Phaser.Data.DataManager | null = null;

export function bindRegistry(reg: Phaser.Data.DataManager): void { registryRef = reg; }

function reg(): Phaser.Data.DataManager {
  if (!registryRef) throw new Error('persist: registry not bound — BootScene must call bindRegistry first');
  return registryRef;
}

export function getContent(): GameContent { return reg().get('content') as GameContent; }
export function getQuiz(): QuizEngine { return reg().get('quiz') as QuizEngine; }
export function getSave(): SaveData | null { return (reg().get('save') as SaveData | null) ?? null; }
export function setSave(s: SaveData): void { reg().set('save', s); }

/** Write the current save to localStorage, if there is one. Best-effort — never throws to the caller. */
export function persist(): void {
  try {
    const s = getSave();
    if (s) SaveManager.save(s, window.localStorage);
  } catch { /* ignore — playtest / non-browser builds */ }
}
