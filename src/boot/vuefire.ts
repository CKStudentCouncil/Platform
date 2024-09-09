import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { useFirebaseApp, VueFire, VueFireAuth } from 'vuefire';
import { Analytics, initializeAnalytics } from 'firebase/analytics';
import {
  getFunctions,
  HttpsCallable,
  httpsCallable,
} from '@firebase/functions';

let analytics: Analytics | null = null;

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(async ({ app }) => {
  // something to do
  const firebaseApp = initializeApp({
    apiKey: 'AIzaSyDVpsV2SN10S6Oirk6NWU0GZzWLHJ0TUyw',
    authDomain: 'cksc-platform.firebaseapp.com',
    projectId: 'cksc-platform',
    storageBucket: 'cksc-platform.appspot.com',
    messagingSenderId: '405143921937',
    appId: '1:405143921937:web:904e9dbe70c475afd5d8b0',
    measurementId: 'G-0DEL084RDJ',
  });
  analytics = initializeAnalytics(firebaseApp);
  app.use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()],
  });
});

export function useFunction(name: string): HttpsCallable {
  return httpsCallable(getFunctions(useFirebaseApp()!, 'asia-east1'), name);
}

export function useAnalytics(): Analytics {
  return analytics!;
}
