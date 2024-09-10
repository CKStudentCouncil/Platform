<template>
  <figure :style="`transform: scale(${size});transform-origin: 0% 0% 0px;`" class="qrcode">
    <vue-qrcode
      :options="{
        errorCorrectionLevel: 'Q',
        width: Math.min(screenWidth, screenHeight) * 0.4,
      }"
      :value="`${currentHost}#/punch_in/${passcode}`"
      tag="svg"
    ></vue-qrcode>
    <div class="text-h4" style="text-align: center">簽到碼：{{ passcode }}</div>
    <img alt="cksc" class="qrcode__image" src="icon.png" />
  </figure>
</template>

<script lang="ts" setup>
import VueQrcode from '@chenfengyuan/vue-qrcode';

const currentHost = window.location.origin + (window.location.origin.endsWith('/') ? '' : '/');
const screenHeight = screen.height;
const screenWidth = screen.width;
defineProps({
  passcode: String,
  size: {
    type: Number,
    default: 1.0,
  },
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
