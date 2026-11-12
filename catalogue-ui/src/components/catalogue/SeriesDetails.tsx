import PlayArrow from '@mui/icons-material/PlayArrow';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { listSeriesContent, type ExtraRow, type SeriesPlayback } from '@/lib/seriesListing';
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
  if (status === 'loading') {
    return <LinearProgress aria-label="Loading episodes" />;
  }

  if (status === 'error') {
    return <Alert severity="error">This series could not be loaded.</Alert>;
  }

  const content = listSeriesContent(seriesTitle, nodes, seriesId);
  if (content.seasons.length === 0 && content.extras.length === 0) {
    return (
      <Typography color="text.secondary">
        No episodes are available for this series.
      </Typography>
    );
  }

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
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
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography fontWeight={700} sx={{ flex: 1 }}>
                      {episode.heading}
                    </Typography>
                    {episode.runtime ? (
                      <Typography variant="caption" color="text.secondary">
                        {episode.runtime}
                      </Typography>
                    ) : null}
                  </Stack>
                  {episode.overview ? (
                    <Typography variant="body2" color="rgba(255,255,255,.75)" lineHeight={1.5}>
                      {episode.overview}
                    </Typography>
                  ) : null}
                  <NodeProgress nodeId={episode.nodeId} always />
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
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Season extras
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
            <NodeProgress nodeId={extra.nodeId} />
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

const EPISODE_PROGRESS_TRACK = 'rgba(255,255,255,.2)';
const EPISODE_PROGRESS_WATCHED = '#3b82f6';

function NodeProgress({ nodeId, always = false }: { nodeId: number; always?: boolean }) {
  const stored = useWatchProgressStore((state) => state.tvProgressByNodeId[nodeId]);
  const progress = stored ?? 0;
  if (!always && !stored) {
    return null;
  }

  return (
    <Box
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${progress}% watched`}
      sx={{
        height: 3,
        borderRadius: 1,
        background: EPISODE_PROGRESS_TRACK,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{ height: '100%', width: `${progress}%`, background: EPISODE_PROGRESS_WATCHED }}
      />
    </Box>
  );
}
