import PlayArrow from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Extra, Media } from '@/types';

type MediaDetailsDialogProps = {
  item: Media | null;
  onClose: () => void;
  onPlay: (item: Media) => void;
  onPlayExtra: (item: Media, extra: Extra) => void;
};

export function MediaDetailsDialog({
  item,
  onClose,
  onPlay,
  onPlayExtra,
}: MediaDetailsDialogProps) {
  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      maxWidth="sm"
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
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            sx={{ alignSelf: 'flex-start', mt: 1 }}
            onClick={() => {
              if (item) {
                onPlay(item);
              }
            }}
          >
            Play now
          </Button>
          {item?.extras?.length ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Extras
              </Typography>
              <Stack spacing={1}>
                {item.extras.map((extra) => (
                  <Button
                    key={extra.id}
                    variant="outlined"
                    color="inherit"
                    startIcon={<PlayArrow />}
                    onClick={() => onPlayExtra(item, extra)}
                    sx={{
                      justifyContent: 'flex-start',
                      borderColor: 'rgba(255,255,255,.18)',
                      color: 'white',
                      textTransform: 'none',
                    }}
                  >
                    <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
                      {extra.title}
                    </Box>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {extra.runtime}
                    </Typography>
                  </Button>
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
