/**
 * Turning Firebase auth failures into something a student can act on.
 *
 * Every login path used to funnel into a bare `登入失敗` notification and a
 * Sentry exception. That is wrong twice over: the user is told nothing useful,
 * and the issue stream fills with conditions that are not defects — a popup
 * blocker, a flaky phone connection, an account the project has not been told
 * to accept. This module names those conditions so both sides get better.
 */

interface AuthErrorLike {
  code?: string;
  message?: string;
}

export function authErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as AuthErrorLike).code;
  return typeof code === 'string' ? code : null;
}

/**
 * Codes where `signInWithPopup` can never succeed, but a redirect still can.
 *
 * The LINE and Instagram in-app browsers — which is how most of the school
 * opens a link — either refuse `window.open` outright or lack the storage the
 * popup flow needs to hand the credential back.
 */
const REDIRECT_FALLBACK_CODES: readonly string[] = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
];

export function shouldRetryWithRedirect(error: unknown): boolean {
  const code = authErrorCode(error);
  return code !== null && REDIRECT_FALLBACK_CODES.includes(code);
}

/** The user closed the popup / started another one. Not a failure worth a toast. */
const CANCELLED_CODES: readonly string[] = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

export function isCancelledByUser(error: unknown): boolean {
  const code = authErrorCode(error);
  return code !== null && CANCELLED_CODES.includes(code);
}

/**
 * What the user should be told, and whether the failure is our bug.
 *
 * `report: false` means the cause is outside the app — the network, the
 * browser, or the Firebase project's own sign-up policy. Those still reach
 * Sentry as breadcrumbs (see `notifyError`), so they show up as context on a
 * later real failure without each one opening an issue.
 */
const DESCRIPTIONS: Record<string, { message: string; report: boolean }> = {
  'auth/network-request-failed': { message: '登入失敗：網路連線中斷，請確認網路後再試一次', report: false },
  'auth/internal-error': { message: '登入失敗：Google 登入服務暫時無法連線，請稍後再試一次', report: false },
  'auth/timeout': { message: '登入失敗：連線逾時，請再試一次', report: false },
  'auth/too-many-requests': { message: '登入失敗：嘗試次數過多，請稍後再試', report: false },

  // The Firebase project rejects accounts it has not been told about. A
  // student signing in with a Google account that was never registered lands
  // here, and telling them to use 班級學號 is the actual fix.
  'auth/admin-restricted-operation': { message: '登入失敗：此 Google 帳號尚未註冊，請改用班級學號登入', report: false },
  'auth/user-disabled': { message: '登入失敗：此帳號已被停用', report: false },
  'auth/unauthorized-domain': { message: '登入失敗：此網域未被授權登入', report: true },

  'auth/popup-blocked': { message: '登入失敗：瀏覽器封鎖了登入視窗，請允許彈出視窗或改用班級學號登入', report: false },
  'auth/operation-not-supported-in-this-environment': { message: '登入失敗：此瀏覽器不支援 Google 登入，請改用班級學號登入', report: false },
  'auth/web-storage-unsupported': { message: '登入失敗：此瀏覽器封鎖了必要的儲存空間，請關閉無痕模式後再試', report: false },

  'auth/invalid-credential': { message: '登入失敗：學號或班級錯誤', report: false },
  'auth/invalid-email': { message: '登入失敗：學號格式錯誤', report: false },
  'auth/user-not-found': { message: '登入失敗：查無此帳號，請確認學號與班級', report: false },
  'auth/wrong-password': { message: '登入失敗：學號或班級錯誤', report: false },
};

export interface AuthErrorDescription {
  message: string;
  report: boolean;
}

export function describeAuthError(error: unknown): AuthErrorDescription {
  const code = authErrorCode(error);
  if (code && DESCRIPTIONS[code]) {
    return DESCRIPTIONS[code];
  }
  // Anything unrecognised keeps the old wording and still opens an issue —
  // that is the case where something is genuinely broken.
  return { message: '登入失敗', report: true };
}
