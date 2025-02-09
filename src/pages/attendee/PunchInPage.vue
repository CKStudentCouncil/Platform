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

const passcode = ref(useRoute().params.passcode as string);
const tempPasscode = ref('');
const loginDialog = ref(false);
const router = useRouter();
const scanning = ref(false);
const register = ref(false);

async function submit() {
  passcode.value = tempPasscode.value;
  await punchIn();
}

async function punchIn() {
  if (!loggedInUserClaims || !loggedInUserClaims.clazz) {
    register.value = passcode.value.startsWith('reg'); // I know this looks lame, but it allows us to know whether this meeting allows registration without having to read the meeting from the database (we can't do it now, since we don't have an account yet)
    loginDialog.value = true;
    watch(
      loggedInUserClaims,
      async (user) => {
        if (user) {
          loginDialog.value = false;
          await punchIn();
        }
      },
      { deep: true },
    );
    return;
  }
  const meeting = await getDocs(query(rawMeetingCollection(), where('punchInPasscode', '==', passcode.value)));
  if (meeting.docs.length == 0) {
    notifyError('簽到碼錯誤');
    passcode.value = '';
    return;
  }
  await updateDoc(meeting.docs[0].ref, {
    participants: arrayUnion(loggedInUserClaims.clazz),
  });
  await router.push('/attendee/' + meeting.docs[0].id);
}

async function checkPunchedIn() {
  const punchedIn = await getDocs(
    query(rawMeetingCollection(), and(where('participants', 'array-contains', loggedInUserClaims.clazz), where('active', '==', true))),
  );
  if (punchedIn.docs.length != 0) {
    await router.push('/attendee/' + punchedIn.docs[0].id);
  }
}

async function onDetect(detectedCodes: any) {
  if (detectedCodes.length == 0) return;
  const code = detectedCodes[0].rawValue as string;
  if (!code.includes('#/punch_in/')) return;
  tempPasscode.value = code.split('#/punch_in/')[1];
  scanning.value = false;
  await submit();
}

if (passcode.value && passcode.value.length != 0) {
  punchIn();
} else {
  checkPunchedIn();
}
</script>

<style scoped></style>
