import PlayArrow from '@mui/icons-material/PlayArrow';
import Button from '@mui/material/Button';
import { isContinueWatching } from '@/lib/continueWatching';
import { useWatchProgressStore } from '@/stores/useWatchProgressStore';
import type { Media } from '@/types';

type MoviePlayButtonProps = {
  item: Media | null;
  onPlay: (item: Media) => void;
};

export function MoviePlayButton({ item, onPlay }: MoviePlayButtonProps) {
  const movieId = item?.id;
  const stored = useWatchProgressStore((state) =>
    movieId === undefined ? undefined : state.progressById[movieId],
  );
  const progress = stored ?? item?.progress;

  return (
    <Button
      variant="contained"
      startIcon={<PlayArrow />}
      sx={{ alignSelf: 'flex-start' }}
      onClick={() => {
        if (item) {
          onPlay(item);
        }
      }}
    >
      {isContinueWatching(progress) ? 'Continue' : 'Play now'}
    </Button>
  );
}
