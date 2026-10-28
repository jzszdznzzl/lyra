import { useTranslation } from 'react-i18next';

/** Stands in for sections that arrive in later phases, so navigation already works. */
export function PlaceholderPage({
  title,
}: {
  title: 'nav.search' | 'nav.explore' | 'nav.downloads';
}) {
  const { t } = useTranslation();

  return (
    <div className="p-7">
      <h1 className="text-3xl font-extrabold tracking-tight">{t(title)}</h1>
    </div>
  );
}
