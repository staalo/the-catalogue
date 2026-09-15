import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { Hero } from '@/components/catalogue/Hero';
import { LoginDialog } from '@/components/catalogue/LoginDialog';
import { ProfileDialog } from '@/components/catalogue/ProfileDialog';
import { RegisterDialog } from '@/components/catalogue/RegisterDialog';
import { MediaDetailsDialog } from '@/components/catalogue/MediaDetailsDialog';
import { PlayerDialog } from '@/components/catalogue/PlayerDialog';
import { Rail } from '@/components/catalogue/Rail';
import { SignInPrompt } from '@/components/catalogue/SignInPrompt';
import { AppHeader } from '@/components/layout/AppHeader';
import { useLogout } from '@/hooks/useAuth';
import { useCatalogue } from '@/hooks/useCatalogue';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress';
import { waitForPlaybackProgressUpdates } from '@/api/playback';
import type { Extra, Media, MediaType, PlayerTarget } from '@/types';

export function HomePage() {
  const [tab, setTab] = useState<MediaType>('movie');
  const [selected, setSelected] = useState<Media | null>(null);
  const [player, setPlayer] = useState<PlayerTarget | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: user } = useCurrentUser();
  const playbackProgress = usePlaybackProgress(user?.userName);
  const logout = useLogout();
  const authenticated = Boolean(user?.email);

  useEffect(() => {
    setPlayer(null);
    setSelected(null);
  }, [user?.userName]);

  const { data, featured, isLoading, isError, error } = useCatalogue(
    tab,
    search,
    user?.userName,
  );
  const catalogueLoading = isLoading || !playbackProgress.isHydrated;

  const continueWatching = useMemo(
    () => data.filter((item) => item.progress && item.progress < 95),
    [data],
  );

  const playMedia = (item: Media) => {
    setSelected(null);
    if (!item.url) {
      return;
    }
    setPlayer({
      title: item.title,
      subtitle: [item.year, item.meta].filter(Boolean).join('  ·  '),
      url: item.url,
      mediaId: item.id,
      playbackUser: user?.userName,
    });
  };

  const playExtra = (item: Media, extra: Extra) => {
    setSelected(null);
    setPlayer({
      title: extra.title,
      subtitle: `${item.title} extra · ${extra.runtime}`,
      url: extra.url,
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#090a0c', color: 'white' }}>
      <AppHeader
        search={search}
        onSearchChange={setSearch}
        authenticated={authenticated}
        email={user?.email}
        onLogin={() => setLoginOpen(true)}
        onLogout={() => {
          const playbackUser = user?.userName;
          flushSync(() => {
            setProfileOpen(false);
            setPlayer(null);
          });
          void waitForPlaybackProgressUpdates(playbackUser).then(() => {
            logout.mutate();
          });
        }}
        onProfile={() => setProfileOpen(true)}
      />
      <Hero
        featured={authenticated && !catalogueLoading ? featured : null}
        tab={tab}
        onPlay={playMedia}
        onMoreInfo={setSelected}
      />
      <Box
        component="main"
        sx={{ px: { xs: 2, md: 8 }, maxWidth: 1500, mx: 'auto', mt: -1 }}
      >
        <Tabs
          value={tab}
          onChange={(_, value: MediaType) => setTab(value)}
          sx={{
            mb: 4,
            borderBottom: '1px solid rgba(255,255,255,.1)',
            '& .MuiTab-root': {
              color: 'text.secondary',
              px: 0,
              mr: 4,
              fontWeight: 700,
            },
            '& .Mui-selected': { color: 'white' },
          }}
        >
          <Tab value="movie" label="Movies" />
          <Tab value="tv" label="TV series" />
        </Tabs>
        {!authenticated ? <SignInPrompt onLogin={() => setLoginOpen(true)} /> : null}
        {authenticated && catalogueLoading ? <LinearProgress /> : null}
        {authenticated && isError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error instanceof Error ? error.message : 'Unable to load the catalogue'}
          </Alert>
        ) : null}
        {authenticated && playbackProgress.isError ? (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Playback progress could not be synchronized.
          </Alert>
        ) : null}
        {authenticated && !catalogueLoading ? (
          <>
            <Rail
              title="Continue watching"
              items={continueWatching}
              onOpen={setSelected}
            />
            <Rail
              title={tab === 'movie' ? 'All movies' : 'All series'}
              items={data}
              onOpen={setSelected}
            />
            {tab === 'tv' ? (
              <Typography color="text.secondary">
                TV series are not available from the catalogue service yet.
              </Typography>
            ) : null}
            {tab === 'movie' && data.length === 0 ? (
              <Typography color="text.secondary">
                No movies found in your library.
              </Typography>
            ) : null}
          </>
        ) : null}
      </Box>
      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onRegister={() => {
          setLoginOpen(false);
          setRegisterOpen(true);
        }}
      />
      <RegisterDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onLogin={() => {
          setRegisterOpen(false);
          setLoginOpen(true);
        }}
      />
      <ProfileDialog
        open={profileOpen}
        email={user?.email ?? ''}
        userName={user?.userName ?? ''}
        onClose={() => setProfileOpen(false)}
      />
      <MediaDetailsDialog
        item={selected}
        onClose={() => setSelected(null)}
        onPlay={playMedia}
        onPlayExtra={playExtra}
      />
      <PlayerDialog target={player} onClose={() => setPlayer(null)} />
    </Box>
  );
}
