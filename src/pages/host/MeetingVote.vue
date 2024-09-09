<template>
  <q-tabs align="left">
    <q-route-tab :to="`/meeting_host`" label="開會" />
    <q-route-tab
      v-if="selectedMeeting"
      :to="`/meeting_host/${(selectedMeeting! as any).id}`"
      label="開放簽到"
    />
    <q-route-tab
      v-if="selectedMeeting"
      :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`"
      label="審理議案"
    />
  </q-tabs>
  <q-tabs align="left">
    <q-route-tab
      v-if="selectedMeeting"
      :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda`"
      label="議程"
    />
    <q-route-tab
      v-if="selectedMeeting && selectedProposal"
      :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda/${selectedProposal.id}`"
      label="議案"
    />
    <q-route-tab
      v-if="selectedMeeting && selectedProposal && selectedVotable"
      :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda/${selectedProposal.id}/vote/${selectedVotable.id}`"
      label="投票"
    />
  </q-tabs>
  <q-page v-if="selectedVotable" padding>
    <div class="text-h3 q-pb-md">投票：{{ selectedVotable.question }}</div>
    <q-btn
      class="q-mb-md"
      color="negative"
      flat
      icon="stop"
      label="結束投票"
      @click="endVote()"
    />
    <div class="row q-gutter-xl">
      <q-card
        v-for="choice of selectedVotable.choices"
        :key="choice"
        class="col"
      >
        <q-card-section>
          <div class="text-h4">{{ choice }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div style="display: table-row">
            <div class="text-h3" style="display: table-cell">
              {{
                selectedVotable.results[choice] == undefined
                  ? 0
                  : (selectedVotable.results[choice] as string[]).length
              }}
            </div>
            <span style="vertical-align: bottom; display: table-cell"> 票</span>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <transition
            v-for="voter of selectedVotable.results[choice] as string[]"
            :key="voter"
            appear
            enter-active-class="animated heartBeat"
          >
            <q-chip removable @remove="removeVoter(choice, voter)"
              >{{ voter }}
            </q-chip>
          </transition>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { useFirestore } from 'vuefire';
import { useRoute, useRouter } from 'vue-router';
import { arrayRemove, collection, doc, updateDoc } from 'firebase/firestore';
import {
  getMeeting,
  getProposal,
  getVotable,
  rawVotableCollection,
} from 'src/ts/models.ts';
import { Notify } from 'quasar';

const db = useFirestore();
const route = useRoute();
const router = useRouter();
const selectedMeeting = getMeeting(route.params.id as string);
const selectedProposal = getProposal(
  route.params.id as string,
  route.params.proposalId as string,
);
const selectedVotable = getVotable(
  route.params.id as string,
  route.params.proposalId as string,
  route.params.voteId as string,
);

async function removeVoter(choice: string, voter: string) {
  const update = {} as any;
  update[('results.' + choice) as keyof typeof update] = arrayRemove(voter);
  await updateDoc(
    doc(
      rawVotableCollection(
        route.params.id as string,
        route.params.proposalId as string,
      ),
      route.params.voteId as string,
    ),
    update,
  );
}

async function endVote() {
  try {
    await updateDoc(
      doc(
        collection(db, `meetings/${route.params.id}/proposals`),
        route.params.proposalId as string,
      ),
      {
        activeVotable: null,
      },
    );
    await router.push(
      `/meeting_host/${route.params.id}/agenda/${route.params.proposalId}`,
    );
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '結束投票失敗',
      color: 'negative',
    });
  }
}
</script>

<style scoped></style>
