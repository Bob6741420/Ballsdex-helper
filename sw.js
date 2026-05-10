/* BallsDex Spawn Commander — Service Worker
   Runs independently of the tab. Fires notifications even when the tab is closed,
   as long as the browser (Chrome/Edge/Firefox) is still running. */

const PRIMING_START    = 720;   // 12 min
const TRIGGERING_START = 900;   // 15 min

let loopId      = null;
let sentTick    = 60;
let sentInterval = 60;
let lastCatch   = 0;

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

/* Page → SW messages */
self.addEventListener('message', ({ data }) => {
  if (!data) return;

  if (data.type === 'SYNC') {
    lastCatch    = data.lastCatch;
    sentInterval = data.sentInterval || 60;
    // Preserve countdown: compute remaining seconds since page last showed a sentence
    if (data.lastSent > 0) {
      const elapsed = (Date.now() - data.lastSent) / 1000;
      sentTick = Math.max(1, Math.ceil(sentInterval - elapsed));
    } else {
      sentTick = 1; // no prior sentence — fire immediately
    }
    startLoop();
  }

  if (data.type === 'STOP') {
    if (loopId) { clearInterval(loopId); loopId = null; }
  }
});

function startLoop() {
  if (loopId) clearInterval(loopId);

  loopId = setInterval(() => {
    const el = Math.floor((Date.now() - lastCatch) / 1000);

    /* Phase transition alerts — fire once on the exact second */
    if (el === PRIMING_START) {
      show('🟡 Priming Phase Started',
           'Open your tool and send a sentence — spawn window opens in 3 min.',
           'phase');
    }

    if (el === TRIGGERING_START) {
      show('🟢 TRIGGERING — SEND NOW!',
           'The ball spawn window is OPEN. Send your sentence immediately.',
           'phase');
    }

    /* Sentence reminders every 60 s while priming / triggering */
    if (el >= PRIMING_START) {
      sentTick--;
      if (sentTick <= 0) {
        const triggering = el >= TRIGGERING_START;
        show(
          triggering ? '🟢 Send Sentence + Command' : '🟡 Send a Sentence',
          'Open your Spawn Commander to copy the next message.',
          'sentence'
        );
        sentTick = sentInterval;
      }
    }
  }, 1000);
}

function show(title, body, tag) {
  self.registration.showNotification(title, {
    body,
    tag:               'bdx-' + tag,
    requireInteraction: tag === 'phase',  /* phase alerts stay until dismissed */
    silent:             false,
    icon:               '',
  });
}
