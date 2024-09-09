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
              width: Math.min(screenWidth, screenHeight) * 0.4,
            }"
            :value="`${currentHost}#/punch_in/${selectedMeeting!.punchInPasscode}`"
            tag="svg"
          ></vue-qrcode>
          <div class="text-h4">
            簽到碼：{{ selectedMeeting!.punchInPasscode }}
          </div>
          <img alt="cksc" class="qrcode__image" src="icon.png" />
        </figure>
      </div>
      <div class="col-6">
        <h1>{{ selectedMeeting!.participants.length }}</h1>
        <div class="text-h6">人已簽到</div>
        <transition
          v-for="participant of selectedMeeting!.participants"
          :key="participant"
          appear
          enter-active-class="animated heartBeat"
        >
          <q-chip removable @remove="removeParticipant(participant)"
            >{{ participant }} 班代
          </q-chip>
        </transition>
      </div>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { useDocument, useFirestore } from 'vuefire';
import { arrayRemove, doc, updateDoc } from 'firebase/firestore';
import { useRoute } from 'vue-router';
import { meetingConverter, rawMeetingCollection } from 'src/ts/models.ts';
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

async function removeParticipant(participant: string) {
  await updateDoc(doc(rawMeetingCollection(), route.params.id as string), {
    participants: arrayRemove(participant),
  });
}
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
