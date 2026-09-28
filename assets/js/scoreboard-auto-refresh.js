(() => {
  'use strict';

  const LIVE_REFRESH_INTERVAL_MS = 30 * 1000;
  const UPCOMING_REFRESH_INTERVAL_MS = 60 * 1000;

  const liveCount = document.querySelector('[data-summary-live]');
  const upcomingCount = document.querySelector('[data-summary-upcoming]');
  const finalCount = document.querySelector('[data-summary-final]');
  const refreshButton = document.querySelector('[data-refresh]');

  let refreshTimer = null;
  let activeIntervalMs = null;

  function countValue(element) {
    if (!element) return 0;

    const value = Number.parseInt(
      String(element.textContent || '').trim(),
      10
    );

    return Number.isFinite(value) ? value : 0;
  }

  function refreshIntervalMs() {
    const live = countValue(liveCount);
    const upcoming = countValue(upcomingCount);

    if (live > 0) {
      return LIVE_REFRESH_INTERVAL_MS;
    }

    if (upcoming > 0) {
      return UPCOMING_REFRESH_INTERVAL_MS;
    }

    return null;
  }

  function stopAutoRefresh() {
    if (refreshTimer !== null) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }

    activeIntervalMs = null;
  }

  function requestRefresh() {
    if (
      document.hidden ||
      !refreshButton ||
      refreshButton.disabled ||
      refreshIntervalMs() === null
    ) {
      return;
    }

    refreshButton.click();
  }

  function syncAutoRefresh() {
    const intervalMs = refreshIntervalMs();

    if (
      document.hidden ||
      !refreshButton ||
      intervalMs === null
    ) {
      stopAutoRefresh();
      return;
    }

    if (
      refreshTimer !== null &&
      activeIntervalMs === intervalMs
    ) {
      return;
    }

    stopAutoRefresh();

    activeIntervalMs = intervalMs;
    refreshTimer = window.setInterval(
      requestRefresh,
      intervalMs
    );
  }

  const observer = new MutationObserver(syncAutoRefresh);

  [liveCount, upcomingCount, finalCount]
    .filter(Boolean)
    .forEach(element => {
      observer.observe(element, {
        childList: true,
        characterData: true,
        subtree: true
      });
    });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoRefresh();
      return;
    }

    if (refreshIntervalMs() !== null) {
      requestRefresh();
    }

    syncAutoRefresh();
  });

  syncAutoRefresh();
})();
