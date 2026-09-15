<template>
  <figure :style="`transform: scale(${size});transform-origin: 0% 0% 0px;`" class="qrcode">
    <!-- eslint-disable-next-line vue/no-v-html -- `svg` is markup that `qrcode`
         generated locally from the URL below; nothing user-authored reaches it. -->
    <div class="qrcode__code" v-html="svg"></div>
    <div class="text-h4" style="text-align: center">簽到碼：{{ passcode }}</div>
    <img alt="cksc" class="qrcode__image" src="/icon.png" v-if="$q.screen.gt.sm" />
  </figure>
</template>

<script lang="ts" setup>
import QRCode from 'qrcode';
import { computed, ref, watchEffect } from 'vue';
import * as Sentry from '@sentry/vue';

/**
 * This used to render through `@chenfengyuan/vue-qrcode`, which is written
 * entirely in the Options API — `mounted()` is what asks the `qrcode` package
 * for the markup. `@quasar/app-vite` v3 defaults `build.vueOptionsAPI` to
 * `false`, which compiles `__VUE_OPTIONS_API__` out of Vue, so `applyOptions()`
 * never runs: the wrapper's `render()` still produced the root `<svg>`, but its
 * `mounted`, `watch` and `methods` were all dropped on the floor and the
 * element stayed empty. No error was thrown anywhere, so the QR code simply
 * failed to appear.
 *
 * `qrcode` is already a direct dependency, so we call it ourselves rather than
 * turning the Options API back on for one unmaintained wrapper. The markup is
 * a `computed`-driven `ref`, which also drops the wrapper's other bug: it
 * *appended* each regeneration to the same `<svg>` instead of replacing it, so
 * every re-render stacked another copy inside the element.
 */
const props = defineProps({
  passcode: String,
  size: {
    type: Number,
    default: 1.0,
  },
});

const currentHost = window.location.origin.replace(/\/+$/, '');
const screenHeight = screen.height;
const screenWidth = screen.width;

const value = computed(() => `${currentHost}/punch_in/${props.passcode ?? ''}`);

const svg = ref('');
watchEffect((onCleanup) => {
  // The passcode arrives from Firestore, so it can change under us while a
  // previous generation is still pending. Drop anything that lands late.
  let stale = false;
  onCleanup(() => {
    stale = true;
  });

  QRCode.toString(value.value, {
    type: 'svg',
    errorCorrectionLevel: 'Q',
    width: Math.min(screenWidth, screenHeight) * 0.4,
  })
    .then((markup) => {
      if (!stale) svg.value = markup;
    })
    .catch((error: unknown) => {
      // Encoding a short URL has no failure mode in practice, but letting this
      // reject on its own would put an unhandled rejection in front of Sentry
      // carrying nothing but `qrcode` internals.
      console.error('[qrcode] could not render the punch-in QR code:', error);
      Sentry.captureException(error, { tags: { handled: 'true' }, extra: { value: value.value } });
    });
});
</script>

<style scoped>
.qrcode {
  display: inline-block;
  font-size: 0;
  margin-bottom: 0;
  position: relative;
}

.qrcode__image {
  height: 18.4%;
  left: 50%;
  overflow: hidden;
  position: absolute;
  top: 46%;
  transform: translate(-50%, -50%);
  width: 20%;
}
</style>
