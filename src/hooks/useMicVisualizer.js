import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * useMicVisualizer - Web Audio API microphone visualization hook
 * Real-time frequency/amplitude visualization during speech
 */
export const useMicVisualizer = () => {
  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);
  const micStreamRef = useRef(null);
  const dataArrayRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [frequencyData, setFrequencyData] = useState(new Uint8Array(0));
  const animationIdRef = useRef(null);

  const startVisualizer = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micStreamRef.current = stream;

      // Initialize Audio Context
      const audioContext =
        audioContextRef.current ||
        new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256; // 128 frequency bins
      analyser.smoothingTimeConstant = 0.8;
      analyzerRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Create data array for frequency values
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      dataArrayRef.current = dataArray;

      setIsActive(true);

      // Animation loop for continuous visualization
      const animate = () => {
        analyser.getByteFrequencyData(dataArray);
        setFrequencyData(new Uint8Array(dataArray));
        animationIdRef.current = requestAnimationFrame(animate);
      };

      animate();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsActive(false);
    }
  }, []);

  const stopVisualizer = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyzerRef.current = null;
    dataArrayRef.current = null;
    setIsActive(false);
    setFrequencyData(new Uint8Array(0));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActive) {
        stopVisualizer();
      }
    };
  }, [isActive, stopVisualizer]);

  // Get average amplitude (0-255)
  const getAmplitude = useCallback(() => {
    if (frequencyData.length === 0) return 0;
    const sum = frequencyData.reduce((a, b) => a + b, 0);
    return Math.round(sum / frequencyData.length);
  }, [frequencyData]);

  return {
    startVisualizer,
    stopVisualizer,
    isActive,
    frequencyData,
    getAmplitude,
  };
};