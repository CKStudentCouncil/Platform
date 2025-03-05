<template>
  <q-page v-if="meeting" padding>
    <div v-if="!activeProposal || !activeProposal.value" class="text-h6">請等待會議主席開始審理議案</div>
    <div v-if="activeProposal && activeProposal.value && !activeVotable?.value">
      <div class="text-h5 q-mb-sm q-mt-sm">正在審理議案</div>
      <q-btn class="q-mb-md text-h6 full-width" color="primary" icon="chat" label="請求發言" @click="requestToSpeak()" />
      <ProposalDisplay :proposal="activeProposal.value" />
    </div>
    <q-btn
      v-if="!activeVotable || !activeVotable.value"
      class="q-mt-md text-h6 full-width"
      color="primary"
      icon="visibility"
      label="檢視本次會議議案"
      @click="viewOtherProposals()"
    />
    <div v-if="activeVotable && activeVotable.value">
      <div class="text-h6 q-mb-sm">請<b class="text-h5">點兩下</b>以送出投票，送出後無法更改</div>
      <q-card>
        <q-card-section>
          <div class="text-h4">{{ activeVotable.value.question }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section class="row">
          <q-btn
            v-for="choice of activeVotable.value.choices"
            :key="choice"
            :class="
              'row full-width q-mr-md text-h4 q-mb-xl' +
              (selectedChoice == choice ? ' bg-amber' : '') +
              ((activeVotable.value.results[choice] ? activeVotable.value.results[choice] : []).includes(loggedInUserClaims.clazz) ? ' bg-green' : '')
            "
            :disable="voted"
            :label="choice"
            @click="select(choice)"
          >
          </q-btn>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
  <q-dialog v-model="viewingOtherProposals" persistent>
    <q-card>
      <q-card-section class="q-pa-none" style="width: 100%">
        <q-toolbar>
          <q-toolbar-title>
            <span class="q-pl-sm text-h6">{{ meeting?.name }} 議案</span>
          </q-toolbar-title>
          <q-btn align="right" color="negative" flat icon="close" @click="viewingOtherProposals = false" />
        </q-toolbar>
      </q-card-section>
      <q-separator />
      <q-card-section class="q-gutter-sm">
        <ProposalDisplay v-for="p of proposals" :key="p.id" ref="propRefs" :proposal="p" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getMeeting, getProposal, getVotable, ProposalId, rawProposalCollection, rawVotableCollection, Votable } from 'src/ts/models.ts';
import { arrayUnion, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Loading, Notify, QBtn } from 'quasar';
import { loggedInUserClaims } from 'src/ts/auth.ts';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import ProposalDisplay from 'components/ProposalDisplay.vue';

const id = ref(useRoute().params.id);
const meeting = getMeeting(id.value as string);
const activeProposalId = ref(null as string | null);
const activeProposal = computed(() => (activeProposalId.value == null ? null : getProposal(id.value as string, activeProposalId.value!)));
const activeVotableId = ref(null as string | null);
const activeVotable = computed(() =>
  activeVotableId.value == null ? null : getVotable(id.value as string, activeProposalId.value!, activeVotableId.value!),
);
const selectedChoice = ref(null as string | null);
const router = useRouter();
const viewingOtherProposals = ref(false);
const lastViewingOtherProposals = ref(false);
const proposals = ref([] as ProposalId[]);
const voted = computed(() => {
  if (!activeVotable.value) return false;
  const results = (activeVotable.value.value as unknown as Votable).results;
  for (const [choice, voters] of Object.entries(results)) {
    if (voters.includes(loggedInUserClaims.clazz)) {
      // eslint-disable-next-line vue/no-side-effects-in-computed-properties
      selectedChoice.value = choice;
      return true;
    }
  }
  return false;
});
const speakRequests = ref([] as string[]);
const propRefs = ref();
onMounted(() => {
  if (!id.value || id.value.length == 0) {
    router.push('/punch_in');
    return;
  }
});
watch(
  meeting,
  (meeting) => {
    if (!meeting) {
      router.push('/punch_in');
      return;
    }
    if (!meeting.participants.includes(loggedInUserClaims.clazz)) router.push('/punch_in');
    if (meeting.activeProposal) {
      activeProposalId.value = meeting.activeProposal;
    } else {
      activeProposalId.value = null;
    }
  },
  { deep: true },
);
watch(
  activeProposal,
  (prop, prevProp) => {
    if (prop && prop.value) {
      // Speak request notification
      if (prevProp && prevProp.value) {
        for (const speakRequest of prop.value.speakRequests) {
          if (!speakRequests.value.includes(speakRequest)) {
            Notify.create({
              message: `${speakRequest} 班代請求發言`,
              color: 'positive',
            });
          }
        }
      }
      // Close dialogs when voting starts
      if (prop.value.activeVotable && !activeVotableId.value) {
        if (viewingOtherProposals.value) {
          viewingOtherProposals.value = false;
          lastViewingOtherProposals.value = true;
        }
        if (propRefs.value) {
          for (const propRef of propRefs.value) {
            propRef.closeDialog();
          }
        }
      }
      // Reopen dialogs when voting ends
      if (!prop.value.activeVotable && activeVotableId.value) {
        if (lastViewingOtherProposals.value) {
          viewingOtherProposals.value = true;
          lastViewingOtherProposals.value = false;
        }
        if (propRefs.value) {
          for (const propRef of propRefs.value) {
            propRef.reopenDialog();
          }
        }
      }
      activeVotableId.value = prop.value.activeVotable;
      proposals.value = proposals.value.map((p) => {
        if (p.id == prop.value!.id) {
          return prop.value!;
        } else {
          return p;
        }
      }) as ProposalId[];
    } else {
      activeVotableId.value = null;
    }
  },
  { deep: true },
);

async function select(choice: string) {
  if (selectedChoice.value == choice) {
    try {
      const update = {} as any;
      update[('results.' + choice) as keyof typeof update] = arrayUnion(loggedInUserClaims.clazz);
      await updateDoc(doc(rawVotableCollection(id.value as string, activeProposalId.value as string), activeVotableId.value as string), update);
    } catch (e) {
      notifyError('投票失敗', e);
    }
    selectedChoice.value = null;
  } else {
    selectedChoice.value = choice;
  }
}

async function requestToSpeak() {
  try {
    await updateDoc(doc(rawProposalCollection(id.value as string), activeProposalId.value!), {
      speakRequests: arrayUnion(loggedInUserClaims.clazz),
    });
    notifySuccess('請求發言成功');
  } catch (e) {
    notifyError('請求發言失敗', e);
  }
}

async function viewOtherProposals() {
  Loading.show();
  proposals.value = [];
  const snapshot = await getDocs(rawProposalCollection(id.value as string));
  snapshot.forEach((doc) => {
    const proposal = doc.data() as ProposalId;
    proposals.value.push(proposal);
  });
  proposals.value = proposals.value.sort((a, b) => a.order - b.order);
  viewingOtherProposals.value = true;
  Loading.hide();
}
</script>

<style scoped></style>
