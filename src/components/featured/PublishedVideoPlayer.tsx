"use client";

import { Play } from "lucide-react";
import { type CSSProperties, useRef, useState } from "react";

type PublishedVideoPlayerProps = {
  src: string;
  poster?: string;
  title: string;
  className?: string;
  style?: CSSProperties;
  onReady?: () => void;
};

export function PublishedVideoPlayer({ src, poster, title, className, style, onReady }: PublishedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  async function handlePlayClick() {
    try {
      await videoRef.current?.play();
    } catch {
      setIsPlaying(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        className={className}
        style={style}
        onLoadedMetadata={onReady}
        onCanPlay={onReady}
        onError={onReady}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      {!isPlaying ? (
        <button
          type="button"
          onClick={handlePlayClick}
          aria-label={`Play ${title}`}
          className="absolute left-1/2 top-1/2 z-10 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/55 text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/80"
        >
          <Play size={28} className="ml-1 fill-current" />
        </button>
      ) : null}
    </div>
  );
}
