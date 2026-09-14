/**
 * Recovering from a deploy that happened while someone had the app open.
 *
 * The bundle is split per route and every chunk carries a content hash, so the
 * moment a new version ships the files the currently-loaded `index.html` points
 * at stop existing. A tab that was open across the deploy then fails the next
 * time it lazy-loads anything — navigating to another page, or just rendering a
 * component whose CSS had not been fetched yet. Safari words it
 * "Importing a module script failed", Chrome "Failed to fetch dynamically
 * imported module", and Vite's own preloader "Unable to preload CSS for …".
 *
 * None of these are recoverable in place: the code the tab needs is gone. The
 * fix is to reload, which fetches a fresh `index.html` and with it the new
 * hashes. Guarded by a session flag so a chunk that is genuinely missing — a
 * broken deploy, an ad blocker eating a request — cannot put the tab in a
 * reload loop.
 */

const RELOAD_FLAG = 'cksc:chunk-reload';

const CHUNK_ERROR_PATTERNS: readonly RegExp[] = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Unable to preload CSS/i,
  /'text\/html' is not a valid JavaScript MIME type/i,
];

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = typeof error === 'string' ? error : ((error as { message?: string }).message ?? '');
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) !== null;
  } catch {
    // Private mode / storage disabled. Refuse the reload rather than risk a
    // loop we have no way to detect.
    return true;
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* nothing we can do; alreadyReloaded() has the same failure mode */
  }
}

/** Called once a navigation completes, so the next stale deploy can recover too. */
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* see markReloaded */
  }
}

/**
 * @param target - where to land after the reload. Defaults to the current URL.
 * @returns whether a reload was started (callers should stop what they are doing if so)
 */
export function reloadForNewVersion(target?: string): boolean {
  if (typeof window === 'undefined' || alreadyReloaded()) return false;
  markReloaded();
  console.warn('[chunk] assets missing — reloading for the current deploy.');
  if (target && target !== window.location.pathname + window.location.search) {
    window.location.assign(target);
  } else {
    window.location.reload();
  }
  return true;
}

/**
 * Vite raises `vite:preloadError` when a `<link rel=modulepreload>` target 404s
 * — the "Unable to preload CSS" case, which never reaches the router because
 * nothing awaited it. Left alone, Vite rethrows it as an uncaught error.
 */
export function installPreloadErrorHandler() {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForNewVersion();
  });
}
