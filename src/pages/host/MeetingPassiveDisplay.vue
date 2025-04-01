<template>
  <q-tabs align="left">
    <q-route-tab :to="`/meeting_host`" label="開會" />
    <q-route-tab :to="`/meeting_host/passive`" label="開會投影" />
    <q-route-tab v-if="activeMeeting" :to="`/meeting_host/${activeMeeting!.id}`" label="開放簽到" />
    <q-route-tab v-if="activeMeeting" :to="`/meeting_host/${activeMeeting!.id}/agenda`" label="審理議案" />
  </q-tabs>
  <q-page class="q-gutter-sm">
    <div v-if="activeMeeting">
      <MeetingVote
        v-if="activeVotableId && activeProposalId"
        :bar="false"
        :meeting-id="activeMeeting.id"
        :proposal-id="activeProposalId"
        :votable-id="activeVotableId"
      />
      <MeetingProposal v-else-if="activeProposalId" :bar="false" :meeting-id="activeMeeting.id" :proposal-id="activeProposalId" />
      <MeetingPunchIn v-else :bar="false" :meeting-id="activeMeeting.id" />
    </div>
    <h2 v-else class="row items-center justify-evenly absolute-center">正在等待開會</h2>
  </q-page>
</template>

<script lang="ts" setup>
import type { Meeting } from 'src/ts/models.ts';
import { meetingCollectionOfCurrentReign, rawProposalCollection } from 'src/ts/models.ts';
import { computed, ref, watch } from 'vue';
import { doc } from 'firebase/firestore';
import { useDocument } from 'vuefire';
import MeetingPunchIn from 'pages/host/MeetingPunchIn.vue';
import MeetingProposal from 'pages/host/MeetingProposal.vue';
import MeetingVote from 'pages/host/MeetingVote.vue';

const meetings = meetingCollectionOfCurrentReign();

interface MeetingId extends Meeting {
  id: string;
}

const activeMeeting = ref(null as MeetingId | null | undefined);
const activeProposalId = ref(null as string | null | undefined);
const activeProposalQ = computed(() => {
  if (activeProposalId.value == null) return null;
  return doc(rawProposalCollection(activeMeeting.value!.id), activeProposalId.value);
});
const activeProposal = useDocument(activeProposalQ);
const activeVotableId = ref(null as string | null | undefined);
watch(
  meetings,
  (meetings) => {
    let found = false;
    meetings.forEach((m) => {
      if (m && m.active) {
        activeMeeting.value = m as unknown as MeetingId;
        found = true;
        if (m.activeProposal) {
          activeProposalId.value = m.activeProposal;
        } else {
          activeProposalId.value = undefined;
          activeVotableId.value = undefined;
        }
      }
    });
    if (!found) {
      activeMeeting.value = undefined;
      activeProposalId.value = undefined;
      activeVotableId.value = undefined;
    }
  },
  { deep: true },
);
watch(
  activeProposal,
  (proposals) => {
    if (proposals && proposals.activeVotable) {
      activeVotableId.value = proposals.activeVotable;
    } else {
      activeVotableId.value = undefined;
    }
  },
  { deep: true },
);
</script>

<style scoped></style>
