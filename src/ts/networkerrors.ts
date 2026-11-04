/**
 * Rejections that belong to the browser's network stack rather than to the app.
 *
 * Firestore keeps a listener open by long-polling: a `Listen/channel` request
 * that sits there for up to a minute and is then aborted and replaced. On a
 * phone — the tab backgrounded, the lift doors closing, Wi-Fi handing over to
 * mobile data — the in-flight request loses instead, and the WebChannel
 * transport drops the rejection on the floor. The SDK does not care; it
 * reconnects and the listener carries on. The browser, though, has an
 * unhandled rejection to announce, and Sentry's `onunhandledrejection` hook
 * dutifully files it: `AbortError: Fetch is aborted` with nothing but
 * `webchannel-wrapper` frames, or on Safari a bare `TypeError: Load failed`
 * with no stack at all. Neither has a fix, a user impact, or anything to act
 * on.
 *
 * What makes them safe to drop is not the wording alone but the pairing: the
 * app's own failures never arrive this way. Every write is awaited inside
 * `try`/`catch` and reported through `notifyError()`, and every listener is
 * observed by `guardListener()` — both of which reach Sentry as *captured*
 * exceptions with context attached, and neither of which this touches. An
 * unhandled rejection that says only "the network did not work" is, by
 * construction, one nobody was waiting on.
 *
 * Sentry's fetch instrumentation still records each failed request as a
 * breadcrumb, so the dropped connection stays visible underneath whatever real
 * failure follows it.
 *
 * The same reasoning covers the browser's IndexedDB. Firebase Auth and the app
 * heartbeat keep their state there, and iOS Safari will abort or delete that
 * database from under a page (low storage, a backgrounded tab, the user
 * clearing site data). The SDK logs `app/idb-open` and carries on with what it
 * has in memory, but the promise its `idb` wrapper left behind rejects
 * unobserved: `UnknownError: Database deleted by request of the user`, or
 * `AbortError: AbortError` (the wrapper's own stand-in for a transaction that
 * aborted without an error). Neither carries a frame in our code, and the page
 * works on regardless.
 */

import type { ErrorEvent } from '@sentry/vue';

/**
 * How each engine words a `fetch()` that did not complete. Anchored, because
 * these are whole messages: an app-level error that merely mentions one of
 * these should still be reported.
 *
 * Safari rejects with a `DOMException`, which Sentry reports as
 * `Error: <name>: <message>` — hence the optional `AbortError: ` prefix on the
 * abort wordings.
 */
const TRANSPORT_FAILURE_PATTERNS: readonly RegExp[] = [
  // Safari, for every network-level fetch failure. No code, no URL, no stack.
  /^Load failed$/i,
  // Chromium.
  /^Failed to fetch$/i,
  // Firefox.
  /^NetworkError when attempting to fetch resource\.?$/i,
  // The request was still open when its abort signal fired. Firestore does
  // this every time it rotates a long-poll.
  /^Fetch is aborted$/i,
  /^The user aborted a request\.?$/i,
  /^(AbortError: )?The operation was aborted\.?$/i,
  /^signal is aborted without reason$/i,
  /^Aborted$/i,
  // IndexedDB, as described above. `AbortError: AbortError` is anchored on
  // both halves so a real `AbortError` carrying a message is still reported.
  /^AbortError: AbortError$/,
  /^UnknownError: Database deleted by request of the user$/,
];

/** Marks the events the browser handed us because nothing else claimed them. */
function isUnhandledRejection(mechanismType: string | undefined): boolean {
  // Sentry namespaces this as `auto.browser.global_handlers.onunhandledrejection`
  // (and `auto.browser.web_worker.onunhandledrejection`), so match the suffix
  // rather than the whole string.
  return mechanismType?.endsWith('onunhandledrejection') === true;
}

/**
 * Whether an event is a network failure that reached Sentry only because no
 * application code was waiting on the promise that produced it.
 */
export function isUnhandledTransportFailure(event: ErrorEvent): boolean {
  // The mechanism and the message have to sit on the same exception, so a
  // chain whose outer error is ours and only whose cause is a network failure
  // is not matched.
  return (event.exception?.values ?? []).some((exception) => {
    if (!isUnhandledRejection(exception.mechanism?.type)) return false;
    const message = exception.value ?? '';
    return TRANSPORT_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
  });
}
