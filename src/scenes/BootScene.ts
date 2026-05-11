import Phaser from 'phaser';
import { loadGameContent } from '../content/loadGameContent';
import { ContentError } from '../content/ContentLoader';
import { QuizEngine } from '../systems/QuizEngine';
import { SaveManager } from '../systems/SaveManager';
import { generatePlaceholderTextures } from '../ui/placeholderTextures';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create(): void {
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

    generatePlaceholderTextures(this, content.content.assets);

    this.scene.start('TitleScene');
  }
}
