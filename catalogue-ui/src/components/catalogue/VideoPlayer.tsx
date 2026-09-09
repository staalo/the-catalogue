import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Hls from 'hls.js';
import { useWatchProgressStore } from '@/stores/useWatchProgressStore';

type VideoPlayerProps = {
  src: string;
  mediaId?: number;
};

function playbackPercent(video: HTMLVideoElement): number | null {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return null;
  }

  return (video.currentTime / video.duration) * 100;
}

export function VideoPlayer({ src, mediaId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const setProgress = useWatchProgressStore((state) => state.setProgress);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) {
      return;
    }

    const isHls = src.includes('.m3u8');
    let hls: Hls | undefined;

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }

    const saveProgress = () => {
      if (!mediaId) {
        return;
      }

      const percent = playbackPercent(video);
      if (percent !== null) {
        setProgress(mediaId, percent);
      }
    };

    const resumeProgress = () => {
      if (!mediaId || !Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }

      const saved = useWatchProgressStore.getState().progressById[mediaId];
      if (saved && saved > 2 && saved < 95) {
        video.currentTime = (saved / 100) * video.duration;
      }
    };

    video.addEventListener('loadedmetadata', resumeProgress);
    video.addEventListener('timeupdate', saveProgress);
    video.addEventListener('pause', saveProgress);

    return () => {
      saveProgress();
      video.removeEventListener('loadedmetadata', resumeProgress);
      video.removeEventListener('timeupdate', saveProgress);
      video.removeEventListener('pause', saveProgress);
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, mediaId, setProgress]);

  return (
    <Box
      component="video"
      ref={videoRef}
      controls
      autoPlay
      sx={{ width: '100%', aspectRatio: '16/9', background: '#000' }}
    />
  );
}
