<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab :to="`/meeting_host`" label="開會" />
      <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}`" label="開放簽到" />
      <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`" label="審理議案" />
    </q-tabs>
    <q-tabs align="left">
      <q-route-tab v-if="selectedMeeting" :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`" label="議程" />
      <q-route-tab
        v-if="selectedMeeting && selectedProposal"
        :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda/${selectedProposal.id}`"
        label="議案"
      />
      <q-route-tab
        v-if="selectedMeeting && selectedProposal && activeVotableId"
        :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda/${selectedProposal.id}/vote/${activeVotableId}`"
        label="投票"
      />
    </q-tabs>
    <div v-if="selectedProposal" class="row q-pa-md q-gutter-xl">
      <div class="col-5">
        <q-card class="q-mb-md">
          <q-card-section>
            <div class="text-h6">發言清單</div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <q-list bordered>
              <q-item v-for="speaker of selectedProposal.speakRequests" :key="speaker">
                <q-item-section>{{ speaker }}</q-item-section>
                <q-item-section side>
                  <q-btn color="positive" flat icon="check" @click="removeSpeakRequest(speaker)" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
        <ProposalDisplay :proposal="selectedProposal" endable @end="endProposal" />
      </div>
      <div class="col-5">
        <q-btn color="primary" icon="settings" label="管理投票案件" @click="managingVotables = true" />
        <q-card
          v-for="votable of votables.sort((a, b) => a!.order - b!.order)"
          :key="votable!.order"
          :class="activeVotableId == (votable as any).id ? 'bg-green-1 q-mt-sm' : 'q-mt-sm'"
        >
          <q-card-section>
            <div class="text-h6">{{ votable!.question }}</div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div>選項：{{ votable!.choices.join('、') }}</div>
          </q-card-section>
          <q-separator />
          <q-card-actions>
            <q-btn color="primary" flat label="開始投票" @click="selectVotable(votable)" />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </q-page>
  <q-dialog v-model="managingVotables">
    <q-card>
      <q-card-section>
        <q-toolbar>
          <q-space />
          <q-btn v-close-popup dense flat icon="close" round />
        </q-toolbar>
        <ManageVotablesPage :meeting-id="route.params.id as string" :proposal-id="route.params.proposalId as string" embed />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { arrayRemove, doc, updateDoc } from 'firebase/firestore';
import { getMeeting, getProposal, rawMeetingCollection, rawProposalCollection, votableCollection } from 'src/ts/models.ts';
import { useRoute, useRouter } from 'vue-router';
import { QBtn, QItemSection } from 'quasar';
import { ref, watch } from 'vue';
import ProposalDisplay from 'components/ProposalDisplay.vue';
import ManageVotablesPage from 'pages/mgmt/ManageVotablesPage.vue';
import { notifyError } from 'src/ts/utils.ts';

const route = useRoute();
const selectedMeeting = getMeeting(route.params.id as string);
const selectedProposal = getProposal(route.params.id as string, route.params.proposalId as string);
let activeVotableId = ref(null as string | null);
watch(
  selectedProposal,
  (selectedProposal) => {
    if (selectedProposal && selectedProposal.activeVotable) {
      activeVotableId.value = selectedProposal.activeVotable;
    }
  },
  { deep: true },
);
const votables = votableCollection(route.params.id as string, route.params.proposalId as string);
const router = useRouter();
const managingVotables = ref(false);

async function selectVotable(votable: any) {
  try {
    await updateDoc(doc(rawProposalCollection(route.params.id as string), route.params.proposalId as string), {
      activeVotable: votable.id,
    });
    await router.push(`/meeting_host/${route.params.id}/agenda/${route.params.proposalId}/vote/${votable.id}`);
  } catch (e) {
    console.error(e);
    notifyError('開始審理失敗', e);
  }
}

async function endProposal() {
  try {
    await updateDoc(doc(rawMeetingCollection(), route.params.id as string), {
      activeProposal: null,
    });
    await router.push(`/meeting_host/${route.params.id}/agenda`);
  } catch (e) {
    console.error(e);
    notifyError('結束議案失敗', e);
  }
}

async function removeSpeakRequest(speaker: string) {
  await updateDoc(doc(rawProposalCollection(route.params.id as string), route.params.proposalId as string), {
    speakRequests: arrayRemove(speaker),
  });
}
</script>

<style scoped></style>
