/**
 * A callable Cloud Function that never got an answer.
 *
 * `httpsCallable` wraps `fetch()` and, when that rejects, discards the reason
 * and carries on as if the server had replied with HTTP status 0. The error it
 * raises is a `FirebaseError` with code `functions/internal` and the message
 * `internal [0]` — no status line, no response body, and no stack frame that
 * points anywhere but the SDK. The only other trace is the failed `fetch`
 * breadcrumb, which has no `status_code` either.
 *
 * What produces it is outside the app: a phone that lost its connection
 * between the tap and the response (Safari's bare "Load failed"), a school
 * network that drops a request body, a request the platform's front end turned
 * away before any function ran. The SDK says as much in its own comment: it
 * "could be a network error" or an unhandled backend error that never set a
 * CORS header, "and there's no way to know". A backend failure that did reach
 * our code is different — `getAllUsers` and `uploadAttachment` throw
 * `HttpsError`s, which arrive with a real status (`internal [500]`,
 * `permission-denied [403]`) — and is not matched here.
 *
 * So the match is on the whole message, not on the code alone. `[0]` is the
 * part that says nothing was heard back; any other status is a response we
 * should look at.
 */

interface CallableErrorLike {
  code?: unknown;
  message?: unknown;
}

export function isCallableTransportFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as CallableErrorLike;
  return code === 'functions/internal' && message === 'internal [0]';
}

/** Appended to whatever the user was told failed, so the toast says what to try. */
export const CALLABLE_TRANSPORT_FAILURE_HINT = '無法連線到伺服器，請確認網路後再試一次';
