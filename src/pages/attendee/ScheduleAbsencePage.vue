<template>
  <q-page padding>
    <div v-if="!meeting.value" class="text-h5">載入中...</div>
    <div v-if="meeting.value && new Date().valueOf() < meeting.value.start.valueOf()">
      <div class="text-h5">{{ meeting.value.name }} 請假</div>
      <div class="text-h5">開會時間：{{ meeting.value.start.toLocaleString() }}</div>
      <q-input v-model="reason" label="請假原因" />
      <div v-if="meeting.value.absences && meeting.value.absences[getUserClaims().clazz]" class="q-gutter-md">
        <div class="text-h6">你已在 {{ meeting.value.absences[getUserClaims().clazz].scheduledAt.toLocaleString() }} 請假</div>
        <q-btn color="primary" label="編輯請假原因" @click="scheduleAbsence" />
        <q-btn color="negative" label="取消請假" @click="cancelAbsence()" />
      </div>
      <q-btn v-else color="primary" label="請假" @click="scheduleAbsence" />
    </div>
    <div v-if="meeting.value && new Date().valueOf() >= meeting.value.start.valueOf()">
      <div class="text-h5">開會時間已到，無法請假</div>
    </div>
  </q-page>
  <LoginDialog v-model="loginDialog" />
</template>

<script lang="ts" setup>
import { getMeeting, rawMeetingCollection } from 'src/ts/models.ts';
import { useRoute } from 'vue-router';
import LoginDialog from 'components/LoginDialog.vue';
import { computed, ref, watch } from 'vue';
import { getUserClaims, updateCustomClaims } from 'src/ts/auth.ts';
import { useCurrentUser } from 'vuefire';
import { Notify } from 'quasar';
import { deleteField, doc, updateDoc } from 'firebase/firestore';

const route = useRoute();
let meetingId = ref(route.params.id as string);
let meeting = computed(() => getMeeting(meetingId.value));
const loginDialog = ref(false);
const reason = ref('');
const customClaims = ref(getUserClaims());

watch(useCurrentUser(), async (user) => {
  if (user) {
    await updateCustomClaims();
    customClaims.value = getUserClaims();
    loginDialog.value = false;
    meetingId.value = 'reload_dummy';
    meetingId.value = route.params.id as string;
  } else {
    loginDialog.value = true;
  }
});

watch(
  meeting,
  async (meeting) => {
    await updateAbsenceReason(meeting);
  },
  { deep: true },
);

async function updateAbsenceReason(meeting: any) {
  if (meeting.value && meeting.value.absences && meeting.value.absences[getUserClaims().clazz]) {
    reason.value = meeting.value.absences[getUserClaims().clazz].reason;
  }
}

async function scheduleAbsence() {
  if (!reason.value || reason.value.length == 0 || reason.value.trim().length == 0) {
    Notify.create({
      message: '請填寫請假原因',
      color: 'negative',
    });
    return;
  }
  await updateDoc(doc(rawMeetingCollection(), meetingId.value), {
    ['absences.' + getUserClaims().clazz]: {
      reason: reason.value,
      scheduledAt: new Date(),
    },
  });
}

async function cancelAbsence() {
  await updateDoc(doc(rawMeetingCollection(), meetingId.value), {
    ['absences.' + getUserClaims().clazz]: deleteField(),
  });
}
</script>

<style scoped></style>
