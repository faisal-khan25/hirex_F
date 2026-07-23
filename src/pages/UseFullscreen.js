import { useCallback, useRef, useState, useEffect } from 'react';

/**
 * useFullscreen - Fullscreen API hook
 * Enables immersive fullscreen interview mode
 */
export const useFullscreen = () => {
  const elementRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check fullscreen support
  const isSupported = useCallback(() => {
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
    );
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (!elementRef.current || !isSupported()) return;

    try {
      const elem = elementRef.current;
      const requestFullscreen =
        elem.requestFullscreen ||
        elem.webkitRequestFullscreen ||
        elem.mozRequestFullScreen ||
        elem.msRequestFullscreen;

      if (requestFullscreen) {
        await requestFullscreen.call(elem);
        setIsFullscreen(true);
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  }, [isSupported]);

  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) return;

    try {
      const exitFn =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;

      if (exitFn) {
        await exitFn.call(document);
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return {
    elementRef,
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isSupported: isSupported(),
  };
};