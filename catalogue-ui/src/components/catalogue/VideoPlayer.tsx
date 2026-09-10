import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import Hls from 'hls.js';
import { useWatchProgressStore } from '@/stores/useWatchProgressStore';

type VideoPlayerProps = {
  src: string;
  mediaId?: number;
};

type TrackOption = {
  id: number;
  label: string;
};

type NativeAudioTrack = {
  enabled: boolean;
  label: string;
  language: string;
};

type NativeAudioTrackList = {
  length: number;
  [index: number]: NativeAudioTrack;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

function playbackPercent(video: HTMLVideoElement): number | null {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return null;
  }

  return (video.currentTime / video.duration) * 100;
}

function getTrackLabel(
  track: { name?: string; label?: string; lang?: string; language?: string },
  index: number,
): string {
  const name = track.name?.trim() || track.label?.trim();
  if (name) {
    return name;
  }

  const language = track.lang?.trim() || track.language?.trim();
  if (language) {
    return language;
  }

  return `Track ${index + 1}`;
}

function getNativeAudioTracks(video: HTMLVideoElement | null): NativeAudioTrackList | undefined {
  return (video as (HTMLVideoElement & { audioTracks?: NativeAudioTrackList }) | null)?.audioTracks;
}

function AudioTrackOverlay({
  hls,
  videoRef,
}: {
  hls: Hls | null;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const [audioTrackIndex, setAudioTrackIndex] = useState(-1);
  const [audioOptions, setAudioOptions] = useState<TrackOption[]>([]);

  const syncTracks = useCallback(() => {
    if (hls) {
      const audioTracks = hls.audioTracks ?? [];
      setAudioTrackIndex(hls.audioTrack ?? -1);
      setAudioOptions(
        audioTracks.map((track, index) => ({
          id: index,
          label: getTrackLabel(track, index),
        })),
      );
      return;
    }

    const audioTracks = getNativeAudioTracks(videoRef.current);
    if (!audioTracks) {
      setAudioTrackIndex(-1);
      setAudioOptions([]);
      return;
    }

    const options: TrackOption[] = [];
    let selected = -1;
    for (let index = 0; index < audioTracks.length; index += 1) {
      const track = audioTracks[index];
      options.push({ id: index, label: getTrackLabel(track, index) });
      if (track.enabled) {
        selected = index;
      }
    }

    setAudioTrackIndex(selected);
    setAudioOptions(options);
  }, [hls, videoRef]);

  useEffect(() => {
    if (hls) {
      syncTracks();
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, syncTracks);
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, syncTracks);

      return () => {
        hls.off(Hls.Events.AUDIO_TRACKS_UPDATED, syncTracks);
        hls.off(Hls.Events.AUDIO_TRACK_SWITCHED, syncTracks);
      };
    }

    const video = videoRef.current;
    const audioTracks = getNativeAudioTracks(video);
    if (!video || !audioTracks) {
      return;
    }

    syncTracks();
    audioTracks.addEventListener('addtrack', syncTracks);
    audioTracks.addEventListener('removetrack', syncTracks);
    audioTracks.addEventListener('change', syncTracks);
    video.addEventListener('loadedmetadata', syncTracks);

    return () => {
      audioTracks.removeEventListener('addtrack', syncTracks);
      audioTracks.removeEventListener('removetrack', syncTracks);
      audioTracks.removeEventListener('change', syncTracks);
      video.removeEventListener('loadedmetadata', syncTracks);
    };
  }, [hls, syncTracks, videoRef]);

  const handleChange = (event: SelectChangeEvent<number>) => {
    const nextId = Number(event.target.value);
    if (Number.isNaN(nextId)) {
      return;
    }

    if (hls) {
      hls.audioTrack = nextId;
      syncTracks();
      return;
    }

    const audioTracks = getNativeAudioTracks(videoRef.current);
    if (!audioTracks) {
      return;
    }

    for (let index = 0; index < audioTracks.length; index += 1) {
      audioTracks[index].enabled = index === nextId;
    }
    syncTracks();
  };

  if (audioOptions.length <= 1) {
    return null;
  }

  const selectedValue = audioOptions.some((option) => option.id === audioTrackIndex)
    ? audioTrackIndex
    : audioOptions[0].id;

  return (
    <Box
      sx={{
        position: 'absolute',
        zIndex: 2,
        top: 8,
        left: 8,
        right: 8,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          borderRadius: 1,
          bgcolor: 'rgba(0, 0, 0, 0.55)',
          color: 'white',
        }}
      >
        <Typography component="span" sx={{ fontSize: 12, opacity: 0.9 }}>
          Audio
        </Typography>
        <FormControl size="small">
          <Select
            value={selectedValue}
            onChange={handleChange}
            sx={{
              minWidth: 140,
              color: 'white',
              fontSize: 14,
              '& .MuiSelect-select': { py: 0.5 },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.4)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.7)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'white',
              },
              '& .MuiSvgIcon-root': { color: 'white' },
            }}
          >
            {audioOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}

export function VideoPlayer({ src, mediaId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hlsEngine, setHlsEngine] = useState<Hls | null>(null);
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
      setHlsEngine(hls);
    } else {
      video.src = src;
      setHlsEngine(null);
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
      setHlsEngine(null);
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, mediaId, setProgress]);

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Box
        component="video"
        ref={videoRef}
        controls
        autoPlay
        sx={{ width: '100%', aspectRatio: '16/9', background: '#000' }}
      />
      <AudioTrackOverlay hls={hlsEngine} videoRef={videoRef} />
    </Box>
  );
}
