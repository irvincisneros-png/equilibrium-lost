import type Phaser from 'phaser';

export interface MusicState {
  /** The audio key currently playing, or null. */
  currentKey: string | null;
  /** Volume 0..1 — applies multiplicatively to every play. */
  volume: number;
}

const FADE_MS = 800;

/**
 * Module-level singleton — Phaser sounds live on the Phaser SoundManager (which is global),
 * so we can keep cross-scene state in a plain singleton without a "music scene" hack.
 * Scenes call `MusicManager.play(this, key)` in their `create()` (or wherever transitions happen).
 *
 * Cross-fade: if the requested key differs from the current key, the old sound fades out
 * (over `FADE_MS`) while the new one fades in (over the same duration). If the same key is
 * requested, do nothing (idempotent — safe to call on every scene re-entry).
 *
 * Autoplay: the browser will block playback until a user gesture. Phaser's SoundManager
 * already unlocks on the first interaction (Title screen click / keypress), so subsequent
 * `play()` calls in any scene work without special handling.
 */
export const MusicManager = {
  state: { currentKey: null, volume: 0.6 } as MusicState,
  // Internals (kept here for testability; assigned in play()):
  _current: null as Phaser.Sound.BaseSound | null,
  _fadeTween: null as Phaser.Tweens.Tween | null,

  /** Set the master music volume (0..1). Applies immediately to the current track. */
  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this.state.volume = clamped;
    if (this._current && (this._current as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).isPlaying) {
      (this._current as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(clamped);
    }
  },

  /** Play (or cross-fade to) a track. No-op if `key` matches the current track. */
  play(scene: Phaser.Scene, key: string, opts?: { fadeMs?: number; loop?: boolean }): void {
    // Idempotent: already playing this key
    if (key === this.state.currentKey && this._current &&
        (this._current as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).isPlaying) {
      return;
    }

    // Graceful degradation: audio not loaded
    if (!scene.cache.audio.exists(key)) {
      console.warn(`[MusicManager] audio key "${key}" not in cache — skipping playback`);
      return;
    }

    const fadeMs = opts?.fadeMs ?? FADE_MS;

    // Cancel any in-progress fade tween
    if (this._fadeTween) {
      this._fadeTween.stop();
      this._fadeTween = null;
    }

    // Update state synchronously to de-dupe concurrent calls
    this.state.currentKey = key;

    // Fade out and destroy the old track
    const old = this._current;
    if (old && (old as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).isPlaying) {
      const oldSound = old as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
      scene.tweens.add({
        targets: oldSound,
        volume: 0,
        duration: fadeMs,
        onComplete: () => { oldSound.stop(); oldSound.destroy(); },
      });
    } else if (old) {
      (old as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).destroy();
    }

    // Create and fade in the new track
    const sound = scene.sound.add(key, {
      loop: opts?.loop ?? true,
      volume: 0,
    }) as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

    this._current = sound;
    sound.play();

    this._fadeTween = scene.tweens.add({
      targets: sound,
      volume: this.state.volume,
      duration: fadeMs,
      onComplete: () => { this._fadeTween = null; },
    });
  },

  /** Stop the current track with a fade-out. */
  stop(scene: Phaser.Scene, opts?: { fadeMs?: number }): void {
    const fadeMs = opts?.fadeMs ?? FADE_MS;
    this.state.currentKey = null;

    if (this._fadeTween) {
      this._fadeTween.stop();
      this._fadeTween = null;
    }

    const cur = this._current;
    if (!cur) return;
    this._current = null;

    const sound = cur as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    if (sound.isPlaying) {
      scene.tweens.add({
        targets: sound,
        volume: 0,
        duration: fadeMs,
        onComplete: () => { sound.stop(); sound.destroy(); },
      });
    } else {
      sound.destroy();
    }
  },
};
