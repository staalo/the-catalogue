import { useState } from 'react';
import Clear from '@mui/icons-material/Clear';
import Login from '@mui/icons-material/Login';
import Logout from '@mui/icons-material/Logout';
import Search from '@mui/icons-material/Search';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useDebounceCallback } from 'usehooks-ts';

type AppHeaderProps = {
  search: string;
  onSearchChange: (value: string) => void;
  authenticated: boolean;
  authPending: boolean;
  email?: string;
  userName?: string;
  onLogin: () => void;
  onLogout: () => void;
  onProfile: () => void;
  onCredits: () => void;
};

export function AppHeader({
  search,
  onSearchChange,
  authenticated,
  authPending,
  email,
  userName,
  onLogin,
  onLogout,
  onProfile,
  onCredits,
}: AppHeaderProps) {
  const [draft, setDraft] = useState(search);
  const publishSearch = useDebounceCallback(onSearchChange, 300);
  const initial = (email || userName)?.trim().charAt(0).toUpperCase() || 'A';

  const handleSearchChange = (value: string) => {
    setDraft(value);
    publishSearch(value);
  };

  const clearSearch = () => {
    publishSearch.cancel();
    setDraft('');
    onSearchChange('');
  };
  const avatar = (
    <Avatar sx={{ width: 31, height: 31, bgcolor: 'primary.main', fontSize: 13 }}>
      {initial}
    </Avatar>
  );

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        zIndex: 10,
        top: 0,
        left: 0,
        right: 0,
        px: { xs: 2, md: 5 },
        py: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'linear-gradient(180deg, rgba(9,10,12,.96), rgba(9,10,12,.2))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: 20, md: 24 },
          fontWeight: 800,
          letterSpacing: '-.06em',
          whiteSpace: 'nowrap',
        }}
      >
        the{' '}
        <Box component="span" sx={{ color: 'primary.main' }}>
          catalogue
        </Box>
      </Typography>
      <Box sx={{ flex: 1 }} />
      <Button
        color="inherit"
        onClick={onCredits}
        sx={{
          flexShrink: 0,
          minWidth: 0,
          px: 0.5,
          py: 0.25,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          textTransform: 'none',
          color: 'rgba(255,255,255,0.72)',
        }}
      >
        Credits
      </Button>
      <Paper
        component="label"
        sx={{
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          px: 1.25,
          py: 0.15,
          width: { sm: 200, md: 260 },
          background: 'rgba(255,255,255,.1)',
          color: 'white',
        }}
      >
        <Search sx={{ fontSize: 20, color: 'text.secondary' }} />
        <InputBase
          value={draft}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="Search your library"
          sx={{ ml: 1, color: 'white', fontSize: 13, flex: 1 }}
        />
        {draft ? (
          <IconButton
            size="small"
            aria-label="clear search"
            onClick={clearSearch}
            onMouseDown={(event) => event.preventDefault()}
            sx={{ p: 0.25, color: 'text.secondary' }}
          >
            <Clear sx={{ fontSize: 18 }} />
          </IconButton>
        ) : null}
      </Paper>
      {authPending ? (
        <Box aria-hidden sx={{ width: 31, height: 31, flexShrink: 0 }} />
      ) : authenticated ? (
        <IconButton
          color="inherit"
          size="small"
          onClick={onProfile}
          aria-label="open profile"
          sx={{ p: 0 }}
        >
          {avatar}
        </IconButton>
      ) : (
        avatar
      )}
      {authPending ? (
        <Box aria-hidden sx={{ width: 30, height: 30, flexShrink: 0 }} />
      ) : (
        <IconButton
          color="inherit"
          size="small"
          onClick={authenticated ? onLogout : onLogin}
          aria-label={authenticated ? 'log out' : 'log in'}
        >
          {authenticated ? <Logout fontSize="small" /> : <Login fontSize="small" />}
        </IconButton>
      )}
    </Box>
  );
}
