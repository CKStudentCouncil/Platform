import { useFirebaseAuth } from 'vuefire';
import type { User } from 'firebase/auth';
import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import type { Ref } from 'vue';
import { reactive, ref } from 'vue';
import { Loading } from 'quasar';
import type * as models from 'src/ts/models.ts';
import type { UserClaims } from 'src/ts/models.ts';
import { useFunction } from 'boot/vuefire.ts';
import { notifyError, notifySuccess, schoolEmailFromSchoolNumber } from 'src/ts/utils.ts';
import { describeAuthError, isCancelledByUser, shouldRetryWithRedirect } from 'src/ts/autherrors.ts';
import { event } from 'vue-gtag';
import * as Sentry from '@sentry/vue';

let auth = useFirebaseAuth()!;
export const loggedInUser: Ref<User | null> = ref(auth?.currentUser);
export const loggedInUserClaims = reactive({} as UserClaims);
let initialised = false;

export function init() {
  auth = useFirebaseAuth()!;
  loggedInUser.value = auth.currentUser;
  // MainLayout wraps every route, so `init()` runs again on each layout
  // remount. Re-registering `onAuthStateChanged` each time left a growing pile
  // of listeners all racing to write the same claims.
  if (initialised) return;
  initialised = true;

  void auth
    .setPersistence(browserLocalPersistence)
    .then(async () => {
      console.log('Firebase auth persistence set.');
      loggedInUser.value = auth.currentUser;
      await updateCustomClaims();
    })
    // `setPersistence` and the token fetch behind `updateCustomClaims` both hit
    // the network. On a phone that drops its connection mid-load this rejected
    // with `auth/network-request-failed` and, with nothing attached to catch
    // it, escaped to the browser as an unhandled rejection.
    .catch((error: unknown) => {
      reportAuthStartupFailure(error, 'setPersistence');
    });

  // Completes a `signInWithRedirect()` started by `login()` on a browser that
  // cannot do popups. Returns null on a normal page load.
  void getRedirectResult(auth)
    .then((result) => {
      if (!result) return;
      console.log('Logged in successfully (redirect).');
      loggedInUser.value = auth.currentUser;
      notifySuccess('登入成功');
      event('login_with_google', {});
    })
    .catch((error: unknown) => {
      notifyLoginFailure(error);
    });

  auth.onAuthStateChanged((user) => {
    loggedInUser.value = user;

    // Deliberately not `async`: a rejection from an async `onAuthStateChanged`
    // callback has nowhere to go but the global unhandled-rejection hook.
    void updateCustomClaims().catch((error: unknown) => {
      reportAuthStartupFailure(error, 'onAuthStateChanged');
    });
    if (loggedInUser.value) {
      console.log('Logged In.');
    } else if (auth) {
      console.log('Logged Out.');
    } else {
      console.log('Firebase auth not ready.');
    }
  });
}

/**
 * A token refresh that failed on the way in.
 *
 * Nothing to show the user: they are either signed out (and will be asked to
 * log in) or working from a cached token that is still valid. It is worth a
 * breadcrumb so it is visible under whatever fails next.
 */
function reportAuthStartupFailure(error: unknown, stage: string) {
  const { report } = describeAuthError(error);
  console.warn(`[auth] ${stage} failed:`, error);
  if (!report) {
    Sentry.addBreadcrumb({
      category: 'auth',
      level: 'warning',
      message: `${stage} failed`,
      data: { error: (error as { message?: string })?.message },
    });
    return;
  }
  Sentry.captureException(error, { tags: { handled: 'true' }, extra: { stage } });
}

/** Shared by every login entry point so they report the same way. */
function notifyLoginFailure(error: unknown) {
  console.error('Failed to log in.', error);
  if (isCancelledByUser(error)) {
    // The user shut the popup. Nothing went wrong.
    return;
  }
  const { message, report } = describeAuthError(error);
  notifyError(message, error, { report });
}

async function updateCustomClaims() {
  const claims = await auth?.currentUser?.getIdTokenResult();
  if (claims) {
    loggedInUserClaims.role = claims.claims.role as number;
    loggedInUserClaims.schoolNumber = claims.claims.schoolNumber as string;
    loggedInUserClaims.clazz = claims.claims.clazz as string;
    loggedInUserClaims.seatNumber = claims.claims.seatNumber as string;
    loggedInUserClaims.name = claims.claims.name as string;
  } else {
    loggedInUserClaims.role = 0;
    loggedInUserClaims.schoolNumber = '';
    loggedInUserClaims.clazz = '';
    loggedInUserClaims.seatNumber = '';
    loggedInUserClaims.name = '';
  }
  updateSentryUser();
  console.log('Custom claims updated.');
}

// Tags every event with who hit it, so an issue can be traced back to a
// specific account and class without digging through Firebase logs.
function updateSentryUser() {
  const user = loggedInUser.value;
  if (!user) {
    Sentry.setUser(null);
    Sentry.setTag('role', undefined);
    Sentry.setTag('clazz', undefined);
    return;
  }
  Sentry.setUser({
    id: user.uid,
    // `exactOptionalPropertyTypes` forbids an explicit `undefined` here.
    ...(loggedInUserClaims.schoolNumber ? { username: loggedInUserClaims.schoolNumber } : {}),
  });
  Sentry.setTag('role', translateRole(loggedInUserClaims.role));
  Sentry.setTag('clazz', loggedInUserClaims.clazz || undefined);
}

export function login() {
  console.log('Opening login page.');
  Loading.show({
    message: '請在彈出分頁內使用學校 Google 帳號登入',
  });
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then(() => {
      console.log('Logged in successfully.');
      loggedInUser.value = auth.currentUser;
      Loading.hide();
      notifySuccess('登入成功');
      event('login_with_google', {});
    })
    .catch(async (error: unknown) => {
      // Most students open these links from inside the LINE app, whose browser
      // refuses `window.open`. There is nothing to recover from — the popup
      // simply is not available — so hand the whole tab to Google instead;
      // `getRedirectResult()` in `init()` picks the result back up.
      if (shouldRetryWithRedirect(error)) {
        console.warn('[auth] popup unavailable, falling back to redirect.', error);
        Loading.show({ message: '正在前往 Google 登入頁面' });
        try {
          await signInWithRedirect(auth, provider);
          return; // The browser navigates away; nothing after this runs.
        } catch (redirectError: unknown) {
          Loading.hide();
          notifyLoginFailure(redirectError);
          return;
        }
      }
      Loading.hide();
      notifyLoginFailure(error);
    });
}

export async function loginWithCredentials(schoolNumber: string, clazz: string) {
  Loading.show({ message: '登入中' });
  try {
    await signInWithEmailAndPassword(auth, schoolEmailFromSchoolNumber(schoolNumber), 'ck$c' + schoolNumber + '@' + clazz);
    console.log('Logged in successfully.');
    loggedInUser.value = auth.currentUser;
    Loading.hide();
    notifySuccess('登入成功');
    event('login_with_schoolId', {});
  } catch (e) {
    Loading.hide();
    notifyLoginFailure(e);
  }
}

export async function logout() {
  await auth.signOut();
  loggedInUser.value = null;
}

export function translateRole(role: number | undefined) {
  if (role == null) return '未知';
  if (role >= 999) {
    return '管理員';
  }
  if (role >= 200) {
    return '議長';
  }
  if (role >= 150) {
    return '副議長';
  }
  if (role >= 100) {
    return '秘書';
  }
  if (role >= 50) {
    return '班代';
  }
  if (role >= 25) {
    return '其他部門';
  }
  return '未知';
}

export async function getAllUsers(): Promise<models.User[]> {
  return (await useFunction('getAllUsers')()).data as models.User[];
}

const getAllProposalFunction = useFunction('getAllProposal');
export async function getAllProposal(): Promise<models.Proposal[]> {
  return (await getAllProposalFunction()).data as models.Proposal[];
}
