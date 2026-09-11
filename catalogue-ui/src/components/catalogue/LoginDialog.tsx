import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Close from '@mui/icons-material/Close';
import Login from '@mui/icons-material/Login';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useLogin } from '@/hooks/useAuth';

type LoginDialogProps = {
  open: boolean;
  onClose: () => void;
  onRegister: () => void;
};

type LoginFormValues = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const defaultValues: LoginFormValues = {
  email: '',
  password: '',
  rememberMe: false,
};

export function LoginDialog({ open, onClose, onRegister }: LoginDialogProps) {
  const login = useLogin();
  const { reset: resetMutation } = login;
  const [showPassword, setShowPassword] = useState(false);
  const { control, handleSubmit, reset } = useForm<LoginFormValues>({
    defaultValues,
  });

  useEffect(() => {
    if (!open) {
      reset(defaultValues);
      resetMutation();
      setShowPassword(false);
    }
  }, [open, reset, resetMutation]);

  const handleClose = () => {
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync({
        email: values.email.trim(),
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
          <Controller
            name="email"
            control={control}
            rules={{
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email',
              },
            }}
            render={({ field, fieldState }) => {
              const { ref, ...inputField } = field;
              return (
                <TextField
                  {...inputField}
                  label="Email"
                  type="email"
                  autoComplete="email"
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
            render={({ field, fieldState }) => {
              const { ref, ...inputField } = field;
              return (
                <TextField
                  {...inputField}
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  fullWidth
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                  slotProps={{
                    input: {
                      ref,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            type="button"
                            aria-label={
                              showPassword ? 'Hide password' : 'Show password'
                            }
                            onClick={() =>
                              setShowPassword((visible) => !visible)
                            }
                            onMouseDown={(event) => event.preventDefault()}
                            edge="end"
                          >
                            {showPassword ? (
                              <VisibilityOffOutlined />
                            ) : (
                              <VisibilityOutlined />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              );
            }}
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
