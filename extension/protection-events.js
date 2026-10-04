'use strict';

var FilumProtectionEvents = (() => {
  const ERROR_CLASSES = Object.freeze({
    NS_ERROR_TRACKING_URI: 'tracking',
    NS_ERROR_SOCIALTRACKING_URI: 'social-tracking',
    NS_ERROR_EMAILTRACKING_URI: 'email-tracking',
    NS_ERROR_FINGERPRINTING: 'fingerprinting',
    NS_ERROR_CRYPTOMINING_URI: 'cryptomining',
    NS_ERROR_MALWARE_URI: 'malware',
    NS_ERROR_PHISHING_URI: 'phishing',
    NS_ERROR_BLOCKED_URI: 'content-blocking',
    NS_ERROR_UNWANTED_URI: 'unwanted-software',
    NS_ERROR_HARMFUL_URI: 'harmful-content'
  });

  const CLASS_LABELS = Object.freeze({
    tracking: 'tracciamento',
    'social-tracking': 'tracciamento social',
    'email-tracking': 'tracciamento email',
    fingerprinting: 'fingerprinting',
    cryptomining: 'cryptomining',
    malware: 'malware',
    phishing: 'phishing',
    'content-blocking': 'protezione contenuti',
    'unwanted-software': 'software indesiderato',
    'harmful-content': 'contenuto dannoso'
  });

  const COOLDOWN_MS = 90_000;

  function normalizeOrigin(value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
      return url.origin;
    } catch (_) {
      return null;
    }
  }

  function classifyError(error) {
    return ERROR_CLASSES[error] || null;
  }

  function create({ browser, openSiteProtection, now = () => Date.now() }) {
    const recentEvents = new Map();
    const pendingNotifications = new Map();
    let sequence = 0;

    function prune(timestamp) {
      for (const [key, at] of recentEvents) {
        if (timestamp - at >= COOLDOWN_MS * 2) recentEvents.delete(key);
      }
    }

    async function handle(details) {
      const eventClass = classifyError(details?.error);
      if (!eventClass || !Number.isSafeInteger(details?.tabId) || details.tabId < 0 ||
          details.frameId !== 0 || details.type === 'main_frame' || details.incognito) return false;

      const documentOrigin = normalizeOrigin(details.documentUrl);
      const requestOrigin = normalizeOrigin(details.originUrl);
      if (documentOrigin && requestOrigin && documentOrigin !== requestOrigin) return false;
      const origin = documentOrigin || requestOrigin;
      if (!origin) return false;

      let tab;
      try {
        tab = await browser.tabs.get(details.tabId);
      } catch (_) {
        return false;
      }
      if (!tab || tab.incognito ||
          (tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default') ||
          normalizeOrigin(tab.url) !== origin) return false;

      const timestamp = now();
      prune(timestamp);
      const dedupeKey = `${tab.id}\u0000${origin}\u0000${eventClass}`;
      const previous = recentEvents.get(dedupeKey);
      if (previous !== undefined && timestamp - previous < COOLDOWN_MS) return false;

      const notificationId = `filum-protection-${tab.id}-${++sequence}`;
      recentEvents.set(dedupeKey, timestamp);
      pendingNotifications.set(notificationId, {
        tabId: tab.id,
        windowId: tab.windowId,
        origin,
        eventClass
      });

      try {
        await browser.notifications.create(notificationId, {
          type: 'basic',
          iconUrl: browser.runtime.getURL('icons/browser.png'),
          title: `FILUM · protezione ${CLASS_LABELS[eventClass]}`,
          message: 'FILUM ha bloccato una richiesta. Clicca per regolare la protezione del sito.'
        });
        return true;
      } catch (_) {
        pendingNotifications.delete(notificationId);
        if (recentEvents.get(dedupeKey) === timestamp) recentEvents.delete(dedupeKey);
        return false;
      }
    }

    async function onClicked(notificationId) {
      const context = pendingNotifications.get(notificationId);
      pendingNotifications.delete(notificationId);
      if (!context) return false;
      await browser.notifications.clear(notificationId).catch(() => {});
      try {
        const tab = await browser.tabs.get(context.tabId);
        if (!tab || tab.incognito || tab.windowId !== context.windowId ||
            (tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default') ||
            normalizeOrigin(tab.url) !== context.origin) return false;
        await openSiteProtection(context);
        return true;
      } catch (_) {
        return false;
      }
    }

    function clearTab(tabId, keepOrigin = null) {
      for (const [notificationId, context] of pendingNotifications) {
        if (context.tabId === tabId && context.origin !== keepOrigin) {
          pendingNotifications.delete(notificationId);
          browser.notifications.clear(notificationId).catch(() => {});
        }
      }
      for (const key of recentEvents.keys()) {
        const [eventTabId, eventOrigin] = key.split('\u0000', 3);
        if (Number(eventTabId) === tabId && eventOrigin !== keepOrigin) recentEvents.delete(key);
      }
    }

    if (browser.webRequest?.onErrorOccurred && browser.notifications?.onClicked &&
        typeof browser.notifications.create === 'function' &&
        typeof browser.notifications.clear === 'function') {
      browser.webRequest.onErrorOccurred.addListener(
        details => { void handle(details); },
        { urls: ['<all_urls>'] }
      );
      browser.notifications.onClicked.addListener(notificationId => onClicked(notificationId));
      browser.notifications.onClosed?.addListener(notificationId => {
        pendingNotifications.delete(notificationId);
      });
    }

    return { handle, onClicked, clearTab };
  }

  return { create, normalizeOrigin, classifyError, classLabel: eventClass => CLASS_LABELS[eventClass] || null };
})();
