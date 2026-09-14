import { watch } from 'vue';
import type { FirestoreError } from 'firebase/firestore';
import * as Sentry from '@sentry/vue';

/**
 * Firestore codes that mean "`firestore.rules` said no".
 *
 * These are a designed outcome of the rules rather than a malfunction: a
 * listener that is still attached while the user signs out, a token that is
 * mid-refresh, or a page opened by a role that is not allowed to read it all
 * produce one. They are worth a breadcrumb, but reporting them as exceptions
 * only buries the failures that do need a human.
 */
const RULES_DENIAL_CODES: readonly string[] = ['permission-denied', 'unauthenticated'];

function isFirestoreError(error: unknown): error is FirestoreError {
  return typeof error === 'object' && error !== null && typeof (error as FirestoreError).code === 'string';
}

/**
 * Deal with a failure coming out of a realtime listener.
 *
 * Every listener needs one of these. Firestore surfaces a denied `onSnapshot`
 * as a rejected promise, and VueFire deliberately re-rejects the promise it
 * hands back (it records the reason on `.error` and then returns
 * `Promise.reject(reason)`), so a listener nobody catches becomes an
 * *unhandled* rejection. The browser then hands it to Sentry's
 * `onunhandledrejection` hook, which reports it with no stack trace beyond the
 * Firestore internals and no indication of which listener was at fault.
 *
 * @param context - which listener failed, e.g. `'MainLayout activeMeetings'`
 */
export function reportListenerError(error: unknown, context: string): void {
  if (isFirestoreError(error) && RULES_DENIAL_CODES.includes(error.code)) {
    console.warn(`[firestore] listener "${context}" was denied by the security rules (${error.code}).`);
    Sentry.addBreadcrumb({
      category: 'firestore',
      level: 'info',
      message: `Listener "${context}" denied (${error.code})`,
    });
    return;
  }
  console.error(`[firestore] listener "${context}" failed:`, error);
  Sentry.captureException(error, {
    tags: { handled: 'true' },
    extra: { listener: context },
  });
}

/**
 * The part of VueFire's `useDocument()` / `useCollection()` return value this
 * module touches. Kept structural so it works with both without pulling in
 * VueFire's internal `_RefFirestore` type.
 */
interface ListenerSource {
  readonly promise: { readonly value: Promise<unknown> };
}

/**
 * Attach a rejection handler to a VueFire binding and hand it straight back.
 *
 * Wrap every `useDocument()` / `useCollection()` call in this. It leaves the
 * binding — including its reactive `.error` — untouched for the caller; all it
 * does is make sure the rejection is observed, so a denied read no longer
 * escapes as an unhandled rejection. The handler is attached synchronously, and
 * re-attached whenever a reactive source rebinds the listener.
 *
 * @param context - which listener this is, used when reporting
 */
export function guardListener<T extends ListenerSource>(source: T, context: string): T {
  watch(
    () => source.promise.value,
    (promise) => {
      void promise?.catch((error: unknown) => {
        reportListenerError(error, context);
      });
    },
    { immediate: true },
  );
  return source;
}
