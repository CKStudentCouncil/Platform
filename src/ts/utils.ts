import { Notify } from 'quasar';
import { event } from 'vue-gtag';
import * as Sentry from '@sentry/vue';
import type { Proposal } from 'src/ts/models.ts';

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

export function notifyError(message: string, exception?: any): void {
  Notify.create({
    message,
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

export { schoolEmailFromSchoolNumber, getReign, getCurrentReign };
