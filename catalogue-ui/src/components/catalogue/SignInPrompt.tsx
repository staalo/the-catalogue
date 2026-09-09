import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

type SignInPromptProps = {
  onLogin: () => void;
};

export function SignInPrompt({ onLogin }: SignInPromptProps) {
  return (
    <Paper sx={{ p: 3, mb: 4, background: '#17191e' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={2}
      >
        <Box>
          <Typography fontWeight={700}>Sign in to continue watching</Typography>
          <Typography variant="body2" color="text.secondary">
            Your progress and library are waiting for you.
          </Typography>
        </Box>
        <Button variant="contained" onClick={onLogin}>
          Log in
        </Button>
      </Stack>
    </Paper>
  );
}
