/**
 * Global Audio Manager for Wedding Background Music
 * - Starts seamlessly upon the guest's tap on "Tap to open" from 00:00
 * - Continues playing smoothly across video playback, page transitions, and scrolling
 * - Muting silences the audio without pausing or resetting track position
 * - Unmuting restores audio at the current position
 * - Stopping immediately pauses and resets playback position to 00:00
 * - Handled via native HTML5 Audio singleton for optimal mobile (iOS Safari & Android Chrome) performance
 */

import { getAssetUrl } from './assets';

export const WEDDING_AUDIO_SRC = getAssetUrl(
  'assets/aistudio/New_song.mp3_a78f27ce.mpeg'
);

class AudioManager {
  private audio: HTMLAudioElement | null = null;
  private isStarted = false;
  private isMuted = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Lazily initialize audio on first browser load if window is available
    if (typeof window !== 'undefined') {
      this.initAudioElement();
    }
  }

  private initAudioElement(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio(WEDDING_AUDIO_SRC);
      this.audio.loop = true;
      this.audio.preload = 'auto';
      this.audio.muted = this.isMuted;
      try {
        this.audio.volume = this.isMuted ? 0 : 0.85;
      } catch {
        // iOS Safari disallows programmatic volume changes
      }

      // Event listeners for state changes
      this.audio.addEventListener('play', () => {
        this.isStarted = true;
        this.notify();
      });

      this.audio.addEventListener('pause', () => {
        this.notify();
      });

      this.audio.addEventListener('error', (e) => {
        console.warn('Background audio element error:', e);
      });
    }
    return this.audio;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Audio listener error:', err);
      }
    });
  }

  getState() {
    return {
      isStarted: this.isStarted,
      isMuted: this.isMuted,
      isPlaying: this.isStarted && !this.isMuted,
    };
  }

  /**
   * Starts background music upon direct user interaction.
   * By default resets to 00:00 so every invitation open plays from the very beginning
   * on the single HTMLAudioElement instance without overlapping audio.
   */
  start(fromBeginning = true) {
    const audio = this.initAudioElement();

    // If already playing smoothly and not explicitly starting from the beginning, do not interrupt
    if (!fromBeginning && this.isStarted && !audio.paused) {
      return;
    }

    try {
      if (fromBeginning) {
        if (!audio.paused) {
          audio.pause();
        }
        try {
          if (audio.readyState >= 1 || audio.currentTime > 0) {
            audio.currentTime = 0;
          }
        } catch {
          // ignore if metadata is not yet loaded; fresh playback starts at 00:00
        }
      }

      audio.muted = this.isMuted;
      try {
        audio.volume = this.isMuted ? 0 : 0.85;
      } catch {
        // iOS Safari disallows programmatic volume changes
      }

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isStarted = true;
            this.notify();
          })
          .catch((err) => {
            console.warn('Audio playback not allowed or interrupted:', err);
            // Gracefully handle without throwing so video and UI remain fully functional
          });
      } else {
        this.isStarted = true;
        this.notify();
      }
    } catch (err) {
      console.warn('Audio start error:', err);
    }
  }

  /**
   * Toggles mute state.
   * Muting silences the music without stopping or resetting playback position.
   * Unmuting restores the music from its current playback position.
   */
  toggleMute() {
    this.isMuted = !this.isMuted;

    if (this.audio) {
      this.audio.muted = this.isMuted;
      try {
        this.audio.volume = this.isMuted ? 0 : 0.85;
      } catch {
        // iOS Safari does not allow programmatically modifying volume property, uses muted instead
      }

      // If invitation is active and audio was paused when unmuting, resume from current position
      if (!this.isMuted && this.isStarted && this.audio.paused) {
        this.start(false);
        return;
      }
    }

    this.notify();
  }

  /**
   * Pauses audio if explicitly needed
   */
  pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    this.notify();
  }

  /**
   * Stops audio immediately and resets playback position to 00:00
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      try {
        if (this.audio.readyState >= 1 || this.audio.currentTime > 0) {
          this.audio.currentTime = 0;
        }
      } catch {
        // ignore
      }
    }
    this.isStarted = false;
    this.notify();
  }
}

export const audioManager = new AudioManager();
