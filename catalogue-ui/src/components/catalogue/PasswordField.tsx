import { useState, type ReactNode } from 'react';
import type { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField, { type TextFieldProps } from '@mui/material/TextField';

type PasswordFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  autoComplete: 'current-password' | 'new-password';
  error?: boolean;
  helperText?: ReactNode;
  sx?: TextFieldProps['sx'];
  onFocus?: TextFieldProps['onFocus'];
  onBlur?: TextFieldProps['onBlur'];
};

export function PasswordField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  autoComplete,
  error,
  helperText,
  sx,
  onFocus,
  onBlur,
}: PasswordFieldProps<TFieldValues, TName>) {
  const [showPassword, setShowPassword] = useState(false);
  const { ref, ...inputField } = field;

  return (
    <TextField
      {...inputField}
      label="Password"
      type={showPassword ? 'text' : 'password'}
      autoComplete={autoComplete}
      required
      fullWidth
      error={error}
      helperText={helperText}
      onFocus={onFocus}
      onBlur={onBlur ?? inputField.onBlur}
      sx={sx}
      slotProps={{
        input: {
          ref,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
                onMouseDown={(event) => event.preventDefault()}
                edge="end"
              >
                {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
