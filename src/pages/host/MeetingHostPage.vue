<template>
  <q-tabs align="left">
    <q-route-tab :to="`/meeting_host`" label="開會" />
    <q-route-tab :to="`/meeting_host/passive`" label="開會投影" />
    <q-route-tab v-if="activeMeeting" :to="`/meeting_host/${activeMeeting!.id}`" label="開放簽到" />
    <q-route-tab v-if="activeMeeting" :to="`/meeting_host/${activeMeeting!.id}/agenda`" label="審理議案" />
  </q-tabs>
  <q-page class="q-gutter-sm" padding>
    <span v-if="activeMeeting != null">開會中：{{ activeMeeting.name }}</span>
    <q-btn v-if="activeMeeting != null" color="negative" flat icon="stop" label="散會" @click="adjourn()" />
    <q-select v-model="meeting" :option-label="(m) => m.name" :options="meetings" label="選擇會議" />
    <q-btn color="positive" label="開會" @click="go" />
    <q-checkbox v-model="recordTime" label="記錄開會時間" />
  </q-page>
</template>

<script lang="ts" setup>
import type { Meeting} from 'src/ts/models.ts';
import { meetingCollectionOfCurrentReign, meetingConverter, rawMeetingCollection } from 'src/ts/models.ts';
import { ref, watch } from 'vue';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from 'vuefire';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

const meetings = meetingCollectionOfCurrentReign();
const recordTime = ref(true);

interface MeetingId extends Meeting {
  id: string;
}

const meeting = ref(null as MeetingId | null);
const activeMeeting = ref(null as MeetingId | null | undefined);
const db = useFirestore();
watch(
  meetings,
  (meetings) => {
    let found = false;
    meetings.forEach((m) => {
      if (m && m.active) {
        activeMeeting.value = m as unknown as MeetingId;
        found = true;
      }
    });
    if (!found) {
      activeMeeting.value = undefined;
    }
  },
  { deep: true },
);

async function go() {
  if (meeting.value) {
    try {
      const data = {
        active: true,
      } as any;
      if (recordTime.value) {
        data.start = new Date();
      }
      await updateDoc(doc(db, 'meetings', meeting.value.id).withConverter(meetingConverter), data);
    } catch (e) {
      notifyError('開會失敗', e);
    }
    notifySuccess('成功開會');
  }
}

async function adjourn() {
  if (activeMeeting.value) {
    try {
      await updateDoc(doc(rawMeetingCollection(), activeMeeting.value.id).withConverter(meetingConverter), {
        active: false,
        end: new Date(),
      });
    } catch (e) {
      notifyError('散會失敗', e);
    }
    notifySuccess('成功散會');
  }
}
</script>

<style scoped></style>
