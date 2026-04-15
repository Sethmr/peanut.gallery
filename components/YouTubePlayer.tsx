"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  isPaused: () => boolean;
}

interface YouTubePlayerProps {
  videoId: string;
  onStateChange?: (isPlaying: boolean) => void;
}

// Extract video ID from various YouTube URL formats
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtube\.com\/live\/)([^?\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Load YouTube IFrame API script once
let apiLoaded = false;
let apiReady = false;
const apiReadyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady) {
      resolve();
      return;
    }

    apiReadyCallbacks.push(resolve);

    if (!apiLoaded) {
      apiLoaded = true;
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);

      window.onYouTubeIframeAPIReady = () => {
        apiReady = true;
        apiReadyCallbacks.forEach((cb) => cb());
        apiReadyCallbacks.length = 0;
      };
    }
  });
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  ({ videoId, onStateChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const isPausedRef = useRef(false);

    useImperativeHandle(ref, () => ({
      play: () => {
        playerRef.current?.playVideo();
        isPausedRef.current = false;
      },
      pause: () => {
        playerRef.current?.pauseVideo();
        isPausedRef.current = true;
      },
      isPaused: () => isPausedRef.current,
    }));

    const handleStateChange = useCallback(
      (event: YT.OnStateChangeEvent) => {
        const isPlaying = event.data === YT.PlayerState.PLAYING;
        const isPaused =
          event.data === YT.PlayerState.PAUSED ||
          event.data === YT.PlayerState.ENDED;

        if (isPlaying) {
          isPausedRef.current = false;
          onStateChange?.(true);
        } else if (isPaused) {
          isPausedRef.current = true;
          onStateChange?.(false);
        }
      },
      [onStateChange]
    );

    useEffect(() => {
      let mounted = true;

      async function init() {
        await loadYouTubeAPI();
        if (!mounted || !containerRef.current) return;

        // Destroy existing player if video ID changed
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        // Create a div for the player (YouTube replaces it with an iframe)
        const playerDiv = document.createElement("div");
        playerDiv.id = `yt-player-${videoId}`;
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(playerDiv);

        playerRef.current = new YT.Player(playerDiv.id, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
            controls: 1,
            fs: 1,
            playsinline: 1,
          },
          events: {
            onStateChange: handleStateChange,
          },
        });
      }

      init();

      return () => {
        mounted = false;
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    }, [videoId, handleStateChange]);

    return (
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <div
          ref={containerRef}
          className="absolute inset-0 rounded-lg overflow-hidden bg-black"
        />
      </div>
    );
  }
);

YouTubePlayer.displayName = "YouTubePlayer";

export default YouTubePlayer;
