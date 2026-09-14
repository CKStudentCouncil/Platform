import { defineRouter } from '#q-app';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';
import { clearChunkReloadFlag, installPreloadErrorHandler, isChunkLoadError, reloadForNewVersion } from 'src/ts/chunkerrors.ts';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE),
  });

  installPreloadErrorHandler();

  // Every route component is a dynamic `import()`, so a deploy that lands while
  // a tab is open breaks the *next* navigation rather than the current page.
  // Reloading at the destination both recovers the tab and completes the
  // navigation the user asked for. See `src/ts/chunkerrors.ts`.
  Router.onError((error, to) => {
    if (isChunkLoadError(error)) {
      reloadForNewVersion(to.fullPath);
    }
  });

  // A navigation that finished proves the current assets are intact, so the
  // next stale deploy is allowed its own reload.
  Router.afterEach(() => {
    clearChunkReloadFlag();
  });

  return Router;
});
