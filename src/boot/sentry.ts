import { defineBoot } from '#q-app';
import * as Sentry from '@sentry/vue';
import { SENTRY_DSN } from '../../shared/constants';

const isDev = import.meta.env.DEV;

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default defineBoot(({ app, router }) => {
  Sentry.init({
    app,
    dsn: SENTRY_DSN,

    // Don't ship local development noise to the shared project. Flip this to
    // `true` temporarily when you need to verify the integration locally.
    enabled: !isDev,
    environment: isDev ? 'development' : 'production',

    // The release is injected at build time by @sentry/vite-plugin (see
    // quasar.config.ts), which uploads the matching source maps under the same
    // name so stack traces are un-minified in the Sentry UI.

    integrations: [
      Sentry.vueIntegration({
        // The platform renders student names, school numbers and class data;
        // keep component props out of the payload.
        attachProps: false,
      }),
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration({
        // Same reasoning as `attachProps` above — replays are structural only.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    tracesSampleRate: 1.0,
    // `tracePropagationTargets` is intentionally left at its same-origin
    // default. Firebase endpoints (Firestore, Storage, Cloud Functions) reject
    // the `sentry-trace`/`baggage` headers during CORS preflight, so adding
    // them here would break every call the app makes.

    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Do not attach IP addresses / cookies. User context is set explicitly in
    // `src/ts/auth.ts` once Firebase auth resolves.
    sendDefaultPii: false,
  });
});
