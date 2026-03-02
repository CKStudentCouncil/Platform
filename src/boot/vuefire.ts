import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { useFirebaseApp, VueFire, VueFireAuth } from 'vuefire';
import type { Analytics} from 'firebase/analytics';
import { initializeAnalytics } from 'firebase/analytics';
import type { HttpsCallable} from '@firebase/functions';
import { getFunctions, httpsCallable } from '@firebase/functions';
import { configure } from 'vue-gtag';

let analytics: Analytics | null = null;

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app }) => {
  // something to do
  const firebaseApp = initializeApp({
    apiKey: 'AIzaSyAoSuo1wBtDr61ish7CXIwPC7KWRJ3osKI',
    authDomain: 'dtjh-platform.firebaseapp.com',
    projectId: 'dtjh-platform',
    storageBucket: 'dtjh-platform.firebasestorage.app',
    messagingSenderId: '210431459437',
    appId: '1:210431459437:web:d2b3b6a1bb3a20aa083f64',
    measurementId: 'G-DW3XVWZCPB',
  });
  analytics = initializeAnalytics(firebaseApp);
  app.use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()],
  });
  configure({
    appName: 'DTJH Platform Quasar App',
    tagId: firebaseApp.options.measurementId!
  })
});

export function useFunction(name: string): HttpsCallable {
  return httpsCallable(getFunctions(useFirebaseApp(), 'asia-east1'), name);
}

export function useAnalytics(): Analytics {
  return analytics!;
}
