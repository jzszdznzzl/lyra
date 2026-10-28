import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice, NoticeTone } from '../../ui/notice.tsx';
import { meQuery, verifyEmail } from './api.ts';
import { useErrorText } from './use-error-text.ts';
import type { ApiError } from '../../lib/api.ts';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { token } = useSearch({ from: '/auth/verify-email' });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [error, setError] = useState<ApiError | null>(null);
  // Tokens are single use; StrictMode's double effect must not spend it twice.
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    verifyEmail(token)
      .then(async (result) => {
        if (result.error) {
          setError(result.error);

          return;
        }

        queryClient.setQueryData(meQuery.queryKey, result.data);
        await navigate({ to: '/' });
      })
      .catch(() => {
        setError('unexpected');
      });
  }, [token, navigate, queryClient]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {error ? (
        <>
          <Notice tone={NoticeTone.Error}>{errorText(error)}</Notice>
          <Link to="/login" className="text-sm font-bold text-muted hover:text-text">
            {t('auth.verify.back')}
          </Link>
        </>
      ) : (
        <>
          <span className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <h1 className="text-xl font-extrabold">{t('auth.verify.title')}</h1>
        </>
      )}
    </div>
  );
}
