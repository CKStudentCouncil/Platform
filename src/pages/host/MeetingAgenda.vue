<template>
  <q-tabs align="left">
    <q-route-tab :to="`/meeting_host`" label="開會" />
    <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}`" label="開放簽到" />
    <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`" label="審理議案" />
  </q-tabs>
  <q-tabs align="left">
    <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`" label="議程" />
    <q-route-tab
      v-if="selectedMeeting && activeProposalId"
      :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda/${activeProposalId}`"
      label="議案"
    />
  </q-tabs>
  <q-page padding>
    <div class="q-gutter-md">
      <q-btn color="primary" icon="settings" label="管理議案" @click="managingProposals = true" />
      <q-card v-for="prop of proposals.sort((a, b) => a.order - b.order)" :key="prop.order" :class="activeProposalId == prop.id ? 'bg-green-1' : ''">
        <q-card-section>
          <div class="text-h6">{{ prop.title }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-subtitle1">提案人：{{ prop.proposer }}</div>
          <div>{{ prop.content }}</div>
        </q-card-section>
        <q-separator />
        <q-card-actions>
          <q-btn color="positive" flat label="開始審理" @click="selectProposal(prop as ProposalId)" />
        </q-card-actions>
      </q-card>
    </div>
  </q-page>
  <q-dialog v-model="managingProposals">
    <q-card>
      <q-card-section>
        <q-toolbar>
          <q-space />
          <q-btn v-close-popup dense flat icon="close" round />
        </q-toolbar>
        <ManageProposalsPage :meeting-id="route.params.id as string" embed />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { useDocument, useFirestore } from 'vuefire';
import { useRoute, useRouter } from 'vue-router';
import { doc, updateDoc } from 'firebase/firestore';
import { meetingConverter, proposalCollection, ProposalId, rawMeetingCollection } from 'src/ts/models.ts';
import { ref, watch } from 'vue';
import { notifyError } from 'src/ts/utils.ts';
import { QBtn } from 'quasar';
import ManageProposalsPage from 'pages/mgmt/ManageProposalsPage.vue';

const db = useFirestore();
const route = useRoute();
const router = useRouter();
const selectedMeeting = useDocument(doc(db, 'meetings', route.params.id as string).withConverter(meetingConverter));
const proposals = proposalCollection(route.params.id as string);
const managingProposals = ref(false);
const activeProposalId = ref(null as string | null);

watch(
  selectedMeeting,
  (selectedMeeting) => {
    if (selectedMeeting && selectedMeeting.activeProposal) {
      activeProposalId.value = selectedMeeting.activeProposal;
    }
  },
  { deep: true },
);

async function selectProposal(proposal: ProposalId) {
  try {
    await updateDoc(doc(rawMeetingCollection(), route.params.id as string), {
      activeProposal: proposal.id,
    });
    await router.push(`/meeting_host/${route.params.id}/agenda/${proposal.id}`);
  } catch (e) {
    notifyError('開始審理失敗', e);
  }
}
</script>

<style scoped></style>
