import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useSpeechSynthesis
 * Wraps the Web Speech API SpeechSynthesis interface.
 * Provides speak(), stop(), and state flags.
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef(null);

  // Check browser support once on mount
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Cancel any speech on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  /**
   * Speak the given text.
   * Options: rate, pitch, volume, voice, onStart, onEnd, onError
   * Returns a Promise that resolves when speech finishes (or rejects on error).
   */
  const speak = useCallback(
    (text, options = {}) => {
      return new Promise((resolve, reject) => {
        if (!isSupported) {
          reject(new Error('SpeechSynthesis not supported in this browser.'));
          return;
        }

        if (!text || !text.trim()) {
          resolve();
          return;
        }

        // Cancel any ongoing speech first
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text.trim());
        utteranceRef.current = utterance;

        // Apply options
        utterance.rate   = options.rate   ?? 1;
        utterance.pitch  = options.pitch  ?? 1;
        utterance.volume = options.volume ?? 1;

        if (options.voice) {
          utterance.voice = options.voice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(false);
          options.onStart?.();
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          utteranceRef.current = null;
          options.onEnd?.();
          resolve();
        };

        utterance.onerror = (event) => {
          setIsSpeaking(false);
          setIsPaused(false);
          utteranceRef.current = null;
          options.onError?.(event);
          // 'interrupted' is not a real error (user navigated away / called stop)
          if (event.error === 'interrupted' || event.error === 'canceled') {
            resolve();
          } else {
            reject(new Error(`SpeechSynthesis error: ${event.error}`));
          }
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [isSupported]
  );

  /** Stop/cancel any current speech immediately. */
  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    utteranceRef.current = null;
  }, [isSupported]);

  /** Pause current speech. */
  const pause = useCallback(() => {
    if (!isSupported || !isSpeaking) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported, isSpeaking]);

  /** Resume paused speech. */
  const resume = useCallback(() => {
    if (!isSupported || !isPaused) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported, isPaused]);

  /** Return all available voices (async — populated after voiceschanged event). */
  const getVoices = useCallback(() => {
    if (!isSupported) return [];
    return window.speechSynthesis.getVoices();
  }, [isSupported]);

  return {
    speak,
    stop,
    pause,
    resume,
    getVoices,
    isSpeaking,
    isPaused,
    isSupported,
  };
}
