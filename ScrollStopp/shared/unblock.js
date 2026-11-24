// Friction before unblocking: a 30 second countdown AND typing a sentence
// (no pasting). Resolves to true only if the user gets through both.
import { UNBLOCK_SECONDS } from './core.js';
import { t, formatNumber } from './i18n.js';

const simplify = text => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function confirmUnblock(site) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'unblock-dialog';
    dialog.innerHTML = `
      <h2 class="unblock-title"></h2>
      <p class="unblock-intro"></p>
      <div class="unblock-timer">
        <div class="unblock-ring"><span class="unblock-count"></span></div>
        <span class="unblock-timer-label"></span>
      </div>
      <label class="unblock-label">
        <span class="unblock-type-label"></span>
        <strong class="unblock-phrase"></strong>
        <input class="input unblock-input" type="text" autocomplete="off" spellcheck="false">
      </label>
      <div class="unblock-actions">
        <button type="button" class="btn btn-primary unblock-keep"></button>
        <button type="button" class="btn btn-ghost unblock-confirm" disabled></button>
      </div>`;

    const $ = selector => dialog.querySelector(selector);
    const phrase = t('unblockPhrase');
    const input = $('.unblock-input');
    const confirmBtn = $('.unblock-confirm');
    const ring = $('.unblock-ring');
    const count = $('.unblock-count');
    const timerLabel = $('.unblock-timer-label');

    $('.unblock-title').textContent = t('unblockTitle', [site]);
    $('.unblock-intro').textContent = t('unblockIntro');
    $('.unblock-type-label').textContent = t('unblockTypeLabel');
    $('.unblock-phrase').textContent = phrase;
    input.placeholder = t('unblockInputPlaceholder');
    $('.unblock-keep').textContent = t('unblockKeep');
    confirmBtn.textContent = t('unblockConfirm');

    // Wall clock based, so a throttled timer can't make the wait shorter or longer.
    const deadline = Date.now() + UNBLOCK_SECONDS * 1000;
    const update = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      count.textContent = formatNumber(left);
      ring.style.setProperty('--progress', String(1 - left / UNBLOCK_SECONDS));
      timerLabel.textContent = left ? t('unblockSecondsLabel') : t('unblockTimerDone');
      dialog.classList.toggle('is-ready', left === 0);
      confirmBtn.disabled = left > 0 || simplify(input.value) !== simplify(phrase);
      return left;
    };
    const timer = setInterval(() => { if (!update()) clearInterval(timer); }, 250);
    update();

    input.addEventListener('input', update);
    for (const type of ['paste', 'drop']) input.addEventListener(type, event => event.preventDefault());
    $('.unblock-keep').addEventListener('click', () => dialog.close('keep'));
    confirmBtn.addEventListener('click', () => { if (!update() && !confirmBtn.disabled) dialog.close('unblock'); });
    dialog.addEventListener('close', () => {
      clearInterval(timer);
      dialog.remove();
      resolve(dialog.returnValue === 'unblock');
    });

    document.body.append(dialog);
    dialog.showModal();
    $('.unblock-keep').focus();
  });
}
