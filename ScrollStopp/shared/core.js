// Shared logic used by the service worker and every page.
// No DOM access in here, so the service worker can import it safely.

import { ext } from './api.js';

export const DEFAULT_SITES = [
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'reddit.com',
  'youtube.com/shorts'
];

// Missing keys in ext.storage.sync fall back to these values. Defaults are
// never written on install, so a fresh install can't overwrite a blocklist
// that is still on its way from another device.
export const DEFAULTS = {
  sites: DEFAULT_SITES,
  schedule: { mode: 'always', days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
  minutesPerBlock: 10
};

export const UNBLOCK_SECONDS = 30;

// Peer reviewed studies behind the "Did you know?" facts. Each DOI n (from 1)
// has its text in messages.json as insightTextN and its citation as insightSourceN.
export const INSIGHT_DOIS = [
  '10.1086/691462',          // Ward et al. 2017, Brain Drain
  '10.1145/3544548.3580778', // Chiossi et al. 2023, short videos and prospective memory
  '10.1521/jscp.2018.37.10.751', // Hunt et al. 2018, No More FOMO
  '10.1257/aer.20190658',    // Allcott et al. 2020, Welfare Effects of Social Media
  '10.1089/cyber.2016.0259', // Tromholt 2016, The Facebook Experiment
  '10.1016/j.ypmed.2016.01.001', // Levenson et al. 2016, social media and sleep
  '10.1037/tmb0000059'       // Sharma et al. 2022, doomscrolling scale
];
export const doiUrl = doi => `https://doi.org/${doi}`;
export const BLOCKED_PAGE = '/blocked/blocked.html';
const STATS_DAYS_KEPT = 90;

/* ---------- settings ---------- */

export async function getSettings() {
  const raw = await ext.storage.sync.get(DEFAULTS);
  return {
    sites: cleanSites(raw.sites),
    schedule: cleanSchedule(raw.schedule),
    minutesPerBlock: clampMinutes(raw.minutesPerBlock)
  };
}

export function saveSites(sites) {
  return ext.storage.sync.set({ sites: cleanSites(sites) });
}

export function clampMinutes(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(240, Math.max(1, n)) : DEFAULTS.minutesPerBlock;
}

function cleanSites(list) {
  if (!Array.isArray(list)) return [...DEFAULT_SITES];
  const out = [];
  for (const item of list) {
    const site = normalizeSite(item);
    if (site && !out.includes(site)) out.push(site);
  }
  return out;
}

function cleanSchedule(value) {
  const s = { ...DEFAULTS.schedule, ...(value && typeof value === 'object' ? value : {}) };
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  return {
    mode: s.mode === 'custom' ? 'custom' : 'always',
    days: Array.isArray(s.days) ? [...new Set(s.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))] : [],
    start: time.test(s.start) ? s.start : DEFAULTS.schedule.start,
    end: time.test(s.end) ? s.end : DEFAULTS.schedule.end
  };
}

/* ---------- sites ---------- */

// Turns "https://www.Instagram.com/explore?x=1" into "instagram.com/explore".
// Returns null for anything that is not a plain http(s) website.
export function normalizeSite(input) {
  let raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(raw)) raw = 'https://' + raw;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/\.$/, '').replace(/^www\./, '');
  if (!/^([a-z0-9-]+\.)+[a-z0-9-]{2,}$/.test(host)) return null;
  const path = url.pathname.replace(/[*^|]/g, '').replace(/\/+$/, '');
  return host + path;
}

export function splitSite(site) {
  const i = site.indexOf('/');
  return i < 0 ? { host: site, path: '' } : { host: site.slice(0, i), path: site.slice(i) };
}

// Returns the blocklist entry that covers this URL, or undefined.
// Mirrors what the DNR rules match: the domain, its subdomains, and an
// optional path prefix that ends at a separator.
export function findMatch(urlString, sites) {
  let url;
  try { url = new URL(urlString); } catch { return undefined; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  const h = url.hostname.toLowerCase();
  const p = url.pathname.toLowerCase();
  return sites.find(site => {
    const { host, path } = splitSite(site);
    if (h !== host && !h.endsWith('.' + host)) return false;
    if (!path) return true;
    return p.startsWith(path) && (p.length === path.length || !/[a-z0-9_.%-]/.test(p[path.length]));
  });
}

// Match pattern Chrome needs host access to before a redirect can happen.
export function originPattern(site) {
  const { host } = splitSite(site);
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) ? `*://${host}/*` : `*://*.${host}/*`;
}

export function blockedPath(site) {
  return `${BLOCKED_PAGE}?site=${encodeURIComponent(site)}`;
}

/* ---------- declarativeNetRequest rules ---------- */

export function buildRules(sites) {
  return cleanSites(sites).map((site, i) => {
    const { host, path } = splitSite(site);
    const condition = path
      ? { urlFilter: `||${host}${path}^`, isUrlFilterCaseSensitive: false, resourceTypes: ['main_frame'] }
      : { requestDomains: [host], resourceTypes: ['main_frame'] };
    return {
      id: i + 1,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: blockedPath(site) } },
      condition
    };
  });
}

/* ---------- schedule ---------- */

const toMinutes = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Days use Date#getDay numbering: 0 is Sunday. If end is before start the
// window runs overnight and belongs to the day it started on. Equal start and
// end means "all day" on the chosen days.
export function isScheduleActive(schedule, now = new Date()) {
  if (!schedule || schedule.mode !== 'custom') return true;
  const days = new Set(schedule.days);
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  const day = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  if (start === end) return days.has(day);
  if (start < end) return days.has(day) && minute >= start && minute < end;
  return (days.has(day) && minute >= start) || (days.has((day + 6) % 7) && minute < end);
}

// Earliest moment after `now` when the schedule could flip. Returns null when
// blocking is always on. Midnight is included because "all day" windows and
// day selection change there.
export function nextScheduleChange(schedule, now = new Date()) {
  if (!schedule || schedule.mode !== 'custom') return null;
  let best = null;
  for (let offset = 0; offset <= 8; offset++) {
    for (const hhmm of ['00:00', schedule.start, schedule.end]) {
      const [h, m] = hhmm.split(':').map(Number);
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, h, m, 0, 0);
      if (at > now && (!best || at < best)) best = at;
    }
  }
  return best;
}

/* ---------- stats (ext.storage.local) ---------- */

export function dayKey(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function getStats() {
  const { stats } = await ext.storage.local.get('stats');
  return {
    days: stats?.days && typeof stats.days === 'object' ? stats.days : {},
    totals: stats?.totals && typeof stats.totals === 'object' ? stats.totals : {}
  };
}

export const sumCounts = obj => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);

// The lock stops two blocked tabs that open at once from overwriting each
// other's counts.
export function recordBlock(site) {
  return navigator.locks.request('scrollstopp-stats', async () => {
    const stats = await getStats();
    const today = dayKey();
    const day = stats.days[today] || (stats.days[today] = {});
    day[site] = (day[site] || 0) + 1;
    stats.totals[site] = (stats.totals[site] || 0) + 1;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STATS_DAYS_KEPT);
    const oldest = dayKey(cutoff);
    for (const key of Object.keys(stats.days)) if (key < oldest) delete stats.days[key];
    await ext.storage.local.set({ stats });
    return stats;
  });
}

export function resetStats() {
  return ext.storage.local.remove('stats');
}
