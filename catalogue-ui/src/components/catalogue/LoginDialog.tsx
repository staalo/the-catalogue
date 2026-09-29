import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Close from '@mui/icons-material/Close';
import Login from '@mui/icons-material/Login';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { PasswordField } from '@/components/catalogue/PasswordField';
import { useLogin } from '@/hooks/useAuth';

type LoginDialogProps = {
  open: boolean;
  onClose: () => void;
  onRegister: () => void;
};

type LoginFormValues = {
  identifier: string;
  password: string;
  rememberMe: boolean;
};

const defaultValues: LoginFormValues = {
  identifier: '',
  password: '',
  rememberMe: false,
};

export function LoginDialog({ open, onClose, onRegister }: LoginDialogProps) {
  const login = useLogin();
  const { reset: resetMutation } = login;
  const { control, handleSubmit, reset } = useForm<LoginFormValues>({
    defaultValues,
  });

  useEffect(() => {
    if (!open) {
      reset(defaultValues);
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  const handleClose = () => {
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync({
        email: values.identifier.trim(),
        password: values.password,
        rememberMe: values.rememberMe,
      });
      onClose();
    } catch {
      // Error is rendered from the mutation state.
    }
  });

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
        <Stack spacing={2.5} component="form" onSubmit={onSubmit} noValidate>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
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
          <Controller
            name="identifier"
            control={control}
            rules={{
              validate: (value) =>
                value.trim().length > 0 || 'Email or username is required',
            }}
            render={({ field, fieldState }) => {
              const { ref, ...inputField } = field;
              return (
                <TextField
                  {...inputField}
                  label="Email or username"
                  autoComplete="username"
                  required
                  fullWidth
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                  slotProps={{ input: { ref } }}
                />
              );
            }}
          />
          <Controller
            name="password"
            control={control}
            rules={{ required: 'Password is required' }}
            render={({ field, fieldState }) => (
              <PasswordField
                field={field}
                autoComplete="current-password"
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="rememberMe"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    slotProps={{ input: { ref: field.ref } }}
                  />
                }
                label="Remember me"
                sx={{ alignSelf: 'flex-start', ml: -1, color: 'text.secondary' }}
              />
            )}
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
          <Typography variant="body2" color="text.secondary" textAlign="center">
            New here?{' '}
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={onRegister}
              sx={{
                fontWeight: 700,
                fontSize: 'inherit',
                lineHeight: 'inherit',
                verticalAlign: 'baseline',
              }}
            >
              Create an account
            </Link>
          </Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Your catalogue is private and synced across devices.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
