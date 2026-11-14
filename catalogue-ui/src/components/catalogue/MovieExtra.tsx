import PlayArrow from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { WatchProgress } from '@/components/catalogue/WatchProgress';
import { isContinueWatching } from '@/lib/continueWatching';
import { formatExtraRuntime, formatExtraSpan } from '@/lib/media';
import { useWatchProgressStore } from '@/stores/useWatchProgressStore';
import type { Extra } from '@/types';

type MovieExtraProps = {
  extra: Extra;
  onPlay: () => void;
};

export function MovieExtra({ extra, onPlay }: MovieExtraProps) {
  const stored = useWatchProgressStore((state) => state.extraProgressById[extra.id]);
  const progress = stored ?? 0;
  const partial = isContinueWatching(progress);
  const watched = partial ? formatExtraSpan(progress, extra.runtime) : '';
  const runtime = partial ? '' : formatExtraRuntime(extra.runtime);

  return (
    <Box sx={{ width: '100%' }}>
      <Button
        fullWidth
        variant="outlined"
        color="inherit"
        startIcon={<PlayArrow />}
        onClick={onPlay}
        sx={{
          justifyContent: 'flex-start',
          borderColor: 'rgba(255,255,255,.18)',
          color: 'white',
          textTransform: 'none',
        }}
      >
        {partial ? (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box component="span" sx={{ display: 'block', textAlign: 'left' }}>
              {extra.title}
            </Box>
            <Box sx={{ mt: 0.75 }}>
              <WatchProgress progress={progress} label={watched} />
            </Box>
          </Box>
        ) : (
          <>
            <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
              {extra.title}
            </Box>
            {runtime ? (
              <Typography component="span" variant="caption" color="text.secondary">
                {runtime}
              </Typography>
            ) : null}
          </>
        )}
      </Button>
    </Box>
  );
}
