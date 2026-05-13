import Phaser from 'phaser';
import { loadGameContent } from '../content/loadGameContent';
import { ContentError } from '../content/ContentLoader';
import type { AssetManifest } from '../content/types';
import { QuizEngine } from '../systems/QuizEngine';
import { SaveManager } from '../systems/SaveManager';
import { generatePlaceholderTextures } from '../ui/placeholderTextures';
import { bindRegistry } from '../persist';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create(): void {
    bindRegistry(this.registry);
    let content;
    try {
      content = loadGameContent();
    } catch (e) {
      if (e instanceof ContentError) {
        return void this.scene.start('ErrorScene', { issues: e.issues });
      }
      return void this.scene.start('ErrorScene', { message: String(e) });
    }

    if (content.warnings.length) {
      content.warnings.forEach(w => console.warn('[content]', w));
    }

    this.registry.set('content', content.content);
    this.registry.set('quiz', new QuizEngine(content.content.questions, {}));

    const loaded = SaveManager.load(content.content, window.localStorage);
    this.registry.set('save', loaded.ok ? loaded.data : null);
    this.registry.set('saveLoadResult', loaded); // { ok:false, reason:'corrupt' } surfaces on the Title screen

    this.loadRealImagesThenStart(content.content.assets);
  }

  private loadRealImagesThenStart(manifest: AssetManifest): void {
    const imageEntries = Object.entries(manifest.images);
    const audioEntries = Object.entries(manifest.audio ?? {});
    const requestedKeys = new Set(imageEntries.map(([key]) => key));
    const failedKeys = new Set<string>();

    const onFileLoadError = (file: unknown): void => {
      const key = String((file as { key?: unknown }).key ?? '');
      if (requestedKeys.has(key)) {
        failedKeys.add(key);
        console.warn(`[assets] failed to load "${key}" — using generated placeholder`);
      } else {
        // Audio or other non-image asset failed — log and continue gracefully
        console.warn(`[assets] failed to load asset "${key}" — continuing without it`);
      }
    };

    const finish = (): void => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileLoadError);

      for (const [key] of imageEntries) {
        if (!this.textures.exists(key)) failedKeys.add(key);
      }

      generatePlaceholderTextures(this, manifest);

      const unresolved = imageEntries
        .map(([key]) => key)
        .filter(key => !this.textures.exists(key));
      if (unresolved.length) {
        console.warn(`[assets] no texture available after fallback: ${unresolved.join(', ')}`);
      }

      this.scene.start('TitleScene');
    };

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileLoadError);

    let queued = 0;
    for (const [key, url] of imageEntries) {
      if (this.textures.exists(key)) continue;
      this.load.image(key, url);
      queued++;
    }

    for (const [key, url] of audioEntries) {
      if (this.cache.audio.exists(key)) continue;
      this.load.audio(key, url);
      queued++;
    }

    if (queued === 0) {
      finish();
      return;
    }

    this.load.once(Phaser.Loader.Events.COMPLETE, finish);
    this.load.start();
  }
}
