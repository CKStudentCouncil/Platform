<template>
  <q-page v-if="meeting" padding>
    <div v-if="!activeProposal" class="text-h6">
      {{ loggedInUserClaims.clazz }} {{ translateRole(loggedInUserClaims.role) }}
      {{ cleanseName(loggedInUser?.displayName) }} 您好：<br />請等待會議主席開始審理議案
    </div>
    <div v-if="activeProposal && !activeVotable">
      <div class="text-h5 q-mb-sm q-mt-sm">正在審理議案</div>
      <q-btn
        v-if="!activeProposal.speakRequests.includes(loggedInUserClaims.clazz)"
        class="q-mb-md text-h6 full-width"
        color="primary"
        icon="chat"
        label="請求發言"
        @click="requestToSpeak()"
      />
      <q-btn
        v-else
        class="q-mb-md text-h6 full-width"
        color="negative"
        icon="speaker_notes_off"
        label="撤回發言請求"
        @click="withdrawSpeakRequest()"
      />
      <ProposalDisplay :proposal="activeProposal" />
    </div>
    <q-btn
      v-if="!activeVotable || !activeVotable"
      class="q-mt-md text-h6 full-width"
      color="secondary"
      icon="visibility"
      label="檢視本次會議議案"
      @click="viewOtherProposals()"
    />
    <div v-if="activeVotable">
      <div class="text-h6 q-mb-sm">請<b class="text-h5">點兩下</b>以送出投票，送出後無法更改</div>
      <q-card>
        <q-card-section>
          <div class="text-h4">{{ activeVotable.question }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section class="row">
          <q-btn
            v-for="choice of activeVotable.choices"
            :key="choice"
            :class="'row full-width q-mr-md text-h4 q-mb-xl' + (selectedChoice == choice ? ' bg-amber' : '') + (voted == choice ? ' bg-green' : '')"
            :disable="!!voted"
            :label="choice"
            @click="select(choice)"
          >
          </q-btn>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
  <q-dialog v-model="viewingOtherProposals" persistent>
    <q-card :style="$q.screen.lt.sm ? 'min-width: 100vw' : 'min-width: 60vw'">
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
import type { Proposal, ProposalId } from 'src/ts/models.ts';
import { getMeeting, rawMeetingCollection, rawProposalCollection, rawVotableCollection } from 'src/ts/models.ts';
import { arrayRemove, arrayUnion, doc, getDocFromServer, getDocs, updateDoc } from 'firebase/firestore';
import { Loading, QBtn } from 'quasar';
import { loggedInUser, loggedInUserClaims, translateRole } from 'src/ts/auth.ts';
import { cleanseName, notifyError, notifySpeakRequests, notifySuccess } from 'src/ts/utils.ts';
import ProposalDisplay from 'components/ProposalDisplay.vue';
import { useDocument } from 'vuefire';
import { guardListener, isRulesDenial } from 'src/ts/firestore.ts';

const id = useRoute().params.id as string;
// `/attendee/<id>` is the QR code students scan on the way into the room, so a
// cold, signed-out load is the normal case here rather than an edge one. Waiting
// for auth keeps the listener shut until the rules can say yes; opening it early
// only bought a `permission-denied` that Firestore never retries.
const meeting = getMeeting(() => (loggedInUser.value ? id : null));
const activeProposalId = ref(null as string | null);
const activeProposalQ = computed(() => (activeProposalId.value == null ? null : doc(rawProposalCollection(id), activeProposalId.value)));
const activeProposal = guardListener(useDocument(activeProposalQ, { reset: true }), 'AttendeePage activeProposal');
const activeVotableId = ref(null as string | null);
const activeVotableQ = computed(() =>
  activeVotableId.value == null ? null : doc(rawVotableCollection(id, activeProposalId.value!), activeVotableId.value),
);
const activeVotable = guardListener(useDocument(activeVotableQ, { reset: true }), 'AttendeePage activeVotable');
const selectedChoice = ref(null as string | null);
const router = useRouter();
const viewingOtherProposals = ref(false);
const lastViewingOtherProposals = ref(false);
const proposals = ref([] as ProposalId[]);
const voted = computed(() => {
  if (!activeVotable.value) return false;
  const results = activeVotable.value.results;
  for (const [choice, voters] of Object.entries(results)) {
    if (voters.includes(loggedInUserClaims.clazz)) {
      return choice;
    }
  }
  return null;
});
const propRefs = ref();
onMounted(() => {
  if (!id || id.length == 0) {
    void router.push('/punch_in');
    return;
  }
});
watch(
  meeting,
  (meeting) => {
    if (!meeting) {
      void router.push('/punch_in');
      return;
    }
    if (!meeting.participants.includes(loggedInUserClaims.clazz)) void router.push('/punch_in');
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
    if (prop) {
      // Speak request notification
      notifySpeakRequests(prop as Proposal, prevProp as Proposal);
      // Close dialogs when voting starts
      if (prop.activeVotable && !activeVotableId.value) {
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
      if (!prop.activeVotable && activeVotableId.value) {
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
      activeVotableId.value = prop.activeVotable;
      proposals.value = proposals.value.map((p) => {
        if (p.id == prop.id) {
          return prop;
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

/**
 * Why `firestore.rules` turned a vote away, when turning it away was right.
 *
 * The rules take a vote only while the host still has that votable open, from a
 * class that has punched in and has not voted yet. A student can tap a moment
 * after the host closes the vote, or vote from a second device, and the write
 * is refused with the same bare `permission-denied` either way. Those refusals
 * are the rules doing their job: name the reason and keep them out of Sentry.
 *
 * A vote that looked valid when the server is asked comes back `null`, and is
 * reported like any other failure, because that would be this page and the rules
 * disagreeing. This reads the server rather than the listeners, since a lagging
 * listener is the usual reason the page offered the vote in the first place.
 */
async function explainRefusedVote(proposalId: string, votableId: string): Promise<string | null> {
  try {
    const clazz = loggedInUserClaims.clazz;
    const [meetingSnap, proposalSnap, votableSnap] = await Promise.all([
      getDocFromServer(doc(rawMeetingCollection(), id)),
      getDocFromServer(doc(rawProposalCollection(id), proposalId)),
      getDocFromServer(doc(rawVotableCollection(id, proposalId), votableId)),
    ]);
    if (meetingSnap.get('activeProposal') !== proposalId || proposalSnap.get('activeVotable') !== votableId) return '此投票已結束';
    if (!((meetingSnap.get('participants') ?? []) as string[]).includes(clazz)) return '貴班尚未簽到';
    const voters = (votableSnap.get('voters') ?? {}) as Record<string, string>;
    const results = (votableSnap.get('results') ?? {}) as Record<string, string[]>;
    if (clazz in voters || Object.values(results).some((classes) => classes.includes(clazz))) return '貴班已投過票，無法更改';
  } catch {
    // The server could not be asked (offline, or refused again): let the original error be reported.
  }
  return null;
}

async function select(choice: string) {
  if (selectedChoice.value == choice) {
    // Captured now: the host can close the vote while the write is in flight.
    const proposalId = activeProposalId.value as string;
    const votableId = activeVotableId.value as string;
    try {
      const update = {} as any;
      update[('results.' + choice) as keyof typeof update] = arrayUnion(loggedInUserClaims.clazz);
      // `firestore.rules` accepts a vote only together with the class's entry in `voters` (class -> choice).
      update[('voters.' + loggedInUserClaims.clazz) as keyof typeof update] = choice;
      await updateDoc(doc(rawVotableCollection(id, proposalId), votableId), update);
    } catch (e) {
      const reason = isRulesDenial(e) ? await explainRefusedVote(proposalId, votableId) : null;
      if (reason) {
        notifyError(`投票失敗：${reason}`, e, { report: false });
      } else {
        notifyError('投票失敗', e);
      }
    }
    selectedChoice.value = null;
  } else {
    selectedChoice.value = choice;
  }
}

async function requestToSpeak() {
  try {
    await updateDoc(doc(rawProposalCollection(id), activeProposalId.value!), {
      speakRequests: arrayUnion(loggedInUserClaims.clazz),
    });
    notifySuccess('請求發言成功');
  } catch (e) {
    notifyError('請求發言失敗', e);
  }
}

async function withdrawSpeakRequest() {
  try {
    await updateDoc(doc(rawProposalCollection(id), activeProposalId.value!), {
      speakRequests: arrayRemove(loggedInUserClaims.clazz),
    });
    notifySuccess('撤回發言請求成功');
  } catch (e) {
    notifyError('撤回發言請求失敗', e);
  }
}

async function viewOtherProposals() {
  Loading.show();
  proposals.value = [];
  const snapshot = await getDocs(rawProposalCollection(id));
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
