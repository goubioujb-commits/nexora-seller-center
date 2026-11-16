// Paiement des frais Middleman (PayPal)
export const PAYPAL_EMAIL = 'sylver66430@gmail.com';
export const PAYPAL_ME = 'https://www.paypal.me/SylverZz';

// Lien paypal.me avec le montant déjà rempli (ex. https://www.paypal.me/SylverZz/12.00EUR)
export const paypalLink = (amountCents: number, _ref?: string) => `${PAYPAL_ME}/${(amountCents / 100).toFixed(2)}EUR`;
