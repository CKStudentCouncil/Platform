import { Notify } from 'quasar';
import { event } from 'vue-gtag';
import { Proposal } from 'src/ts/models.ts';

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

export function schoolEmailFromSchoolNumber(schoolNumber: string): string {
  return schoolNumber.startsWith('11100')
    ? `ck${schoolNumber.replace('11100', '1110')}@gl.ck.tp.edu.tw`
    : `ck${schoolNumber}@gl.ck.tp.edu.tw`;
}

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
      description: message + ': ' +  exception?.message,
      stack: exception?.stack,
      fatal: false,
    })
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

const date = new Date();
export const currentReign = date.getMonth() > 7 || date.getMonth() < 1 ?
  `${date.getFullYear() - 1945}-1` : // August to January
  `${date.getFullYear() - 1945 - 1}-2`; // February to July
