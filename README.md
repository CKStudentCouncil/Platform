# CK Student Council Legistaive Platform (cksc-platform)

A legislative platform with punch-in, voting and legal code keeping features

## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```


### Lint the files
```bash
yarn lint
# or
npm run lint
```


### Format the files
```bash
yarn format
# or
npm run format
```



### Build the app for production
```bash
quasar build
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).

## Error monitoring (Sentry)

Runtime errors are reported to the [`cksc/platform`](https://cksc.sentry.io/projects/platform/)
Sentry project. Reporting is initialised in `src/boot/sentry.ts` and is **disabled
during `quasar dev`** so local work does not add noise — flip `enabled` in that
boot file if you need to verify it locally.

Everything the browser needs (the DSN) is committed in `shared/constants.ts`; it is
a public, write-only identifier, exactly like `FIREBASE_CONFIG`.

Uploading source maps, so stack traces are readable instead of minified, is a
CI-only step. `quasar.config.ts` enables it when all three of these are present in
the environment, and skips it silently otherwise:

| Name | Where it lives | Value |
| --- | --- | --- |
| `SENTRY_ORG` | GitHub repo **variable** | `cksc` |
| `SENTRY_PROJECT` | GitHub repo **variable** | `platform` |
| `SENTRY_AUTH_TOKEN` | GitHub repo **secret** | Org token with `project:releases` |

The deploy workflow (`pages-deploy-merge.yml`) passes all three. PR builds
deliberately do not, since they are never deployed. To rotate the token, create a
new one under [Organization Auth Tokens](https://cksc.sentry.io/settings/auth-tokens/)
and update the repository secret — an invalid token only downgrades stack trace
quality, it will not fail the deploy.
