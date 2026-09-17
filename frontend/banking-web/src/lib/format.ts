/** Formatage des montants XAF et des dates en français. */

export const formatXAF = (n: number | string | null | undefined): string => {
  const value = Math.round(Number(n ?? 0));
  return `${value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XAF`;
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
