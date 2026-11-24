import { ext } from '../shared/api.js';
import {
  getSettings, getStats, resetStats, sumCounts, dayKey, normalizeSite,
  isScheduleActive, clampMinutes, INSIGHT_DOIS, doiUrl
} from '../shared/core.js';
import { t, localize, formatNumber, formatDuration, showStatus } from '../shared/i18n.js';
import { addSite, hasAccess, renderSiteList } from '../shared/sites.js';

localize();

const $ = id => document.getElementById(id);
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const lang = ext.i18n.getUILanguage();
let settings = await getSettings();

/* ---------- blocklist ---------- */

const sitesStatus = (message, kind) => showStatus($('sitesStatus'), message, kind);

async function renderSites() {
  await renderSiteList($('siteList'), settings.sites, sitesStatus);
  const access = await Promise.all(settings.sites.map(hasAccess));
  $('accessHint').hidden = access.every(Boolean);
}

$('addForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('siteInput');
  const site = normalizeSite(input.value);
  if (!site) return sitesStatus(t('errorInvalidSite'), 'error');
  addSite(site, settings.sites)
    .then(result => {
      if (result === 'added') {
        input.value = '';
        sitesStatus(t('sitesAdded', [site]), 'success');
      } else if (result === 'exists') {
        sitesStatus(t('errorAlreadyBlocked', [site]), 'info');
      } else {
        sitesStatus(t('errorAccessDenied', [site]), 'error');
      }
    })
    .catch(() => sitesStatus(t('errorSave'), 'error'));
});

/* ---------- schedule and minutes ---------- */

const settingsStatus = (message, kind) => showStatus($('settingsStatus'), message, kind);
const saved = () => settingsStatus(t('savedMessage'), 'success');

$('days').replaceChildren(...DAY_ORDER.map(day => {
  const label = document.createElement('label');
  label.className = 'chip';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.value = String(day);
  const text = document.createElement('span');
  text.textContent = t(`day${day}`);
  label.append(box, text);
  return label;
}));

function renderSchedule() {
  const { schedule } = settings;
  for (const radio of document.querySelectorAll('input[name="mode"]')) radio.checked = radio.value === schedule.mode;
  for (const box of $('days').querySelectorAll('input')) box.checked = schedule.days.includes(Number(box.value));
  $('startTime').value = schedule.start;
  $('endTime').value = schedule.end;
  $('customSchedule').disabled = schedule.mode !== 'custom';
  $('noDaysWarning').hidden = schedule.mode !== 'custom' || schedule.days.length > 0;
  renderScheduleState();
}

function renderScheduleState() {
  const active = isScheduleActive(settings.schedule);
  const el = $('scheduleState');
  el.textContent = active ? t('scheduleActiveNow') : t('schedulePausedNow');
  el.classList.toggle('is-paused', !active);
}

async function saveSchedule() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value === 'custom' ? 'custom' : 'always';
  const days = [...$('days').querySelectorAll('input:checked')].map(box => Number(box.value));
  const start = $('startTime').value || settings.schedule.start;
  const end = $('endTime').value || settings.schedule.end;
  await ext.storage.sync.set({ schedule: { mode, days, start, end } });
  saved();
}

for (const el of [...document.querySelectorAll('input[name="mode"]'), $('startTime'), $('endTime')]) {
  el.addEventListener('change', saveSchedule);
}
$('days').addEventListener('change', saveSchedule);

$('minutesInput').addEventListener('change', async event => {
  const minutes = clampMinutes(event.target.value);
  event.target.value = minutes;
  await ext.storage.sync.set({ minutesPerBlock: minutes });
  saved();
});

/* ---------- stats ---------- */

async function renderStats() {
  const stats = await getStats();
  const today = new Date();
  const lastDays = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13 + i);
    return { date, count: sumCounts(stats.days[dayKey(date)]) };
  });
  const total = sumCounts(stats.totals);
  const week = lastDays.slice(-7).reduce((sum, d) => sum + d.count, 0);

  $('statToday').textContent = formatNumber(lastDays[13].count);
  $('statWeek').textContent = formatNumber(week);
  $('statTotal').textContent = formatNumber(total);
  $('statSaved').textContent = formatDuration(total * settings.minutesPerBlock);
  $('statsEmpty').hidden = total > 0;
  $('statsBody').hidden = total === 0;

  const max = Math.max(1, ...lastDays.map(d => d.count));
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  const fullDate = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  $('dayChart').replaceChildren(...lastDays.map(({ date, count }, i) => {
    const bar = document.createElement('div');
    bar.className = 'bar' + (i === 13 ? ' is-today' : '');
    bar.title = t('statsDayTooltip', [fullDate.format(date), formatNumber(count)]);
    const value = document.createElement('span');
    value.className = 'bar-count';
    value.textContent = count ? formatNumber(count) : '';
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.height = `${(count / max) * 100}%`;
    const label = document.createElement('span');
    label.className = 'bar-label';
    label.textContent = weekday.format(date);
    bar.append(value, fill, label);
    return bar;
  }));

  const rows = Object.entries(stats.totals).sort((a, b) => b[1] - a[1]);
  $('siteTable').replaceChildren(...rows.map(([site, count]) => {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = site;
    const value = document.createElement('td');
    value.textContent = formatNumber(count);
    tr.append(name, value);
    return tr;
  }));
}

$('resetStats').addEventListener('click', async () => {
  if (confirm(t('statsResetConfirm'))) await resetStats();
});

/* ---------- research facts ---------- */

$('insightList').replaceChildren(...INSIGHT_DOIS.map((doi, i) => {
  const li = document.createElement('li');
  const text = document.createElement('p');
  text.textContent = t(`insightText${i + 1}`);
  const link = document.createElement('a');
  link.href = doiUrl(doi);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = t(`insightSource${i + 1}`);
  li.append(text, link);
  return li;
}));

/* ---------- live updates ---------- */

ext.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync') {
    settings = await getSettings();
    if (changes.sites) renderSites();
    if (changes.schedule) renderSchedule();
    if (changes.minutesPerBlock) $('minutesInput').value = settings.minutesPerBlock;
    renderStats();
  } else if (changes.stats) {
    renderStats();
  }
});
ext.permissions.onAdded.addListener(renderSites);
ext.permissions.onRemoved.addListener(renderSites);
// Keep the "active right now" line honest while the page stays open.
setInterval(renderScheduleState, 30000);

$('minutesInput').value = settings.minutesPerBlock;
renderSchedule();
renderSites();
renderStats();
