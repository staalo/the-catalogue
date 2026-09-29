import Close from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type ProfileDialogProps = {
  open: boolean;
  email: string;
  userName: string;
  onClose: () => void;
};

export function ProfileDialog({
  open,
  email,
  userName,
  onClose,
}: ProfileDialogProps) {
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
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Your profile
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Account details for this library.
              </Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="close">
              <Close />
            </IconButton>
          </Stack>
          <TextField
            disabled
            label="Email"
            value={email}
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            disabled
            label="Username"
            value={userName}
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
