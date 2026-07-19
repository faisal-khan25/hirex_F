import { useState, useCallback, useRef, useEffect } from 'react';

// Normalise browser-prefixed SpeechRecognition
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/**
 * useSpeechRecognition
 * Wraps the Web Speech API SpeechRecognition interface.
 * Provides startListening(), stopListening(), transcript, interimTranscript, isListening.
 */
export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const isSupported = !!SpeechRecognitionAPI;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const startListening = useCallback(
    (options = {}) => {
      if (!isSupported) {
        setError('SpeechRecognition is not supported in this browser.');
        return;
      }

      // Stop any existing instance first
      recognitionRef.current?.stop();

      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;

      recognition.lang           = options.lang           ?? 'en-US';
      recognition.continuous     = options.continuous     ?? true;
      recognition.interimResults = options.interimResults ?? true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        let finalText   = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        if (finalText) {
          // Append final transcript (space-separated if existing text present)
          setTranscript((prev) =>
            prev ? `${prev} ${finalText}`.trim() : finalText.trim()
          );
        }
        setInterimTranscript(interimText);
      };

      recognition.onerror = (event) => {
        // 'no-speech' and 'aborted' are non-fatal
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(`SpeechRecognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.start();
    },
    [isSupported]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  /** Clear accumulated transcript text. */
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
