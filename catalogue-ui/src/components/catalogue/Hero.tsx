import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Media, MediaType } from '@/types';

type HeroProps = {
  featured: Media | null;
  tab: MediaType;
  onPlay: (item: Media) => void;
  onMoreInfo: (item: Media) => void;
};

export function Hero({ featured, tab, onPlay, onMoreInfo }: HeroProps) {
  const backgroundImage = featured
    ? `linear-gradient(90deg, #090a0c 0%, rgba(9,10,12,.82) 30%, rgba(9,10,12,.2) 70%), linear-gradient(0deg, #090a0c 0%, transparent 45%), url(${featured.backdrop || featured.image})`
    : 'linear-gradient(180deg, #090a0c, #12141a)';

  return (
    <Box
      sx={{
        minHeight: { xs: 500, md: 600 },
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        px: { xs: 2, md: 8 },
        pb: { xs: 7, md: 10 },
        pt: 16,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <Box sx={{ position: 'relative', maxWidth: 560 }}>
        {featured ? (
          <Chip
            label={tab === 'movie' ? 'FEATURED MOVIE' : 'FEATURED SERIES'}
            size="small"
            sx={{
              mb: 2,
              background: 'rgba(255,255,255,.12)',
              color: 'white',
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '.12em',
            }}
          />
        ) : null}
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 50, sm: 72, md: 92 },
            lineHeight: 0.92,
            letterSpacing: '-.075em',
            fontWeight: 800,
            mb: 2,
          }}
        >
          {featured?.title ?? 'the catalogue'}
        </Typography>
        <Typography
          color="rgba(255,255,255,.74)"
          sx={{ fontSize: 14, lineHeight: 1.6, maxWidth: 490, mb: 3 }}
        >
          {featured?.description ||
            'Sign in to browse and watch your personal movie library.'}
        </Typography>
        {featured ? (
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={() => onPlay(featured)}
              sx={{ px: 2.5, py: 1.2, fontWeight: 700 }}
            >
              Play
            </Button>
            <Button
              variant="outlined"
              startIcon={<InfoOutlined />}
              onClick={() => onMoreInfo(featured)}
              sx={{
                px: 2.5,
                py: 1.2,
                color: 'white',
                borderColor: 'rgba(255,255,255,.35)',
              }}
            >
              More info
            </Button>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
