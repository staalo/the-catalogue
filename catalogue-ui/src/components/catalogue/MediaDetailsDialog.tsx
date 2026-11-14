import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MovieExtra } from '@/components/catalogue/MovieExtra';
import { MoviePlayButton } from '@/components/catalogue/MoviePlayButton';
import { WatchProgress } from '@/components/catalogue/WatchProgress';
import { SeriesDetails } from '@/components/catalogue/SeriesDetails';
import type { SeriesPlayback } from '@/lib/seriesListing';
import type { Extra, Media, TvContentNode } from '@/types';

type MediaDetailsDialogProps = {
  item: Media | null;
  seriesStatus?: 'loading' | 'error' | 'ready';
  seriesNodes?: TvContentNode[];
  onClose: () => void;
  onPlay: (item: Media) => void;
  onPlayExtra: (item: Media, extra: Extra) => void;
  onPlaySeries?: (playback: SeriesPlayback) => void;
};

export function MediaDetailsDialog({
  item,
  seriesStatus = 'loading',
  seriesNodes = [],
  onClose,
  onPlay,
  onPlayExtra,
  onPlaySeries,
}: MediaDetailsDialogProps) {
  const isSeries = item?.type === 'tv';

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      maxWidth={isSeries ? 'md' : 'sm'}
      fullWidth
      slotProps={{
        paper: {
          sx: { background: '#17191e', color: 'white', overflow: 'hidden' },
        },
      }}
    >
      <Box
        sx={{
          height: 250,
          flexShrink: 0,
          backgroundImage: item
            ? `linear-gradient(0deg, #17191e, transparent), url(${item.backdrop || item.image})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <DialogContent sx={{ pt: 0 }}>
        <Stack spacing={1.5}>
          <Typography variant="h4" fontWeight={800}>
            {item?.title}
          </Typography>
          <Typography color="text.secondary">
            {[item?.year, item?.meta].filter(Boolean).join('  ·  ')}
          </Typography>
          {item?.genres.length ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {item.genres.map((genre) => (
                <Chip key={genre.id} label={genre.name} size="small" />
              ))}
            </Stack>
          ) : null}
          <Typography color="rgba(255,255,255,.75)" lineHeight={1.6}>
            {item?.description}
          </Typography>
          {isSeries && item ? (
            <SeriesDetails
              seriesId={item.id}
              seriesTitle={item.title}
              status={seriesStatus}
              nodes={seriesNodes}
              onPlay={(playback) => onPlaySeries?.(playback)}
            />
          ) : (
            <>
              {item ? (
                <WatchProgress
                  movieId={item.id}
                  runtimeMinutes={item.runtimeMinutes}
                  fallback={item.progress}
                />
              ) : null}
              <MoviePlayButton item={item} onPlay={onPlay} />
              {item?.extras?.length ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                    Extras
                  </Typography>
                  <Stack spacing={1}>
                    {item.extras.map((extra) => (
                      <MovieExtra
                        key={extra.id}
                        extra={extra}
                        onPlay={() => onPlayExtra(item, extra)}
                      />
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
