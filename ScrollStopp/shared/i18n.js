// Every visible string comes from _locales/<lang>/messages.json.
// HTML marks elements with data-i18n attributes; this fills them in.

import { ext } from './api.js';

export const t = (key, substitutions) => ext.i18n.getMessage(key, substitutions) || key;

const lang = ext.i18n.getUILanguage();
const numberFormat = new Intl.NumberFormat(lang);
export const formatNumber = n => numberFormat.format(n);

export function localize(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
}

export function formatDuration(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return t('durationMinutes', [formatNumber(minutes)]);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? t('durationHours', [formatNumber(hours), formatNumber(rest)])
    : t('durationHoursOnly', [formatNumber(hours)]);
}

// Small status line helper used by popup and options.
export function showStatus(el, message, kind = 'info') {
  el.textContent = message;
  el.dataset.kind = kind;
  el.hidden = !message;
  clearTimeout(el._timer);
  if (message) el._timer = setTimeout(() => { el.hidden = true; }, 5000);
}
