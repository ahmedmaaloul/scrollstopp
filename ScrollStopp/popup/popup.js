import { ext } from '../shared/api.js';
import {
  getSettings, getStats, sumCounts, dayKey, findMatch, normalizeSite,
  isScheduleActive, blockedPath, BLOCKED_PAGE
} from '../shared/core.js';
import { t, localize, formatNumber, formatDuration, showStatus } from '../shared/i18n.js';
import { addSite, hasAccess, requestAccess, renderSiteList } from '../shared/sites.js';

localize();

const $ = id => document.getElementById(id);
const els = {
  host: $('currentHost'),
  status: $('currentStatus'),
  noSite: $('noSite'),
  block: $('blockButton'),
  grant: $('grantButton'),
  message: $('status'),
  todayCount: $('todayCount'),
  todaySaved: $('todaySaved'),
  siteList: $('siteList'),
  siteCount: $('siteCount')
};

let settings = await getSettings();
const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
const say = (message, kind) => showStatus(els.message, message, kind);

// Works out what the active tab is: our own blocked page, a website, or
// something we can't block (new tab page, chrome:// pages and so on).
function describeTab() {
  const url = tab?.url || '';
  const blockedPage = ext.runtime.getURL(BLOCKED_PAGE);
  if (url.startsWith(blockedPage)) {
    const site = new URL(url).searchParams.get('site') || '';
    return { kind: 'blockedPage', label: site, entry: site };
  }
  if (!/^https?:\/\//.test(url)) return { kind: 'none' };
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { kind: 'web', label: host, site: normalizeSite(host), entry: findMatch(url, settings.sites) };
}

function setPill(text, kind) {
  els.status.textContent = text;
  els.status.className = `pill pill-${kind}`;
  els.status.hidden = false;
}

async function renderCurrent() {
  const info = describeTab();
  els.block.hidden = els.grant.hidden = els.status.hidden = true;
  els.noSite.hidden = info.kind !== 'none';
  els.host.textContent = info.kind === 'none' ? '' : info.label;
  if (info.kind === 'none') return;

  if (info.kind === 'blockedPage') return setPill(t('popupStatusBlocked'), 'blocked');

  if (!info.entry) {
    setPill(t('popupStatusNotBlocked'), 'ok');
    els.block.hidden = !info.site;
    return;
  }
  if (!(await hasAccess(info.entry))) {
    setPill(t('popupStatusNeedsAccess'), 'warn');
    els.grant.hidden = false;
    return;
  }
  if (!isScheduleActive(settings.schedule)) return setPill(t('popupStatusPaused'), 'warn');
  setPill(t('popupStatusBlocked'), 'blocked');
}

async function renderToday() {
  const stats = await getStats();
  const count = sumCounts(stats.days[dayKey()]);
  els.todayCount.textContent = formatNumber(count);
  els.todaySaved.textContent = t('popupSavedToday', [formatDuration(count * settings.minutesPerBlock)]);
}

async function renderSites() {
  els.siteCount.textContent = formatNumber(settings.sites.length);
  await renderSiteList(els.siteList, settings.sites, say);
}

// After adding a site, wait until the service worker has created its rule,
// then reload the tab so the block shows up right away.
async function reloadWhenRuleIsReady(site) {
  if (!isScheduleActive(settings.schedule)) return;
  const path = blockedPath(site);
  for (let i = 0; i < 30; i++) {
    const rules = await ext.declarativeNetRequest.getDynamicRules();
    if (rules.some(rule => rule.action.redirect?.extensionPath === path)) {
      await ext.tabs.reload(tab.id);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

els.block.addEventListener('click', () => {
  const { site } = describeTab();
  if (!site) return;
  els.block.disabled = true;
  els.block.textContent = t('popupBlocking');
  addSite(site, settings.sites)
    .then(async result => {
      if (result === 'added') {
        say(t('sitesAdded', [site]), 'success');
        await reloadWhenRuleIsReady(site);
      } else if (result === 'exists') {
        say(t('errorAlreadyBlocked', [site]), 'info');
      } else {
        say(t('errorAccessDenied', [site]), 'error');
      }
    })
    .catch(() => say(t('errorSave'), 'error'))
    .finally(() => {
      els.block.disabled = false;
      els.block.textContent = t('popupBlockButton');
    });
});

els.grant.addEventListener('click', () => {
  const { entry } = describeTab();
  if (entry) requestAccess(entry).then(granted => granted && reloadWhenRuleIsReady(entry));
});

$('openOptions').addEventListener('click', () => ext.runtime.openOptionsPage());

ext.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync') {
    settings = await getSettings();
    renderCurrent();
    renderSites();
  }
  if (area === 'sync' || changes.stats) renderToday();
});

const refreshAccess = () => { renderCurrent(); renderSites(); };
ext.permissions.onAdded.addListener(refreshAccess);
ext.permissions.onRemoved.addListener(refreshAccess);

renderCurrent();
renderToday();
renderSites();
