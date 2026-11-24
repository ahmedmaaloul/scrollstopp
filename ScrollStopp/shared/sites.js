// Adding, removing and listing blocked sites. Shared by popup and options.
import { ext } from './api.js';
import { getSettings, saveSites, findMatch, originPattern, splitSite } from './core.js';
import { t } from './i18n.js';
import { confirmUnblock } from './unblock.js';

export async function hasAccess(site) {
  try {
    return await ext.permissions.contains({ origins: [originPattern(site)] });
  } catch {
    return false;
  }
}

export function requestAccess(site) {
  return ext.permissions.request({ origins: [originPattern(site)] }).catch(() => false);
}

// Call this straight from a click or submit handler: browsers only show the
// permission prompt during a user gesture, so the request goes out first.
// The site is saved right away too, so it sticks even if the popup closes
// while the prompt is open. Resolves to 'exists', 'added' or 'denied'.
export function addSite(site, knownSites) {
  if (findMatch('https://' + site, knownSites)) return Promise.resolve('exists');
  const access = requestAccess(site);
  return (async () => {
    const { sites } = await getSettings();
    const isNew = !findMatch('https://' + site, sites);
    if (isNew) await saveSites([...sites, site]);
    if (await access) return isNew ? 'added' : 'exists';
    if (isNew) await removeSite(site);
    return 'denied';
  })();
}

export async function removeSite(site) {
  const { sites } = await getSettings();
  const remaining = sites.filter(s => s !== site);
  await saveSites(remaining);
  await releaseAccess(site, remaining);
}

// Give back host access we asked for at runtime once no entry needs it.
async function releaseAccess(site, remaining) {
  const pattern = originPattern(site);
  if ((ext.runtime.getManifest().host_permissions || []).includes(pattern)) return;
  const { host } = splitSite(site);
  const related = remaining.some(other => {
    const h = splitSite(other).host;
    return h === host || h.endsWith('.' + host) || host.endsWith('.' + h);
  });
  if (related) return;
  try {
    await ext.permissions.remove({ origins: [pattern] });
  } catch {
    // Covered by a required permission, nothing to give back.
  }
}

// Renders the blocklist with remove buttons (behind the unblock friction
// dialog) and an "Allow" button for entries the browser hasn't granted access to.
export async function renderSiteList(listEl, sites, onMessage) {
  const access = await Promise.all(sites.map(hasAccess));
  const items = sites.map((site, i) => {
    const li = document.createElement('li');
    li.className = 'site-item';

    const name = document.createElement('span');
    name.className = 'site-name';
    name.textContent = site;
    li.append(name);

    if (!access[i]) {
      const badge = document.createElement('span');
      badge.className = 'pill pill-warn';
      badge.textContent = t('listNeedsAccess');
      const grant = document.createElement('button');
      grant.type = 'button';
      grant.className = 'btn btn-small btn-accent';
      grant.textContent = t('listGrant');
      grant.setAttribute('aria-label', t('listGrantAria', [site]));
      grant.addEventListener('click', () => requestAccess(site));
      li.append(badge, grant);
    }

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-small btn-ghost';
    remove.textContent = t('listRemove');
    remove.setAttribute('aria-label', t('listRemoveAria', [site]));
    remove.addEventListener('click', async () => {
      if (!(await confirmUnblock(site))) return;
      await removeSite(site);
      onMessage?.(t('sitesRemoved', [site]), 'info');
    });
    li.append(remove);
    return li;
  });

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'site-empty';
    empty.textContent = t('listEmpty');
    items.push(empty);
  }
  listEl.replaceChildren(...items);
}
