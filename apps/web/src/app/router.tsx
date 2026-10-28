import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';

import { SearchFilter } from '@lyra/shared';
import type { QueryClient } from '@tanstack/react-query';

import { meQuery } from '../features/auth/api.ts';
import { AuthLayout } from '../features/auth/auth-layout.tsx';
import { CheckEmailPage } from '../features/auth/check-email-page.tsx';
import { ForgotPasswordPage } from '../features/auth/forgot-password-page.tsx';
import { LoginPage } from '../features/auth/login-page.tsx';
import { RegisterPage } from '../features/auth/register-page.tsx';
import { ResetPasswordPage } from '../features/auth/reset-password-page.tsx';
import { VerifyEmailPage } from '../features/auth/verify-email-page.tsx';
import { HomePage } from '../features/home/home-page.tsx';
import { PlaceholderPage } from '../features/home/placeholder-page.tsx';
import { AlbumPage } from '../features/music/album-page.tsx';
import { ArtistPage } from '../features/music/artist-page.tsx';
import { LikedPage, PlaylistPage } from '../features/music/playlist-page.tsx';
import { SearchPage } from '../features/music/search-page.tsx';
import { DownloadsPage } from '../features/offline/downloads-page.tsx';
import { ProfilePage } from '../features/profile/profile-page.tsx';
import { AppLayout } from './app-layout.tsx';

interface RouterContext {
  queryClient: QueryClient;
}

const TokenSearch = z.object({ token: z.string().catch('') });
const EmailSearch = z.object({ email: z.string().catch('') });
const MusicSearch = z.object({
  q: z.string().catch(''),
  filter: z.enum(SearchFilter).catch(SearchFilter.All),
});

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

async function redirectIfSignedIn({ context }: { context: RouterContext }) {
  if (await context.queryClient.ensureQueryData(meQuery)) {
    throw redirect({ to: '/' });
  }
}

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  component: AuthLayout,
});

const registerRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/register',
  beforeLoad: redirectIfSignedIn,
  component: RegisterPage,
});

const loginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/login',
  beforeLoad: redirectIfSignedIn,
  component: LoginPage,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/forgot-password',
  beforeLoad: redirectIfSignedIn,
  component: ForgotPasswordPage,
});

const checkEmailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/check-email',
  validateSearch: (search) => EmailSearch.parse(search),
  component: CheckEmailPage,
});

const verifyEmailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/verify-email',
  validateSearch: (search) => TokenSearch.parse(search),
  component: VerifyEmailPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/reset-password',
  validateSearch: (search) => TokenSearch.parse(search),
  component: ResetPasswordPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context }) => {
    // The first page asks for an account; signing in is one link away from there.
    if (!(await context.queryClient.ensureQueryData(meQuery))) {
      throw redirect({ to: '/register' });
    }
  },
  component: AppLayout,
});

const homeRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: HomePage });

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/search',
  validateSearch: (search) => MusicSearch.parse(search),
  component: SearchPage,
});

const albumRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/album/$id',
  component: AlbumPage,
});

const artistRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/artist/$id',
  component: ArtistPage,
});

const playlistRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/playlist/$id',
  component: PlaylistPage,
});

const likedRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/liked',
  component: LikedPage,
});

const exploreRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/explore',
  component: () => <PlaceholderPage title="nav.explore" />,
});

const downloadsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/downloads',
  component: DownloadsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/profile',
  component: ProfilePage,
});

const routeTree = rootRoute.addChildren([
  authRoute.addChildren([
    registerRoute,
    loginRoute,
    forgotPasswordRoute,
    checkEmailRoute,
    verifyEmailRoute,
    resetPasswordRoute,
  ]),
  appRoute.addChildren([
    homeRoute,
    searchRoute,
    albumRoute,
    artistRoute,
    playlistRoute,
    likedRoute,
    exploreRoute,
    downloadsRoute,
    profileRoute,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // Going back returns to the same scroll position; the app scrolls inside <main>.
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
