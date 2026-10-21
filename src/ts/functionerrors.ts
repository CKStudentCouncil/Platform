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
 * The SDK's own stopwatch is the second way to hear nothing back. Every call
 * races its request against a 70 s timer, and when the timer wins it rejects
 * with `functions/deadline-exceeded` and the bare message `deadline-exceeded`.
 * An iPhone whose tab was frozen mid-request gets there without the server
 * having done anything wrong. A response that really did say "504" is worded
 * differently — the SDK appends the status, `deadline-exceeded [504]` — so the
 * bare message is the SDK talking about itself, not the backend running out of
 * time, and `[504]` stays reported. That only holds while the timer is longer
 * than the function's own limit; see `UPLOAD_ATTACHMENT_TIMEOUT_MS`.
 *
 * So the match is on the whole message, not on the code alone. A missing or
 * zero status is the part that says nothing was heard back; any other status is
 * a response we should look at.
 */

interface CallableErrorLike {
  code?: unknown;
  message?: unknown;
}

const NO_REPLY_ERRORS: readonly { code: string; message: string }[] = [
  { code: 'functions/internal', message: 'internal [0]' },
  { code: 'functions/deadline-exceeded', message: 'deadline-exceeded' },
];

export function isCallableTransportFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as CallableErrorLike;
  return NO_REPLY_ERRORS.some((noReply) => noReply.code === code && noReply.message === message);
}

/** Appended to whatever the user was told failed, so the toast says what to try. */
export const CALLABLE_TRANSPORT_FAILURE_HINT = '無法連線到伺服器，請確認網路後再試一次';

/**
 * How long the browser waits for `uploadAttachment`, which is allowed 120 s on
 * the server (`firebase/functions/src/index.ts`). The SDK default of 70 s would
 * give up on a slow Drive upload that is still running, and report it as a
 * missing reply when the server had in fact kept working.
 */
export const UPLOAD_ATTACHMENT_TIMEOUT_MS = 130_000;
