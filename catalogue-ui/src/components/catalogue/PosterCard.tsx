import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Media } from '@/types';

const WATCHED_PROGRESS = '#3b82f6';

type PosterCardProps = {
  item: Media;
  onOpen: (item: Media) => void;
};

export function PosterCard({ item, onOpen }: PosterCardProps) {
  return (
    <Box
      component="button"
      onClick={() => onOpen(item)}
      sx={{
        p: 0,
        border: 0,
        background: 'transparent',
        textAlign: 'left',
        color: 'inherit',
        cursor: 'pointer',
        minWidth: { xs: 142, sm: 168, md: 190 },
        width: { xs: 142, sm: 168, md: 190 },
        '&:hover .poster': {
          transform: 'scale(1.04)',
          filter: 'brightness(1.1)',
        },
      }}
    >
      <Box
        className="poster"
        sx={{
          position: 'relative',
          aspectRatio: '2/3',
          overflow: 'hidden',
          borderRadius: 1.5,
          background: '#202329',
          transition: 'all .25s ease',
          boxShadow: '0 8px 22px rgba(0,0,0,.22)',
        }}
      >
        {item.image ? (
          <Box
            component="img"
            src={item.image}
            alt={`${item.title} poster`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
        {item.progress ? (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'rgba(255,255,255,.35)',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${item.progress}%`,
                backgroundColor: WATCHED_PROGRESS,
              }}
            />
          </Box>
        ) : null}
      </Box>
      <Typography
        sx={{
          mt: 1.25,
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.title}
      </Typography>
      <Typography sx={{ mt: 0.35, fontSize: 12, color: 'text.secondary' }}>
        {[item.year, item.meta].filter(Boolean).join('  ·  ')}
      </Typography>
    </Box>
  );
}
