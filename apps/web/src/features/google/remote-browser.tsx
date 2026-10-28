import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, WheelEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { BrowserServerMessage, BrowserViewport } from '@lyra/shared';
import type { BrowserClientMessage, GoogleAccount } from '@lyra/shared';

import { Button, ButtonVariant } from '../../ui/button.tsx';
import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { useErrorText } from '../auth/use-error-text.ts';
import type { ApiError } from '../../lib/api.ts';

const SPECIAL_KEYS = new Set([
  'Enter',
  'Backspace',
  'Tab',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Escape',
]);
// Well under the server's idle timeout, which frees the browser once the page stops pinging.
const PING_INTERVAL_MS = 15_000;

interface RemoteBrowserProps {
  onLinked: (account: GoogleAccount) => void;
  onCancel: () => void;
}

/** Shows the server's sign-in browser and forwards clicks and typing to it. */
export function RemoteBrowser({ onLinked, onCancel }: RemoteBrowserProps) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const socket = useRef<WebSocket | null>(null);
  // Dead keys (^ ´ ¨), IMEs, mobile keyboards and paste all deliver text to a real text field,
  // so a hidden one collects it instead of guessing characters from key codes.
  const keyboard = useRef<HTMLTextAreaElement>(null);
  const isComposing = useRef(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [text, setText] = useState('');
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/api/google/browser`);
    socket.current = ws;
    let isFinished = false;
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' } satisfies BrowserClientMessage));
      }
    }, PING_INTERVAL_MS);

    ws.addEventListener('close', () => {
      clearInterval(ping);

      // The server ends the session after linking or an error; any other close is a lost link.
      if (!isFinished) {
        setIsDisconnected(true);
      }
    });

    ws.addEventListener('message', (event) => {
      let payload: unknown;

      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }

      const message = BrowserServerMessage.safeParse(payload);

      if (!message.success) {
        return;
      }

      switch (message.data.type) {
        case 'frame': {
          setFrame(`data:image/jpeg;base64,${message.data.data}`);
          break;
        }
        case 'linked': {
          isFinished = true;
          onLinked(message.data.account);
          break;
        }
        case 'error': {
          isFinished = true;
          setError(message.data.error);
          break;
        }
        default: {
          break;
        }
      }
    });

    return () => {
      isFinished = true;
      clearInterval(ping);
      ws.close();
    };
  }, [onLinked, attempt]);

  function reconnect() {
    setIsDisconnected(false);
    setError(null);
    setFrame(null);
    setAttempt((value) => value + 1);
  }

  function send(message: BrowserClientMessage) {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(message));
    }
  }

  function click(event: MouseEvent<HTMLImageElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    send({
      type: 'click',
      x: ((event.clientX - box.left) / box.width) * BrowserViewport.Width,
      y: ((event.clientY - box.top) / box.height) * BrowserViewport.Height,
    });
    keyboard.current?.focus({ preventScroll: true });
  }

  function wheel(event: WheelEvent<HTMLImageElement>) {
    send({ type: 'scroll', deltaY: event.deltaY });
  }

  /** Sends whatever the hidden field collected, then empties it for the next keystrokes. */
  function flushTyped() {
    const field = keyboard.current;

    if (field && field.value !== '') {
      send({ type: 'text', text: field.value });
      field.value = '';
    }
  }

  // Keys that edit or submit go as key presses; everything else arrives through `input`.
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || !SPECIAL_KEYS.has(event.key)) {
      return;
    }

    event.preventDefault();
    flushTyped();
    send({ type: 'key', key: event.key });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice> : null}
      {isDisconnected ? (
        <div className="flex flex-col gap-2">
          <Notice tone={NoticeTone.Error}>{t('google.browser.disconnected')}</Notice>
          <Button variant={ButtonVariant.Secondary} onClick={reconnect}>
            {t('google.browser.reconnect')}
          </Button>
        </div>
      ) : null}
      <div
        onClick={() => keyboard.current?.focus({ preventScroll: true })}
        className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl border border-line bg-white outline-none focus-within:ring-2 focus-within:ring-accent"
        style={{ aspectRatio: `${BrowserViewport.Width} / ${BrowserViewport.Height}` }}
      >
        <textarea
          ref={keyboard}
          aria-label={t('google.browser.typeHere')}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={keyDown}
          onInput={() => {
            if (!isComposing.current) {
              flushTyped();
            }
          }}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onCompositionEnd={() => {
            isComposing.current = false;
            flushTyped();
          }}
          className="pointer-events-none absolute top-0 left-0 size-px resize-none opacity-0"
        />
        {frame ? (
          <img
            src={frame}
            alt=""
            draggable={false}
            onClick={click}
            onWheel={wheel}
            className="size-full cursor-pointer select-none"
          />
        ) : (
          <div className="grid size-full place-items-center bg-surface-2 text-sm text-muted">
            {t('google.browser.connecting')}
          </div>
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send({ type: 'text', text });
          send({ type: 'key', key: 'Enter' });
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('google.browser.typeHere')}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 text-sm outline-none focus:border-accent"
        />
        <Button type="submit" variant={ButtonVariant.Secondary}>
          ↵
        </Button>
      </form>
      <Button variant={ButtonVariant.Ghost} onClick={onCancel}>
        {t('google.browser.cancel')}
      </Button>
    </div>
  );
}
