<template>
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
      v-if="selectedMeeting && selectedProposal && selectedVotable"
      :to="`/meeting_host/${(selectedMeeting! as any).id}/agenda/${selectedProposal.id}/vote/${(selectedVotable as any).id}`"
      label="投票"
    />
  </q-tabs>
  <q-page v-if="selectedVotable" padding>
    <div class="text-h3 q-pb-md">投票：{{ selectedVotable.question }}</div>
    <q-btn class="q-mb-md" color="negative" flat icon="stop" label="結束投票" @click="endVote()" />
    <div class="row q-gutter-xl">
      <q-card v-for="choice of selectedVotable.choices" :key="choice" class="col">
        <q-card-section>
          <div class="text-h4">{{ choice }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div style="display: table-row">
            <div class="text-h3" style="display: table-cell">
              {{ selectedVotable.results[choice] == undefined ? 0 : (selectedVotable.results[choice] as string[]).length }}
            </div>
            <span style="vertical-align: bottom; display: table-cell">/ {{ threshold }} 票</span>
          </div>
          <q-btn
            v-if="(selectedVotable.results[choice] == undefined ? 0 : (selectedVotable.results[choice] as string[]).length) >= threshold"
            :label="'已過' + thresholdLabel"
            color="positive"
            flat
            icon="check"
          />
          <q-btn v-else :label="'未過' + thresholdLabel" color="negative" flat icon="close" />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <transition v-for="voter of selectedVotable.results[choice] as string[]" :key="voter" appear enter-active-class="animated heartBeat">
            <q-chip removable @remove="removeVoter(choice, voter)">{{ voter }} 班代</q-chip>
          </transition>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { arrayRemove, doc, updateDoc } from 'firebase/firestore';
import { getMeeting, getProposal, getVotable, rawProposalCollection, rawVotableCollection, VotableType } from 'src/ts/models.ts';
import { computed } from 'vue';
import { notifyError } from 'src/ts/utils.ts';

const route = useRoute();
const router = useRouter();
const selectedMeeting = getMeeting(route.params.id as string);
const selectedProposal = getProposal(route.params.id as string, route.params.proposalId as string);
const selectedVotable = getVotable(route.params.id as string, route.params.proposalId as string, route.params.voteId as string);
const threshold = computed(() => {
  if (selectedVotable.value) {
    switch (selectedVotable.value.type.firebase) {
      case VotableType.Absolute.firebase:
        return Math.ceil(selectedMeeting.value!.participants.length / 2);
      case VotableType.AbsoluteTwoThirds.firebase:
        return Math.ceil((selectedMeeting.value!.participants.length / 3) * 2);
      case VotableType.Relative.firebase:
        let n = 0;
        for (const i of Object.values(selectedVotable.value.results)) {
          n += i.length;
        }
        return Math.ceil(n / 2);
    }
  }
  return 0;
});
const thresholdLabel = computed(() => {
  if (selectedVotable.value) {
    switch (selectedVotable.value.type.firebase) {
      case VotableType.Absolute.firebase:
        return '出席半數';
      case VotableType.AbsoluteTwoThirds.firebase:
        return '出席三分之二';
      case VotableType.Relative.firebase:
        return '相對多數';
    }
  }
  return '';
});

async function removeVoter(choice: string, voter: string) {
  const update = {} as any;
  update[('results.' + choice) as keyof typeof update] = arrayRemove(voter);
  await updateDoc(doc(rawVotableCollection(route.params.id as string, route.params.proposalId as string), route.params.voteId as string), update);
}

async function endVote() {
  try {
    await updateDoc(doc(rawProposalCollection(route.params.id as string), route.params.proposalId as string), {
      activeVotable: null,
    });
    await router.push(`/meeting_host/${route.params.id}/agenda/${route.params.proposalId}`);
  } catch (e) {
    notifyError('結束投票失敗', e);
  }
}
</script>

<style scoped></style>
