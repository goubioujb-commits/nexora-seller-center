import { getLocale } from './i18n';

export const eur = (cents: number) =>
  new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format((cents || 0) / 100);

// Frais Middleman : 6 %, minimum 5 € (même règle que la base de données)
export const feeCents = (priceCents: number) => Math.max(Math.round(priceCents * 0.06), 500);

export const fmtD = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }) : '—';

export const REGION: Record<string, string> = { europe: 'Europe', global: 'Global', asia: 'Asie' };

export const STATUS: Record<string, [string, string]> = {
  draft: ['Brouillon', '--mut'],
  pending: ['En validation', '--warn'],
  active: ['Active', '--good'],
  reserved: ['Réservée', '--res'],
  sold: ['Vendue', '--sold'],
  rejected: ['Refusée', '--bad'],
  archived: ['Archivée', '--mut'],
};

// Étapes d'une transaction, dans l'ordre (valeurs de l'enum transaction_status)
export const TX_KEYS = ['requested', 'buyer_identified', 'price_agreed', 'middleman_engaged', 'payment_transfer_tracked', 'completed'];
export const TX_LABELS = ['Demande de transaction', 'Acheteur identifié', 'Prix convenu', 'Middleman engagé', 'Paiement et transfert suivis', 'Finalisée'];
export const txStep = (status: string) => Math.max(0, TX_KEYS.indexOf(status));
