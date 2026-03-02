<template>
  <q-page padding>
    <div v-if="!meeting.value" class="text-h5">載入中...</div>
    <div v-if="meeting.value && new Date().valueOf() < meeting.value.start.valueOf()">
      <div class="text-h5">{{ meeting.value.name }} 請假</div>
      <div class="text-h5">開會時間：{{ meeting.value.start.toLocaleString() }}</div>
      <q-input v-model="reason" label="請假原因" />
      <div v-if="meeting.value.absences && userDisplayName && meeting.value.absences[userDisplayName]" class="q-gutter-md">
        <div class="text-h6">你已在 {{ meeting.value.absences[userDisplayName]?.scheduledAt.toLocaleString() }} 請假</div>
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
import { loggedInUser } from 'src/ts/auth.ts';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { notifyError } from 'src/ts/utils.ts';

const route = useRoute();
const meetingId = ref(route.params.id as string);
const meeting = computed(() => getMeeting(meetingId.value));
const loginDialog = ref(false);
const reason = ref('');
const userDisplayName = computed(() => loggedInUser.value?.displayName ?? '');

if (!loggedInUser.value) {
  loginDialog.value = true;
}

watch(
  loggedInUser,
  (user) => {
    if (user) {
      loginDialog.value = false;
      meetingId.value = 'reload_dummy';
      meetingId.value = route.params.id as string;
    } else {
      loginDialog.value = true;
    }
  },
  { deep: true },
);

watch(meeting, (meeting) => updateAbsenceReason(meeting), { deep: true });

function updateAbsenceReason(meeting: any) {
  if (meeting.value && meeting.value.absences && userDisplayName.value && meeting.value.absences[userDisplayName.value]) {
    reason.value = meeting.value.absences[userDisplayName.value].reason;
  }
}

async function scheduleAbsence() {
  if (!reason.value || reason.value.length == 0 || reason.value.trim().length == 0) {
    notifyError('請填寫請假原因');
    return;
  }
  if (!userDisplayName.value) {
    notifyError('無法取得使用者名稱');
    return;
  }
  await updateDoc(doc(rawMeetingCollection(), meetingId.value), {
    ['absences.' + userDisplayName.value]: {
      reason: reason.value,
      scheduledAt: new Date(),
    },
  });
}

async function cancelAbsence() {
  if (!userDisplayName.value) {
    notifyError('無法取得使用者名稱');
    return;
  }
  await updateDoc(doc(rawMeetingCollection(), meetingId.value), {
    ['absences.' + userDisplayName.value]: deleteField(),
  });
}
</script>

<style scoped></style>
