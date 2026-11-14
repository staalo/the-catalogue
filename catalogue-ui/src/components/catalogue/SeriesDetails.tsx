import PlayArrow from '@mui/icons-material/PlayArrow';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { WatchProgress } from '@/components/catalogue/WatchProgress';
import {
  listSeriesContent,
  seriesPlayTarget,
  type ExtraRow,
  type SeriesPlayback,
} from '@/lib/seriesListing';
import { useWatchProgressStore } from '@/stores/useWatchProgressStore';
import type { TvContentNode } from '@/types';

type SeriesDetailsProps = {
  seriesId: number;
  seriesTitle: string;
  status: 'loading' | 'error' | 'ready';
  nodes: TvContentNode[];
  onPlay: (playback: SeriesPlayback) => void;
};

const playButtonSx = {
  justifyContent: 'flex-start',
  borderColor: 'rgba(255,255,255,.18)',
  color: 'white',
  textTransform: 'none',
} as const;

export function SeriesDetails({
  seriesId,
  seriesTitle,
  status,
  nodes,
  onPlay,
}: SeriesDetailsProps) {
  const tvProgressEntries = useWatchProgressStore((state) => state.tvProgressEntries);

  if (status === 'loading') {
    return <LinearProgress aria-label="Loading episodes" />;
  }

  if (status === 'error') {
    return <Alert severity="error">This series could not be loaded.</Alert>;
  }

  const content = listSeriesContent(seriesTitle, nodes, seriesId);
  const playTarget = seriesPlayTarget(
    content.seasons.flatMap((season) => season.episodes),
    tvProgressEntries.filter((entry) => entry.seriesId === seriesId),
  );
  if (content.seasons.length === 0 && content.extras.length === 0) {
    return (
      <Typography color="text.secondary">
        No episodes are available for this series.
      </Typography>
    );
  }

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      {playTarget ? (
        <Stack component="section" aria-label="Start watching" spacing={1.5}>
          {playTarget.progress !== undefined ? (
            <WatchProgress
              nodeId={playTarget.playback.nodeId}
              runtime={playTarget.runtime}
              always
            />
          ) : null}
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => onPlay(playTarget.playback)}
            sx={{ alignSelf: 'flex-start' }}
          >
            {playTarget.label}
          </Button>
        </Stack>
      ) : null}
      {content.seasons.map((season) => (
        <Box key={season.nodeId} component="section" aria-label={season.heading}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
            {season.heading}
          </Typography>
          <Stack spacing={2}>
            {season.episodes.map((episode) => (
              <Stack
                key={episode.nodeId}
                component="article"
                aria-label={episode.heading}
                direction="row"
                spacing={1.5}
                sx={{
                  borderBottom: '1px solid rgba(255,255,255,.08)',
                  pb: 1.5,
                }}
              >
                {episode.still ? (
                  <Box
                    component="img"
                    src={episode.still}
                    alt={`${episode.heading} still`}
                    sx={{
                      width: 112,
                      height: 63,
                      objectFit: 'cover',
                      borderRadius: 1,
                      flexShrink: 0,
                      background: '#202329',
                    }}
                  />
                ) : null}
                <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700}>{episode.heading}</Typography>
                  {episode.overview ? (
                    <Typography variant="body2" color="rgba(255,255,255,.75)" lineHeight={1.5}>
                      {episode.overview}
                    </Typography>
                  ) : null}
                  <WatchProgress nodeId={episode.nodeId} runtime={episode.runtime} always />
                  {episode.playback ? (
                    <Button
                      variant="outlined"
                      color="inherit"
                      size="small"
                      startIcon={<PlayArrow />}
                      aria-label={`Play ${episode.heading}`}
                      onClick={() => onPlay(episode.playback as SeriesPlayback)}
                      sx={{ ...playButtonSx, alignSelf: 'flex-start' }}
                    >
                      Play
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            ))}
          </Stack>
          {season.extras.length ? (
            <Box
              role="group"
              aria-labelledby={`season-${season.nodeId}-extras`}
              sx={{ mt: 2.5 }}
            >
              <Typography
                id={`season-${season.nodeId}-extras`}
                component="h3"
                variant="h6"
                fontWeight={800}
                sx={{ mb: 1.5 }}
              >
                {season.heading} - Extras
              </Typography>
              <ExtraList extras={season.extras} onPlay={onPlay} />
            </Box>
          ) : null}
        </Box>
      ))}
      {content.extras.length ? (
        <Box component="section" aria-label="Extras">
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
            Extras
          </Typography>
          <ExtraList extras={content.extras} onPlay={onPlay} />
        </Box>
      ) : null}
    </Stack>
  );
}

function ExtraList({
  extras,
  onPlay,
  depth = 0,
}: {
  extras: ExtraRow[];
  onPlay: (playback: SeriesPlayback) => void;
  depth?: number;
}) {
  return (
    <Stack spacing={1} sx={{ pl: depth ? 2 : 0 }}>
      {extras.map((extra) =>
        extra.playback ? (
          <Box key={extra.nodeId}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<PlayArrow />}
              onClick={() => onPlay(extra.playback as SeriesPlayback)}
              sx={playButtonSx}
            >
              <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
                {extra.title}
              </Box>
              {extra.runtime ? (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1, flexShrink: 0 }}
                >
                  {extra.runtime}
                </Typography>
              ) : null}
            </Button>
            <WatchProgress nodeId={extra.nodeId} runtime={extra.runtime} />
            {extra.children.length ? (
              <ExtraList extras={extra.children} onPlay={onPlay} depth={depth + 1} />
            ) : null}
          </Box>
        ) : (
          <Box key={extra.nodeId}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mt: depth ? 0.5 : 0 }}>
              {extra.title}
            </Typography>
            <ExtraList extras={extra.children} onPlay={onPlay} depth={depth + 1} />
          </Box>
        ),
      )}
    </Stack>
  );
}

