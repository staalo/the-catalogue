import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const tmdbUrl = 'https://www.themoviedb.org';

type CreditsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function CreditsDialog({ open, onClose }: CreditsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            background: '#181a1f',
            color: 'white',
            p: 1,
            width: 440,
            maxWidth: '100%',
          },
        },
      }}
    >
      <DialogContent>
        <Stack spacing={2.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="h5" fontWeight={700}>
              Credits
            </Typography>
            <IconButton onClick={onClose} aria-label="close">
              <Close />
            </IconButton>
          </Stack>
          <Link
            href={tmdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            underline="none"
            sx={{ alignSelf: 'flex-start', lineHeight: 0 }}
          >
            <Box
              component="img"
              src="/tmdb-logo.svg"
              alt="TMDB"
              sx={{ display: 'block', height: 48, width: 'auto' }}
            />
          </Link>
          <Typography>
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Artwork, release information, genres, cast, crew, and trailers come from TMDB.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
