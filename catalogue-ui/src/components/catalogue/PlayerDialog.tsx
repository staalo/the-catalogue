import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { VideoPlayer } from '@/components/catalogue/VideoPlayer';
import type { PlayerTarget } from '@/types';

type PlayerDialogProps = {
  target: PlayerTarget | null;
  onClose: () => void;
  onEnded?: () => void;
};

export function PlayerDialog({ target, onClose, onEnded }: PlayerDialogProps) {
  return (
    <Dialog
      open={Boolean(target)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { background: '#090a0c', color: 'white' },
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 1, sm: 2 } }}>
        <Stack spacing={1.5}>
          {target?.url ? (
            <VideoPlayer
              key={`${target.mediaId ?? ''}:${target.url}`}
              src={target.url}
              mediaId={target.mediaId}
              seriesId={target.seriesId}
              playbackUser={target.playbackUser}
              playbackKind={target.playbackKind}
              onEnded={onEnded}
            />
          ) : null}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {target?.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {target?.subtitle}
              </Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="close player">
              <Close />
            </IconButton>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
