import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { isContinueWatching } from '@/lib/continueWatching';
import { formatRuntimeSpan, formatWatchedSpan } from '@/lib/media';
import { useWatchProgressStore } from '@/stores/useWatchProgressStore';

const PROGRESS_TRACK = 'rgba(255,255,255,.2)';
const PROGRESS_WATCHED = '#3b82f6';

type MovieWatchProgressProps = {
  movieId: number;
  runtimeMinutes?: number;
  fallback?: number;
};

type NodeWatchProgressProps = {
  nodeId: number;
  runtime?: string;
  always?: boolean;
};

type DirectWatchProgressProps = {
  progress: number;
  label?: string;
};

type WatchProgressProps = MovieWatchProgressProps | NodeWatchProgressProps | DirectWatchProgressProps;

function isMovieProgress(props: WatchProgressProps): props is MovieWatchProgressProps {
  return 'movieId' in props;
}

function isNodeProgress(props: WatchProgressProps): props is NodeWatchProgressProps {
  return 'nodeId' in props;
}

export function WatchProgress(props: WatchProgressProps) {
  const movieId = isMovieProgress(props) ? props.movieId : undefined;
  const nodeId = isNodeProgress(props) ? props.nodeId : undefined;
  const movieStored = useWatchProgressStore((state) =>
    movieId === undefined ? undefined : state.progressById[movieId],
  );
  const nodeStored = useWatchProgressStore((state) =>
    nodeId === undefined ? undefined : state.tvProgressByNodeId[nodeId],
  );

  const resolved = resolveWatchProgress(props, movieStored, nodeStored);
  if (!resolved) {
    return null;
  }

  const { progress, label } = resolved;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progress}% watched`}
        sx={{
          flex: 1,
          height: 3,
          borderRadius: 1,
          background: PROGRESS_TRACK,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ height: '100%', width: `${progress}%`, background: PROGRESS_WATCHED }} />
      </Box>
      {label ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {label}
        </Typography>
      ) : null}
    </Stack>
  );
}

function resolveWatchProgress(
  props: WatchProgressProps,
  movieStored: number | undefined,
  nodeStored: number | undefined,
): { progress: number; label: string } | null {
  if (isMovieProgress(props)) {
    const progress = movieStored ?? props.fallback ?? 0;
    if (!isContinueWatching(progress)) {
      return null;
    }

    return { progress, label: formatWatchedSpan(progress, props.runtimeMinutes ?? 0) };
  }

  if (isNodeProgress(props)) {
    if (!props.always && !nodeStored) {
      return null;
    }

    const progress = nodeStored ?? 0;
    return { progress, label: formatRuntimeSpan(progress, props.runtime ?? '') };
  }

  return { progress: props.progress, label: props.label ?? '' };
}
