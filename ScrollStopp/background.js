// ScrollStopp background script (a service worker in Chrome, Edge and
// Safari, an event page in Firefox). Its only job: turn the settings in
// storage.sync into declarativeNetRequest dynamic rules, and switch
// them on or off when the optional schedule says so.
import { ext } from './shared/api.js';
import { getSettings, buildRules, isScheduleActive, nextScheduleChange } from './shared/core.js';

const ALARM = 'schedule';

async function syncRules() {
  const { sites, schedule } = await getSettings();
  const now = new Date();
  const addRules = isScheduleActive(schedule, now) ? buildRules(sites) : [];
  const existing = await ext.declarativeNetRequest.getDynamicRules();
  await ext.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(rule => rule.id),
    addRules
  });

  const next = nextScheduleChange(schedule, now);
  if (next) await ext.alarms.create(ALARM, { when: next.getTime() });
  else await ext.alarms.clear(ALARM);
}

// Run syncs one after another so overlapping updates never fight over rule ids.
let queue = Promise.resolve();
function scheduleSync() {
  queue = queue.then(syncRules).catch(error => console.error('ScrollStopp: rule sync failed', error));
  return queue;
}

ext.runtime.onInstalled.addListener(scheduleSync);
ext.runtime.onStartup.addListener(scheduleSync);
ext.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM) scheduleSync();
});
ext.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.sites || changes.schedule)) scheduleSync();
});
