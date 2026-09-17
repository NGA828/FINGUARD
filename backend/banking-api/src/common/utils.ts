import * as crypto from 'crypto';

export const uuid = (): string => crypto.randomUUID();

export const nowIso = (): string => new Date().toISOString();

export const txReference = (): string => {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(100000, 999999);
  return `TX-${year}-${rand}`;
};

export const disputeReference = (): string => {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(1000, 9999);
  return `DP-${year}-${rand}`;
};

export const accountNumber = (seq: number): string =>
  `FG-${String(seq).padStart(8, '0')}`;

/** Début du jour (ISO) pour les cumul quotidiens. */
export const startOfTodayIso = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export const daysAgoIso = (days: number, hour?: number, minute?: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  if (hour !== undefined) d.setHours(hour, minute ?? 0, 0, 0);
  return d.toISOString();
};

/** Formate un montant XAF : 500000 -> "500 000 XAF". */
export const formatXAF = (n: number): string =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} XAF`;
