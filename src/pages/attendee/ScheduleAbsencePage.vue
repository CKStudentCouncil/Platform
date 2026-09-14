<template>
  <q-page padding>
    <div v-if="!meeting" class="text-h5">載入中...</div>
    <div v-if="meeting && new Date().valueOf() < meeting.start.valueOf()">
      <div class="text-h5">{{ meeting.name }} 請假</div>
      <div class="text-h5">開會時間：{{ meeting.start.toLocaleString() }}</div>
      <q-input v-model="reason" label="請假原因" />
      <div v-if="meeting.absences && meeting.absences[loggedInUserClaims.clazz]" class="q-gutter-md">
        <div class="text-h6">你已在 {{ meeting.absences[loggedInUserClaims.clazz]?.scheduledAt.toLocaleString() }} 請假</div>
        <q-btn color="primary" label="編輯請假原因" @click="scheduleAbsence" />
        <q-btn color="negative" label="取消請假" @click="cancelAbsence()" />
      </div>
      <q-btn v-else color="primary" label="請假" @click="scheduleAbsence" />
    </div>
    <div v-if="meeting && new Date().valueOf() >= meeting.start.valueOf()">
      <div class="text-h5">開會時間已到，無法請假</div>
    </div>
  </q-page>
  <LoginDialog v-model="loginDialog" />
</template>

<script lang="ts" setup>
import { rawMeetingCollection } from 'src/ts/models.ts';
import { useRoute } from 'vue-router';
import LoginDialog from 'components/LoginDialog.vue';
import { computed, ref, watch } from 'vue';
import { loggedInUser, loggedInUserClaims } from 'src/ts/auth.ts';
import { useDocument } from 'vuefire';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { guardListener } from 'src/ts/firestore.ts';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

const route = useRoute();
const meetingId = (route.params.id as string | undefined) ?? '';
const loginDialog = ref(!loggedInUser.value);
const reason = ref('');

// `firestore.rules` requires `request.auth != null` to read `meetings`, and
// this page is reached straight from a shared link, so the first render is
// almost always signed out. Binding the document only once a user exists keeps
// the listener from being opened against a rule that is certain to reject it.
//
// The previous shape — `computed(() => getMeeting(id))` — also called a VueFire
// composable from inside a getter, which opened a fresh listener on every
// re-evaluation and never tore the old ones down.
const meetingCollection = rawMeetingCollection();
const meetingRef = computed(() => (loggedInUser.value && meetingId ? doc(meetingCollection, meetingId) : null));
const meeting = guardListener(useDocument(meetingRef, { reset: true }), 'ScheduleAbsencePage meeting');

watch(loggedInUser, (user) => {
  loginDialog.value = !user;
});

watch(
  meeting,
  (value) => {
    const absence = value?.absences?.[loggedInUserClaims.clazz];
    if (absence) {
      reason.value = absence.reason;
    }
  },
  { deep: true },
);

async function scheduleAbsence() {
  if (!reason.value || reason.value.trim().length == 0) {
    notifyError('請填寫請假原因');
    return;
  }
  try {
    await updateDoc(doc(meetingCollection, meetingId), {
      ['absences.' + loggedInUserClaims.clazz]: {
        reason: reason.value,
        scheduledAt: new Date(),
      },
    });
    notifySuccess('請假成功');
  } catch (e) {
    // Without this the rejection escaped as an unhandled `permission-denied`,
    // and the user was left staring at a button that silently did nothing.
    notifyError('請假失敗', e);
  }
}

async function cancelAbsence() {
  try {
    await updateDoc(doc(meetingCollection, meetingId), {
      ['absences.' + loggedInUserClaims.clazz]: deleteField(),
    });
    notifySuccess('已取消請假');
  } catch (e) {
    notifyError('取消請假失敗', e);
  }
}
</script>

<style scoped></style>
