import { useFirebaseAuth } from 'vuefire';
import { browserLocalPersistence, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, User } from 'firebase/auth';
import { reactive, Ref, ref } from 'vue';
import { Loading, Notify } from 'quasar';
import * as models from 'src/ts/models.ts';
import { UserClaims } from 'src/ts/models.ts';
import { useFunction } from 'boot/vuefire.ts';

let auth = useFirebaseAuth()!;
export const loggedInUser: Ref<User | null> = ref(auth?.currentUser);
export const loggedInUserClaims = reactive({} as UserClaims);
export const rootUID = '38fWtZ4AKRU3oAZjfrt9nBq7d8B2';

export function init() {
  auth = useFirebaseAuth()!;
  loggedInUser.value = auth.currentUser;
  auth.setPersistence(browserLocalPersistence).then(async () => {
    console.log('Firebase auth persistence set.');
    loggedInUser.value = auth.currentUser;
    await updateCustomClaims();
  });
  auth.onAuthStateChanged(async (user) => {
    loggedInUser.value = user;

    await updateCustomClaims();
    if (loggedInUser.value) {
      console.log('Logged In.');
    } else if (auth) {
      console.log('Logged Out.');
    } else {
      console.log('Firebase auth not ready.');
    }
  });
}

async function updateCustomClaims() {
  const claims = await auth?.currentUser?.getIdTokenResult();
  if (claims) {
    loggedInUserClaims.role = claims.claims.role as number;
    loggedInUserClaims.schoolNumber = claims.claims.schoolNumber as string;
    loggedInUserClaims.clazz = claims.claims.clazz as string;
    loggedInUserClaims.seatNumber = claims.claims.seatNumber as string;
  } else {
    loggedInUserClaims.role = 0;
    loggedInUserClaims.schoolNumber = '';
    loggedInUserClaims.clazz = '';
    loggedInUserClaims.seatNumber = '';
  }
  console.log('Custom claims updated.');
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

export async function loginWithCredentials(schoolNumber: string, clazz: string) {
  Loading.show();
  const email = schoolNumber.startsWith('11100') ? `ck${schoolNumber.replace('11100', '1110')}@gl.ck.tp.edu.tw` : `ck${schoolNumber}@gl.ck.tp.edu.tw`;
  try {
    await signInWithEmailAndPassword(auth, email, 'ck$c' + schoolNumber + '@' + clazz);
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
  } catch (e) {
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
  return '未知';
}

export async function getAllUsers(): Promise<models.User[]> {
  return (await useFunction('getAllUsers')()).data as models.User[];
}

