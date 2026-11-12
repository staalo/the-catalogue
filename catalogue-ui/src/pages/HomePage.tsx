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
import { useSeriesDetail } from '@/hooks/useSeriesDetail';
import { waitForPlaybackProgressUpdates } from '@/api/playback';
import { isContinueWatching } from '@/lib/continueWatching';
import { genreRailsFor } from '@/lib/genreRails';
import { nextEpisodePlayback } from '@/lib/seriesListing';
import type { Extra, Media, MediaType, PlayerTarget } from '@/types';

export function HomePage() {
  const [tab, setTab] = useState<MediaType>('movie');
  const [selected, setSelected] = useState<Media | null>(null);
  const [player, setPlayer] = useState<PlayerTarget | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: user, displayUser, authPending } = useCurrentUser();
  const shownUser = displayUser ?? user ?? undefined;
  const playbackProgress = usePlaybackProgress(user?.userName);
  const logout = useLogout();
  const authenticated = Boolean(shownUser?.email || shownUser?.userName);
  const sessionKnown = Boolean(user?.email || user?.userName);
  const signedOut = !authPending && !authenticated;

  useEffect(() => {
    setPlayer(null);
    setSelected(null);
  }, [user?.userName]);

  const { data, totalResults, featured, isLoading, isError, error } = useCatalogue(
    tab,
    search,
    user?.userName,
  );
  const detailSeriesId =
    selected?.type === 'tv' ? selected.id : player?.seriesId ?? null;
  const seriesDetail = useSeriesDetail(detailSeriesId, user?.userName);
  const catalogueLoading = isLoading || !playbackProgress.isHydrated;
  const seriesReady =
    selected?.type === 'tv' && seriesDetail.data?.id === selected.id
      ? seriesDetail.data
      : null;

  const continueWatching = useMemo(
    () =>
      data.filter((item) =>
        item.type === 'tv' ? Boolean(item.continueSeries) : isContinueWatching(item.progress),
      ),
    [data],
  );

  const genreRails = useMemo(() => genreRailsFor(data), [data]);

  const playMedia = (item: Media) => {
    if (item.type === 'tv') {
      setSelected(item);
      return;
    }

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
        authPending={authPending}
        email={shownUser?.email}
        userName={shownUser?.userName}
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
        featured={sessionKnown && !catalogueLoading ? featured : null}
        tab={tab}
        signedOut={signedOut}
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
        {signedOut ? <SignInPrompt onLogin={() => setLoginOpen(true)} /> : null}
        {sessionKnown && catalogueLoading ? <LinearProgress /> : null}
        {sessionKnown && isError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error instanceof Error ? error.message : 'Unable to load the catalogue'}
          </Alert>
        ) : null}
        {sessionKnown && playbackProgress.isError ? (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Playback progress could not be synchronized.
          </Alert>
        ) : null}
        {sessionKnown && !catalogueLoading ? (
          <>
            <Rail
              title="Continue watching"
              items={continueWatching}
              onOpen={setSelected}
            />
            <Rail
              title={
                tab === 'movie'
                  ? `All movies (${totalResults})`
                  : `All series (${totalResults})`
              }
              items={data}
              onOpen={setSelected}
            />
            {genreRails.map((rail) => (
              <Rail
                key={rail.genre}
                title={`${rail.genre} (${rail.items.length})`}
                items={rail.items}
                onOpen={setSelected}
              />
            ))}
            {tab === 'tv' && data.length === 0 ? (
              <Typography color="text.secondary">
                No TV series found in your library.
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
        email={shownUser?.email ?? ''}
        userName={shownUser?.userName ?? ''}
        onClose={() => setProfileOpen(false)}
      />
      <MediaDetailsDialog
        item={selected}
        seriesStatus={
          selected?.type !== 'tv'
            ? undefined
            : seriesDetail.isError
              ? 'error'
              : seriesReady
                ? 'ready'
                : 'loading'
        }
        seriesNodes={seriesReady?.nodes}
        onClose={() => setSelected(null)}
        onPlay={playMedia}
        onPlayExtra={playExtra}
        onPlaySeries={(playback) => {
          setSelected(null);
          setPlayer({
            title: playback.title,
            subtitle: playback.subtitle,
            url: playback.url,
            mediaId: playback.nodeId,
            seriesId: playback.seriesId,
            playbackUser: user?.userName,
            playbackKind: 'tv',
          });
        }}
      />
      <PlayerDialog
        target={player}
        onClose={() => setPlayer(null)}
        onEnded={() => {
          if (
            !player
            || player.playbackKind !== 'tv'
            || player.mediaId == null
            || player.seriesId == null
          ) {
            return;
          }

          const detail = seriesDetail.data;
          if (!detail || detail.id !== player.seriesId) {
            return;
          }

          const next = nextEpisodePlayback(
            detail.title ?? '',
            detail.nodes,
            detail.id,
            player.mediaId,
          );
          if (!next) {
            return;
          }

          setPlayer({
            title: next.title,
            subtitle: next.subtitle,
            url: next.url,
            mediaId: next.nodeId,
            seriesId: next.seriesId,
            playbackUser: player.playbackUser,
            playbackKind: 'tv',
          });
        }}
      />
    </Box>
  );
}
