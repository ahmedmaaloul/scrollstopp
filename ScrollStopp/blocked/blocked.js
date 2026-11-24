import { ext } from '../shared/api.js';
import { getSettings, getStats, recordBlock, sumCounts, dayKey, INSIGHT_DOIS, doiUrl } from '../shared/core.js';
import { t, localize, formatNumber, formatDuration } from '../shared/i18n.js';

localize();

const $ = id => document.getElementById(id);
const site = (new URLSearchParams(location.search).get('site') || '').slice(0, 200);
const heading = t('blockedHeading', [site || t('blockedUnknownSite')]);
$('heading').textContent = heading;
document.title = heading;

/* ---------- motivating line ---------- */

const lines = [];
for (let n = 1; ext.i18n.getMessage(`motivation${n}`); n++) lines.push(ext.i18n.getMessage(`motivation${n}`));
$('motivation').textContent = lines[Math.floor(Math.random() * lines.length)] || '';

/* ---------- a research fact, with its source ---------- */

const insight = Math.floor(Math.random() * INSIGHT_DOIS.length);
$('insightText').textContent = t(`insightText${insight + 1}`);
$('insightLink').textContent = t(`insightSource${insight + 1}`);
$('insightLink').href = doiUrl(INSIGHT_DOIS[insight]);

/* ---------- memes ---------- */

const img = $('memeImage');
img.alt = t('memeAlt');
let memes = [];
let current = null;
let next = null;
const preloaded = new Map();

const memeUrl = file => ext.runtime.getURL('memes/' + file.split('/').map(encodeURIComponent).join('/'));

async function loadMemeList() {
  try {
    const response = await fetch(ext.runtime.getURL('memes/memes.json'));
    const data = await response.json();
    // memes.json is { "all": [...], "en": [...], "de": [...] }: images in memes/
    // show in every language, images in memes/<lang>/ only in that language.
    // A plain array (older format) counts as "all".
    const list = Array.isArray(data) ? data : [...(data?.all || []), ...(data?.[t('localeCode')] || [])];
    return [...new Set(list.filter(file => typeof file === 'string' && /\.(jpe?g|png|gif|webp)$/i.test(file)))];
  } catch {
    return [];
  }
}

// Random meme that is not `exclude`, unless it's the only one there is.
function pickOther(exclude) {
  const pool = memes.filter(file => file !== exclude);
  const from = pool.length ? pool : memes;
  return from[Math.floor(Math.random() * from.length)] ?? null;
}

function preload(file) {
  if (!file || preloaded.has(file)) return;
  const image = new Image();
  image.src = memeUrl(file);
  image.decode().catch(() => {});
  preloaded.set(file, image);
}

function show(file) {
  current = file;
  $('memeEmpty').hidden = true;
  img.hidden = false;
  img.src = memeUrl(file);
  img.style.animation = 'none';
  void img.offsetWidth; // restart the pop in animation
  img.style.animation = '';
  next = memes.length > 1 ? pickOther(file) : null;
  preload(next);
  $('anotherMeme').hidden = !next;
  // Remember what we showed and what comes next, so the next blocked page
  // never repeats this meme and can start with the one already queued.
  ext.storage.local.set({ memeState: { last: current, next } });
}

function showEmpty() {
  img.hidden = true;
  img.removeAttribute('src');
  $('memeEmpty').hidden = false;
  $('anotherMeme').hidden = true;
  $('memeFrame').removeAttribute('aria-busy');
}

img.addEventListener('load', () => $('memeFrame').removeAttribute('aria-busy'));
img.addEventListener('error', () => {
  if (!img.getAttribute('src')) return;
  // Listed in memes.json but missing or broken: skip it.
  memes = memes.filter(file => file !== current);
  preloaded.delete(current);
  if (!memes.length) return showEmpty();
  show(next && memes.includes(next) ? next : pickOther(null));
});
$('anotherMeme').addEventListener('click', () => { if (next) show(next); });

async function startMemes() {
  const [list, { memeState }] = await Promise.all([loadMemeList(), ext.storage.local.get('memeState')]);
  memes = list;
  if (!memes.length) return showEmpty();
  const queued = memeState?.next;
  const first = queued && memes.includes(queued) && queued !== memeState.last ? queued : pickOther(memeState?.last);
  show(first);
}

/* ---------- stats and time saved ---------- */

async function startStats() {
  // Count real visits only: not reloads, back/forward or someone framing the page.
  const nav = performance.getEntriesByType('navigation')[0];
  const fresh = site && window.top === window && (!nav || nav.type === 'navigate');
  const [settings, stats] = await Promise.all([getSettings(), fresh ? recordBlock(site) : getStats()]);
  const minutes = settings.minutesPerBlock;
  $('savedToday').textContent = formatDuration(sumCounts(stats.days[dayKey()]) * minutes);
  $('savedTotal').textContent = formatDuration(sumCounts(stats.totals) * minutes);
  $('savedNote').textContent = t('blockedSavedNote', [formatNumber(minutes)]);
}

/* ---------- buttons ---------- */

$('closeTab').addEventListener('click', async () => {
  const tab = await ext.tabs.getCurrent();
  if (tab?.id != null) ext.tabs.remove(tab.id);
  else window.close();
});
$('openSettings').addEventListener('click', event => {
  event.preventDefault();
  ext.runtime.openOptionsPage();
});

startMemes();
startStats();
