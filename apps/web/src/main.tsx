import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createAppRouter } from './app/router.tsx';
import { startUpdates } from './app/updates.ts';
import { applyTheme, followSystemTheme, readStoredTheme } from './app/theme.ts';
import { initI18n } from './i18n/index.ts';

import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
const router = createAppRouter(queryClient);

async function start() {
  startUpdates();
  applyTheme(readStoredTheme());
  followSystemTheme();
  await initI18n();

  const container = document.getElementById('root');

  if (!container) {
    throw new Error('Missing #root element');
  }

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

start().catch((error: unknown) => {
  console.error(error);
});
