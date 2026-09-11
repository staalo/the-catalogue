import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Close from '@mui/icons-material/Close';
import Edit from '@mui/icons-material/Edit';
import Save from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMediaPaths, useUpdateMediaPaths } from '@/hooks/useMediaPaths';

type ProfileDialogProps = {
  open: boolean;
  email: string;
  userName: string;
  onClose: () => void;
};

type ProfileFormValues = {
  moviesPath: string;
};

const defaultValues: ProfileFormValues = {
  moviesPath: '',
};

export function ProfileDialog({
  open,
  email,
  userName,
  onClose,
}: ProfileDialogProps) {
  const [editing, setEditing] = useState(false);
  const paths = useMediaPaths(open);
  const updatePaths = useUpdateMediaPaths();
  const { reset: resetMutation } = updatePaths;
  const { control, handleSubmit, reset, formState } = useForm<ProfileFormValues>(
    {
      defaultValues,
    },
  );

  useEffect(() => {
    if (!open) {
      setEditing(false);
      reset(defaultValues);
      resetMutation();
      return;
    }

    if (!formState.isDirty) {
      reset({ moviesPath: paths.data?.moviesPath ?? '' });
    }
  }, [open, formState.isDirty, paths.data, reset, resetMutation]);

  const handleCancelEdit = () => {
    setEditing(false);
    reset({ moviesPath: paths.data?.moviesPath ?? '' });
    resetMutation();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await updatePaths.mutateAsync({
        moviesPath: values.moviesPath.trim() || null,
      });
      reset({ moviesPath: saved.moviesPath ?? '' });
      setEditing(false);
    } catch {
      // Error is rendered from the mutation state.
    }
  });

  const moviesPathHelper = editing
    ? 'Local folder for your movie files.'
    : paths.data?.moviesPath
      ? undefined
      : 'Not set. Use Edit to add a movies folder.';

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
        <Stack spacing={2.5} component="form" onSubmit={onSubmit} noValidate>
          <Stack direction="row" justifyContent="space-between">
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
          {paths.isError ? (
            <Alert severity="error">
              {paths.error instanceof Error
                ? paths.error.message
                : 'Unable to load profile'}
            </Alert>
          ) : null}
          {updatePaths.isError ? (
            <Alert severity="error">
              {updatePaths.error instanceof Error
                ? updatePaths.error.message
                : 'Unable to save changes'}
            </Alert>
          ) : null}
          <TextField
            label="Email"
            value={email}
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            label="Username"
            value={userName}
            fullWidth
            slotProps={{ input: { readOnly: true } }}
          />
          <Controller
            name="moviesPath"
            control={control}
            render={({ field, fieldState }) => {
              const { ref, ...inputField } = field;
              return (
                <TextField
                  {...inputField}
                  label="Movies path"
                  autoComplete="off"
                  fullWidth
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message ?? moviesPathHelper}
                  slotProps={{
                    input: { readOnly: !editing, ref },
                  }}
                />
              );
            }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {editing ? (
              <Button
                type="button"
                color="inherit"
                onClick={handleCancelEdit}
                disabled={updatePaths.isPending}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outlined"
                color="inherit"
                startIcon={<Edit />}
                onClick={() => setEditing(true)}
                disabled={paths.isLoading || paths.isError}
                sx={{ borderColor: 'rgba(255,255,255,.18)', color: 'white' }}
              >
                Edit
              </Button>
            )}
            {editing && formState.isDirty ? (
              <Button
                type="submit"
                variant="contained"
                startIcon={<Save />}
                disabled={updatePaths.isPending}
                sx={{ fontWeight: 700 }}
              >
                {updatePaths.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
