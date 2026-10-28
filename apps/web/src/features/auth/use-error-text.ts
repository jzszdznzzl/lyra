import { useTranslation } from 'react-i18next';

import type { ApiError } from '../../lib/api.ts';

export function useErrorText() {
  const { t } = useTranslation();

  return (error: ApiError | null) => (error ? t(`errors.${error}`) : null);
}
