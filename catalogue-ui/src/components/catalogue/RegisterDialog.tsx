import { useState, useEffect } from 'react';
import {
  Controller,
  useForm,
  type ControllerRenderProps,
} from 'react-hook-form';
import Close from '@mui/icons-material/Close';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { PasswordField } from '@/components/catalogue/PasswordField';
import { useRegister } from '@/hooks/useAuth';
import { getPasswordIssue, PASSWORD_HINT, validatePassword } from '@/lib/password';

type RegisterDialogProps = {
  open: boolean;
  onClose: () => void;
  onLogin: () => void;
};

type RegisterFormValues = {
  email: string;
  password: string;
  userName: string;
};

const defaultValues: RegisterFormValues = {
  email: '',
  password: '',
  userName: '',
};

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): true | string {
  const email = value.trim();
  if (!email) {
    return 'Email is required';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'Enter a valid email';
  }
  return true;
}

const passwordSuccessSx = {
  '& .MuiOutlinedInput-root:not(.Mui-error).Mui-focused .MuiOutlinedInput-notchedOutline':
    {
      borderColor: 'success.main',
    },
  '& .MuiInputLabel-root:not(.Mui-error).Mui-focused': {
    color: 'success.main',
  },
};

function RegisterPasswordField({
  field,
}: {
  field: ControllerRenderProps<RegisterFormValues, 'password'>;
}) {
  const [focused, setFocused] = useState(false);
  const passwordIssue = getPasswordIssue(field.value);
  const hasText = field.value.length > 0;
  const isValid = !passwordIssue;
  const showError = !isValid && (focused || hasText);

  return (
    <PasswordField
      field={field}
      autoComplete="new-password"
      error={showError}
      helperText={hasText && passwordIssue ? passwordIssue : PASSWORD_HINT}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        field.onBlur();
        setFocused(false);
      }}
      sx={focused && isValid ? passwordSuccessSx : undefined}
    />
  );
}

export function RegisterDialog({ open, onClose, onLogin }: RegisterDialogProps) {
  const registerUser = useRegister();
  const { reset: resetMutation } = registerUser;
  const { control, handleSubmit, reset, watch } = useForm<RegisterFormValues>({
    defaultValues,
    mode: 'onChange',
  });
  const email = watch('email');
  const password = watch('password');
  const canRegister =
    validateEmail(email) === true && getPasswordIssue(password) === undefined;

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
      await registerUser.mutateAsync({
        email: values.email.trim(),
        password: values.password,
        userName: optionalText(values.userName),
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
        <Stack spacing={2.5} component="form" onSubmit={onSubmit} noValidate>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Create an account
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Create your profile, then jump right in.
              </Typography>
            </Box>
            <IconButton onClick={handleClose} aria-label="close">
              <Close />
            </IconButton>
          </Stack>
          {registerUser.isError ? (
            <Alert severity="error">
              {registerUser.error instanceof Error
                ? registerUser.error.message
                : 'Unable to create an account'}
            </Alert>
          ) : null}
          <Controller
            name="email"
            control={control}
            rules={{ validate: validateEmail }}
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
            rules={{ validate: validatePassword }}
            render={({ field }) => <RegisterPasswordField field={field} />}
          />
          <Controller
            name="userName"
            control={control}
            render={({ field, fieldState }) => {
              const { ref, ...inputField } = field;
              return (
                <TextField
                  {...inputField}
                  label="Username"
                  autoComplete="username"
                  fullWidth
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message ?? 'Optional'}
                  slotProps={{ input: { ref } }}
                />
              );
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<PersonAdd />}
            disabled={!canRegister || registerUser.isPending}
            sx={{ py: 1.3, fontWeight: 700 }}
          >
            {registerUser.isPending ? 'Creating account…' : 'Create account'}
          </Button>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Already have an account?{' '}
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={onLogin}
              sx={{
                fontWeight: 700,
                fontSize: 'inherit',
                lineHeight: 'inherit',
                verticalAlign: 'baseline',
              }}
            >
              Sign in
            </Link>
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
