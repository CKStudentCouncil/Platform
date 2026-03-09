import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { useFirebaseApp, VueFire, VueFireAuth } from 'vuefire';
import type { Analytics } from 'firebase/analytics';
import { initializeAnalytics } from 'firebase/analytics';
import type { HttpsCallable } from '@firebase/functions';
import { getFunctions, httpsCallable } from '@firebase/functions';
import { configure } from 'vue-gtag';
import { FIREBASE_CONFIG, FIREBASE_REGION } from '../../constants';

let analytics: Analytics | null = null;

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app }) => {
  // something to do
  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  analytics = initializeAnalytics(firebaseApp);
  app.use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()],
  });
  configure({
    appName: 'DTJH Platform Quasar App',
    tagId: firebaseApp.options.measurementId!,
  });
});

export function useFunction(name: string): HttpsCallable {
  return httpsCallable(getFunctions(useFirebaseApp(), FIREBASE_REGION), name);
}

export function useAnalytics(): Analytics {
  return analytics!;
}
