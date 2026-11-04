import { Notify } from 'quasar';
import { event } from 'vue-gtag';
import * as Sentry from '@sentry/vue';
import type { Proposal } from 'src/ts/models.ts';
import { CALLABLE_TRANSPORT_FAILURE_HINT, isCallableTransportFailure } from 'src/ts/functionerrors.ts';

export function generateRandomText(length: number, bannedPrefix: string | null): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  if (bannedPrefix && result.startsWith(bannedPrefix)) {
    return generateRandomText(length, bannedPrefix);
  }
  return result;
}

import { schoolEmailFromSchoolNumber, getReign, getCurrentReign } from '../../shared/utils';

export function notifySuccess(message: string): void {
  Notify.create({
    message,
    color: 'positive',
    icon: 'check_circle',
    position: 'top',
  });
}

export interface NotifyErrorOptions {
  /**
   * Whether this failure is worth a Sentry issue. Defaults to `true`.
   *
   * Pass `false` for failures the app cannot fix in code — a dropped mobile
   * connection, a blocked popup, an account the Firebase project declines.
   * The user still gets the notification and the event still lands as a
   * breadcrumb, so it shows up as context underneath a later real failure
   * instead of drowning it out with its own issue.
   */
  report?: boolean;
}

export function notifyError(message: string, exception?: any, options?: NotifyErrorOptions): void {
  // A callable that got no reply is never ours to fix and says nothing about
  // what failed; see `src/ts/functionerrors.ts`. Tell the user what to try, and
  // keep it out of Sentry no matter what the caller asked for.
  const noReply = isCallableTransportFailure(exception);
  Notify.create({
    message: noReply ? `${message}：${CALLABLE_TRANSPORT_FAILURE_HINT}` : message,
    color: 'negative',
    icon: 'report_problem',
    position: 'top',
  });
  if (exception) {
    console.error(exception);
    event('exception', {
      description: message + ': ' + exception?.message,
      stack: exception?.stack,
      fatal: false,
    });
    if (noReply || options?.report === false) {
      Sentry.addBreadcrumb({
        category: 'expected-failure',
        level: 'warning',
        message,
        data: { code: exception?.code, error: exception?.message },
      });
      return;
    }
    // Every caught failure in the app funnels through here, so this is the
    // single place that needs to forward to Sentry. The notification text is
    // attached as context — it says what the user was told went wrong, which
    // the raw exception usually doesn't.
    Sentry.captureException(exception, {
      tags: { handled: 'true' },
      extra: { notification: message },
    });
  }
}

export function notifySpeakRequests(prop?: Proposal, prevProp?: Proposal): void {
  if (prop && prevProp) {
    for (const speakRequest of prop.speakRequests) {
      if (!prevProp.speakRequests.includes(speakRequest)) {
        Notify.create({
          message: `${speakRequest} 班代請求發言`,
          color: 'positive',
        });
      }
    }
  }
}

export function cleanseName(name: string | null | undefined): string | null {
  return name?.replace(/ck[0-9]+/, '') ?? null;
}

/**
 * Returns `url` unchanged unless it is a `javascript:` URL, in which case it
 * returns `undefined` so Vue drops the `href` / `src` attribute.
 *
 * Proposal attachments are user-supplied strings bound straight into links and
 * a preview iframe, where a `javascript:` URL would run in this app's origin.
 * The check uses the same URL parser the browser navigates with, so letter
 * case, leading whitespace or control characters, and tabs or newlines inside
 * the scheme are normalised exactly as navigation would. Anything that does not
 * parse is returned unchanged: the browser cannot navigate to it either.
 */
export function blockJavascriptUrl(url: string | undefined): string | undefined {
  try {
    if (url && new URL(url, document.baseURI).protocol === 'javascript:') {
      return undefined;
    }
  } catch {
    // Not a parseable URL, so it cannot be navigated to as `javascript:`.
  }
  return url;
}

/**
 * Maps a Google Drive / Docs link to its embeddable preview URL. Any other
 * input is passed through {@link blockJavascriptUrl} before it reaches the
 * preview iframe's `src`.
 */
export function getGoogleFileEmbed(input: string): string | undefined {
  let file_id = null;
  const driveCapture = input.match(/https:\/\/drive\.google\.com\/file\/d\/(.*)\/view.*/);
  if (driveCapture && driveCapture.length > 1) {
    file_id = driveCapture[1];
  }
  const documentCapture = input.match(/https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/(.*)\/edit.*/);
  if (documentCapture && documentCapture.length > 2) {
    file_id = documentCapture[2];
  }
  if (file_id) {
    return `https://drive.google.com/file/d/${file_id}/preview`;
  }
  return blockJavascriptUrl(input);
}

export { schoolEmailFromSchoolNumber, getReign, getCurrentReign };
