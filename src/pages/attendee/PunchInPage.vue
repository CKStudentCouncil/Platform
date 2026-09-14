<template>
  <q-page v-if="passcode && passcode.length != 0" class="row items-center justify-evenly" padding>
    <q-spinner size="10%" />
    <h1>簽到中</h1>
  </q-page>
  <q-page v-else padding>
    <q-input v-model="tempPasscode" label="請輸入簽到碼" />
    <q-btn color="primary" label="確定" @click="submit" />
    <q-btn v-if="!scanning" color="positive" label="掃描簽到碼" @click="scanning = true" />
    <qrcode-stream v-if="scanning" @detect="onDetect" />
  </q-page>
  <LoginDialog v-model="loginDialog" :register="register" />
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { ref, watch } from 'vue';
import { and, arrayUnion, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { loggedInUserClaims } from 'src/ts/auth.ts';
import LoginDialog from 'components/LoginDialog.vue';
import { rawMeetingCollection } from 'src/ts/models.ts';
import { QrcodeStream } from 'vue-qrcode-reader';
import { notifyError } from 'src/ts/utils.ts';
import { Notify } from 'quasar';

const passcode = ref((useRoute().params.passcode as string | undefined) ?? '');
const tempPasscode = ref('');
const loginDialog = ref(false);
const router = useRouter();
const scanning = ref(false);
const register = ref(false);
// Resolved here rather than inside the handlers: `rawMeetingCollection()` calls
// VueFire's `useFirestore()`, which is only valid inside `setup()`.
const meetings = rawMeetingCollection();

if (loggedInUserClaims.role === 25) {
  Notify.create({ type: 'negative', message: '其他部門使用者無法簽到。' });
  void router.push('/');
}

// Registered once, at setup. It used to be created inside `punchIn()`, which
// meant a new watcher on every retry — each one calling `punchIn()` again when
// the login finally landed.
watch(
  loggedInUserClaims,
  (claims) => {
    if (!loginDialog.value || !claims?.clazz) return;
    loginDialog.value = false;
    void punchIn();
  },
  { deep: true },
);

async function submit() {
  passcode.value = tempPasscode.value;
  await punchIn();
}

async function punchIn() {
  if (!loggedInUserClaims || !loggedInUserClaims.clazz) {
    register.value = passcode.value.startsWith('reg'); // I know this looks lame, but it allows us to know whether this meeting allows registration without having to read the meeting from the database (we can't do it now, since we don't have an account yet)
    loginDialog.value = true;
    return;
  }
  try {
    const meeting = await getDocs(query(meetings, where('punchInPasscode', '==', passcode.value)));
    if (meeting.docs.length == 0) {
      notifyError('簽到碼錯誤');
      passcode.value = '';
      return;
    }
    await updateDoc(meeting.docs[0]!.ref, {
      participants: arrayUnion(loggedInUserClaims.clazz),
    });
    await router.push('/attendee/' + meeting.docs[0]?.id);
  } catch (e) {
    notifyError('簽到失敗', e);
    passcode.value = '';
  }
}

async function checkPunchedIn() {
  // Reading `meetings` without an account is denied by `firestore.rules`, so
  // there is nothing to look up until the user signs in.
  if (!loggedInUserClaims?.clazz) return;
  try {
    const punchedIn = await getDocs(
      query(meetings, and(where('participants', 'array-contains', loggedInUserClaims.clazz), where('active', '==', true))),
    );
    if (punchedIn.docs.length != 0) {
      await router.push('/attendee/' + punchedIn.docs[0]?.id);
    }
  } catch (e) {
    // This is a convenience redirect rather than something the user asked for,
    // but staying on the passcode screen with no explanation after having
    // already punched in is confusing enough to be worth saying out loud.
    notifyError('無法檢查簽到狀態', e);
  }
}

async function onDetect(detectedCodes: any) {
  if (detectedCodes.length == 0) return;
  const code = detectedCodes[0].rawValue as string;
  const realPasscode = code.split('/punch_in/')[1];
  if (!realPasscode) return;
  tempPasscode.value = realPasscode;
  scanning.value = false;
  await submit();
}

if (passcode.value.length != 0) {
  void punchIn();
} else if (loggedInUserClaims.clazz) {
  void checkPunchedIn();
} else {
  // Claims land a tick or two after the page mounts (the ID token has to be
  // fetched first), so an immediate check would read an empty class and skip.
  const stop = watch(
    () => loggedInUserClaims.clazz,
    (clazz) => {
      if (!clazz) return;
      stop();
      void checkPunchedIn();
    },
  );
}
</script>

<style scoped></style>
