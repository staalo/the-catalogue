import { useState, type SubmitEvent } from 'react';
import Close from '@mui/icons-material/Close';
import Login from '@mui/icons-material/Login';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useLogin } from '@/hooks/useAuth';

type LoginDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleClose = () => {
    setEmail('');
    setPassword('');
    login.reset();
    onClose();
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await login.mutateAsync({ email, password });
      handleClose();
    } catch {
      // Error is rendered from the mutation state.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slotProps={{
        paper: {
          sx: { background: '#181a1f', color: 'white', p: 1, maxWidth: 400 },
        },
      }}
    >
      <DialogContent>
        <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
          <Stack direction="row" justifyContent="space-between">
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Welcome back
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Sign in to your library.
              </Typography>
            </Box>
            <IconButton onClick={handleClose} aria-label="close">
              <Close />
            </IconButton>
          </Stack>
          {login.isError ? (
            <Alert severity="error">
              {login.error instanceof Error
                ? login.error.message
                : 'Unable to sign in'}
            </Alert>
          ) : null}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<Login />}
            disabled={login.isPending}
            sx={{ py: 1.3, fontWeight: 700 }}
          >
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Your catalogue is private and synced across devices.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}