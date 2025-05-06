import { boot } from 'quasar/wrappers';
import { initializeApp } from 'firebase/app';
import { useFirebaseApp, VueFire, VueFireAuth } from 'vuefire';
import type { Analytics} from 'firebase/analytics';
import { initializeAnalytics } from 'firebase/analytics';
import type { HttpsCallable} from '@firebase/functions';
import { getFunctions, httpsCallable } from '@firebase/functions';
import VueGtag from 'vue-gtag';

let analytics: Analytics | null = null;

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app, router }) => {
  // something to do
  const firebaseApp = initializeApp({
    apiKey: "AIzaSyCYwBV-FH-xww7AFitUiP5LV3yZgU3Mn74",
    authDomain: "cyhs-platform.firebaseapp.com",
    projectId: "cyhs-platform",
    storageBucket: "cyhs-platform.firebasestorage.app",
    messagingSenderId: "303469346334",
    appId: "1:303469346334:web:98b60e89b579fafe5ef80f",
    measurementId: "G-Z0RHTBLREB"
  });
  analytics = initializeAnalytics(firebaseApp);
  app.use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()],
  });
  app.use(
    VueGtag,
    {
      config: { id: firebaseApp.options.measurementId! },
    },
    router,
  );
});

export function useFunction(name: string): HttpsCallable {
  return httpsCallable(getFunctions(useFirebaseApp(), 'asia-east1'), name);
}

export function useAnalytics(): Analytics {
  return analytics!;
}
