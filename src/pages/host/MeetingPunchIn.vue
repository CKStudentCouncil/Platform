<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab :to="`/meeting_host`" label="開會" />
      <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}`" label="開放簽到" />
      <q-route-tab
        v-if="selectedMeeting"
        :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`"
        label="審理議案"
      />
    </q-tabs>
    <div v-if="selectedMeeting" class="row q-ma-md">
      <div class="col-6">
        <SignInQRCode :passcode="selectedMeeting!.punchInPasscode" />
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
          <q-chip removable @remove="removeParticipant(participant)">{{ participant }} 班代</q-chip>
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
import SignInQRCode from 'components/QRPasscode.vue';

const db = useFirestore();
const route = useRoute();
const selectedMeeting = useDocument(doc(db, 'meetings', route.params.id as string).withConverter(meetingConverter));

async function removeParticipant(participant: string) {
  await updateDoc(doc(rawMeetingCollection(), route.params.id as string), {
    participants: arrayRemove(participant),
  });
}
</script>

<style scoped></style>
