import { useFirebaseAuth } from 'vuefire';
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { reactive, Ref, ref } from 'vue';
import { Loading, Notify } from 'quasar';
import { UserClaims } from 'src/ts/models.ts';
import { useFunction } from 'boot/vuefire.ts';

let auth = useFirebaseAuth()!;
const loggedInUser: Ref<User | null> = ref(auth?.currentUser);
const loggedInUserClaims = reactive({} as UserClaims);

export function init() {
  auth = useFirebaseAuth()!;
  loggedInUser.value = auth.currentUser;
  auth.setPersistence(browserLocalPersistence).then(async () => {
    console.log('Firebase auth persistence set.');
    loggedInUser.value = auth.currentUser;
    await updateCustomClaims();
  });
  auth.onAuthStateChanged((user) => {
    loggedInUser.value = user;

    if (isLoggedIn()) {
      console.log('Logged In.');
    } else if (auth) {
      console.log('Logged Out.');
    } else {
      console.log('Firebase auth not ready.');
    }
  });
}

export async function updateCustomClaims() {
  const claims = await auth?.currentUser?.getIdTokenResult();
  if (!claims) return;
  loggedInUserClaims.role = claims.claims.role as number;
  loggedInUserClaims.schoolNumber = claims.claims.schoolNumber as string;
  loggedInUserClaims.clazz = claims.claims.clazz as string;
  loggedInUserClaims.seatNumber = claims.claims.seatNumber as string;
}

export function isLoggedIn() {
  return loggedInUser.value !== null;
}

export function getUserClaims() {
  return loggedInUserClaims;
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
      Notify.create({
        message: '登入成功',
        color: 'positive',
        icon: 'check_circle',
        position: 'top',
        timeout: 2000,
      });
    })
    .catch((error) => {
      console.error('Failed to log in.');
      console.error(error);
      Loading.hide();
      Notify.create({
        message: '登入失敗',
        color: 'negative',
        icon: 'report_problem',
        position: 'top',
        timeout: 2000,
      });
    });
}

export function loginWithCredentials(schoolNumber: string, clazz: string) {
  Loading.show();
  const email = schoolNumber.startsWith('11100')
    ? `ck${schoolNumber.replace('11100', '1110')}@gl.ck.tp.edu.tw`
    : `ck${schoolNumber}@gl.ck.tp.edu.tw`;
  signInWithEmailAndPassword(auth, email, 'ck$c' + schoolNumber + '@' + clazz)
    .then(() => {
      console.log('Logged in successfully.');
      loggedInUser.value = auth.currentUser;
      Loading.hide();
      Notify.create({
        message: '登入成功',
        color: 'positive',
        icon: 'check_circle',
        position: 'top',
        timeout: 2000,
      });
    })
    .catch((e) => {
      console.error('Failed to log in.');
      console.error(e);
      Loading.hide();
      Notify.create({
        message: '登入失敗',
        color: 'negative',
        icon: 'report_problem',
        position: 'top',
        timeout: 2000,
      });
    });
}

export function logout() {
  auth.signOut();
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
  return '未知';
}

export async function getAllUsers() {
  return (await useFunction('getAllUsers')()).data;
}
