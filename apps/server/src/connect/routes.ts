import { Elysia } from 'elysia';

import { ClientMessage } from '@lyra/shared';
import type { ServerMessage } from '@lyra/shared';

import { authPlugin } from '../auth/plugin.ts';
import type { AppContext } from '../context.ts';
import type { ConnectHub } from './hub.ts';

export function connectRoutes(ctx: AppContext, hub: ConnectHub) {
  return new Elysia().use(authPlugin(ctx)).ws('/connect', {
    isSignedIn: true,
    // Phones park background tabs; a generous timeout avoids dropping them between beats.
    idleTimeout: 120,
    message(ws, raw) {
      const parsed = ClientMessage.safeParse(raw);

      if (!parsed.success) {
        return;
      }

      const userId = ws.data.user.id;

      if (parsed.data.type === 'hello') {
        hub.join(
          userId,
          {
            id: ws.id,
            send: (message: ServerMessage) => ws.send(message),
            close: () => ws.close(),
          },
          parsed.data.device,
        );

        return;
      }

      hub.handle(userId, ws.id, parsed.data);
    },
    close(ws) {
      hub.leave(ws.data.user.id, ws.id);
    },
  });
}
