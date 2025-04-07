<template>
  <q-page>
    <q-tabs v-if="bar" align="left">
      <q-route-tab :to="`/meeting_host`" label="開會" />
      <q-route-tab :to="`/meeting_host/passive`" label="開會投影" />
      <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}`" label="開放簽到" />
      <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`" label="審理議案" />
    </q-tabs>
    <div v-if="selectedMeeting" class="row q-ma-md">
      <div class="col-6">
        <SignInQRCode :passcode="selectedMeeting!.punchInPasscode" />
      </div>
      <div class="col-6">
        <div v-if="!selectedMeeting.registration">
          <div v-if="selectedMeeting.customAttendanceBar">
            <div style="display: table-row">
              <h1 style="display: table-cell">{{ selectedMeeting!.participants.length }}</h1>
              <span class="text-h6" style="display: table-cell; vertical-align: bottom"
              >/ {{ selectedMeeting.customAttendanceBar }} ( {{ absences }} 位請假)</span
              >
            </div>
            <div class="text-h6">人已簽到 / 開會門檻</div>
          </div>
          <div v-else>
            <div style="display: table-row">
              <h1 style="display: table-cell">{{ selectedMeeting!.participants.length }}</h1>
              <span class="text-h6" style="display: table-cell; vertical-align: bottom"
              >/ {{ Math.ceil((totalMembers - absences) / 5) }} / {{ totalMembers }} (- {{ absences }} 位請假)</span
              >
            </div>
            <div class="text-h6">人已簽到 / 開會門檻 / 班代總額</div>
          </div>
          <q-btn v-if="reachedRequirements" color="positive" flat icon="check" label="已達法定開會人數門檻" />
          <q-btn v-else color="negative" flat icon="close" label="未達法定開會人數門檻" />
        </div>
        <div v-else>
          <div style="display: table-row">
            <h1 style="display: table-cell">{{ selectedMeeting!.participants.length }}</h1>
          </div>
          <div class="text-h6">人已簽到</div>
        </div>
        <br />
        <transition v-for="participant of selectedMeeting!.participants" :key="participant" appear enter-active-class="animated heartBeat">
          <q-chip removable @remove="removeParticipant(participant)">{{ participant }} 班代</q-chip>
        </transition>
      </div>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { arrayRemove, doc, updateDoc } from 'firebase/firestore';
import { useRoute } from 'vue-router';
import { getMeeting, rawMeetingCollection } from 'src/ts/models.ts';
import SignInQRCode from 'components/QRPasscode.vue';
import { computed, ref } from 'vue';
import { getAllUsers } from 'src/ts/auth.ts';

const props = defineProps({
  bar: {
    type: Boolean,
    default: true,
  },
  meetingId: {
    type: String,
    default: '',
  },
});
const route = useRoute();
const selectedMeeting = getMeeting((route.params.id as string) ?? props.meetingId);
const totalMembers = ref(0);
const absences = computed(() => {
  const a = selectedMeeting?.value?.absences;
  return a ? Object.keys(a).length : 0;
});
const reachedRequirements = computed(() => {
  if (selectedMeeting?.value?.customAttendanceBar) {
    return selectedMeeting.value.participants.length >= selectedMeeting.value.customAttendanceBar;
  } else {
    return (selectedMeeting?.value?.participants.length ?? 0) >= Math.ceil((totalMembers.value - absences.value) / 5);
  }
});

async function removeParticipant(participant: string) {
  await updateDoc(doc(rawMeetingCollection(), (route.params.id as string) ?? props.meetingId), {
    participants: arrayRemove(participant),
  });
}

async function getRequirement() {
  const users = (await getAllUsers()) as any;
  let count = 0;
  for (const user of users) {
    if (user.role == 50) {
      count++;
    }
  }
  totalMembers.value = count + 2; // +議長副議長
}

void getRequirement();
</script>

<style scoped></style>
