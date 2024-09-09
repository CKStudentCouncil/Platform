<template>
  <q-tabs align="left">
    <q-route-tab :to="`/meeting_host`" label="開會" />
    <q-route-tab
      v-if="selectedMeeting"
      :to="`/meeting_host/${(selectedMeeting! as any).id}`"
      label="開放簽到"
    />
    <q-route-tab
      v-if="selectedMeeting"
      :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`"
      label="審理議案"
    />
  </q-tabs>
  <q-page v-if="selectedMeeting" padding>
    <div class="row">
      <div class="col-6">
        <figure class="qrcode">
          <vue-qrcode
            :options="{
              errorCorrectionLevel: 'Q',
              width: Math.min(screenWidth, screenHeight) * 0.5,
            }"
            :value="`${currentHost}#/punch_in/${selectedMeeting!.punchInPasscode}`"
            tag="svg"
          ></vue-qrcode>
          <img alt="Chen Fengyuan" class="qrcode__image" src="icon.png" />
        </figure>
      </div>
      <div class="col-6">
        <h1>{{ selectedMeeting!.participants.length }}</h1>
        <div class="text-h6">人已簽到</div>
      </div>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { useDocument, useFirestore } from 'vuefire';
import { doc } from 'firebase/firestore';
import { useRoute } from 'vue-router';
import { meetingConverter } from 'src/ts/models.ts';
import VueQrcode from '@chenfengyuan/vue-qrcode';

const db = useFirestore();
const route = useRoute();
const selectedMeeting = useDocument(
  doc(db, 'meetings', route.params.id as string).withConverter(
    meetingConverter,
  ),
);
const currentHost = window.location.origin;
const screenHeight = screen.height;
const screenWidth = screen.width;
</script>

<style scoped>
.qrcode {
  display: inline-block;
  font-size: 0;
  margin-bottom: 0;
  position: relative;
}

.qrcode__image {
  height: 20%;
  left: 50%;
  overflow: hidden;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20%;
}
</style>
