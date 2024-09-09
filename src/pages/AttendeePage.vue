<template>
  <q-page v-if="meeting" padding>
    <div v-if="!activeProposal || !activeProposal.value" class="text-h6">
      請等待會議主席開始審理議案
    </div>
    <div v-if="activeProposal && activeProposal.value && !activeVotable?.value">
      <div class="text-h6">正在審理議案</div>
      <q-btn
        color="primary"
        icon="chat"
        label="請求發言"
        @click="requestToSpeak()"
      />
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ activeProposal.value!.title }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-subtitle1">
            提案人：{{ activeProposal.value!.proposer }}
          </div>
          <div>{{ activeProposal.value!.content }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-subtitle1">附件：</div>
          <q-list>
            <q-item
              v-for="attachment of activeProposal.value!.attachments"
              :key="attachment"
              v-ripple
              :href="attachment"
              clickable
              target="_blank"
            >
              <q-item-section>{{ attachment }}</q-item-section>
              <q-item-section side>
                <q-icon name="visibility" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-separator />
      </q-card>
    </div>
    <div v-if="activeVotable && activeVotable.value">
      <div class="text-h6">
        請<b class="text-h5">點兩下</b>以送出投票，送出後無法更改
      </div>
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
              'col q-mr-md text-h5' +
              (selectedChoice == choice ? ' bg-amber' : '') +
              ((activeVotable.value.results[choice]
                ? activeVotable.value.results[choice]
                : []
              ).includes(getUserClaims().clazz)
                ? ' bg-green'
                : '')
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
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMeeting,
  getProposal,
  getVotable,
  rawProposalCollection,
  rawVotableCollection,
  Votable,
} from 'src/ts/models.ts';
import { getUserClaims } from 'src/ts/auth.ts';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { Notify } from 'quasar';

const id = ref(useRoute().params.id);
const meeting = getMeeting(id.value as string);
const activeProposalId = ref(null as string | null);
const activeProposal = computed(() =>
  activeProposalId.value == null
    ? null
    : getProposal(id.value as string, activeProposalId.value!),
);
const activeVotableId = ref(null as string | null);
const activeVotable = computed(() =>
  activeVotableId.value == null
    ? null
    : getVotable(
        id.value as string,
        activeProposalId.value!,
        activeVotableId.value!,
      ),
);
const selectedChoice = ref(null as string | null);
const router = useRouter();
const voted = computed(() => {
  if (!activeVotable.value) return false;
  const results = (activeVotable.value.value as unknown as Votable).results;
  for (const voters of Object.values(results)) {
    if (voters.includes(getUserClaims().clazz)) return true;
  }
  return false;
});
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
    if (!meeting.participants.includes(getUserClaims().clazz))
      router.push('/punch_in');
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
  (prop) => {
    if (prop && prop.value) {
      activeVotableId.value = prop.value.activeVotable;
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
      update[('results.' + choice) as keyof typeof update] = arrayUnion(
        getUserClaims().clazz,
      );
      await updateDoc(
        doc(
          rawVotableCollection(
            id.value as string,
            activeProposalId.value as string,
          ),
          activeVotableId.value as string,
        ),
        update,
      );
    } catch (e) {
      console.error(e);
      Notify.create({
        message: '投票失敗',
        color: 'negative',
      });
    }
    selectedChoice.value = null;
  } else {
    selectedChoice.value = choice;
  }
}

async function requestToSpeak() {
  try {
    await updateDoc(
      doc(rawProposalCollection(id.value as string), activeProposalId.value!),
      {
        speakRequests: arrayUnion(getUserClaims().clazz),
      },
    );
    Notify.create({
      message: '請求發言成功',
      color: 'positive',
    });
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '請求發言失敗',
      color: 'negative',
    });
  }
}
</script>

<style scoped></style>
