<template>
  <q-page>
    <div class="q-ma-md">
      <q-card v-if="proposal" class="q-mt-md">
        <q-card-section>
          <div class="text-h5">{{ proposal.title }}</div>
          <div class="text-subtitle2">類型： {{ translateProposalType(proposal.type) }}</div>
          <div class="text-subtitle2">提案人： {{ proposal.proposer }}</div>
          <div v-if="proposal.basis" class="text-subtitle2">法源依據： {{ proposal.basis }}</div>
        </q-card-section>
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">提案說明：</div>
          <div class="text-body1">{{ proposal.content }}</div>
        </q-card-section>
        <q-card-section v-if="proposal.attachments && proposal.attachments.length > 0">
          <div class="text-subtitle2 q-mb-sm">附件:</div>
          <q-list>
            <q-item v-for="attachment in proposal.attachments" :key="attachment">
              <q-item-section style="overflow-wrap: anywhere">{{ attachment }}</q-item-section>
              <q-item-section side>
                <q-btn flat dense :href="attachment" icon="open_in_new" target="_blank">
                  <q-tooltip>在新視窗開啟</q-tooltip>
                </q-btn>
              </q-item-section>
              <q-item-section side>
                <q-btn flat dense icon="visibility" @click="activeUrl = attachment">
                  <q-tooltip>在網頁內預覽</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">現有連署人：</div>
          <q-chip v-for="cosigner in proposal.cosigners || []" :key="cosigner.name" color="primary" text-color="white" icon="person">
            {{ cosigner.classNum }} {{ cosigner.jobTitle }} {{ cosigner.name }}
          </q-chip>
          <div v-if="!proposal.cosigners || proposal.cosigners.length === 0" class="text-grey-6">無連署人</div>
        </q-card-section>
        <q-card-section>
          <q-separator class="q-mb-md" />
          <div class="text-h6 q-mb-md">加入連署 <q-btn color="primary" label="加入連署" @click="addCosigner" class="q-ml-md align-right" /></div>
          <q-input v-model="cosigner.name" label="姓名(不需填寫班級或職稱)" dense class="q-mr-sm" @keyup.enter="addCosigner" />
        </q-card-section>
      </q-card>
      <div v-else-if="loading" class="text-center q-mt-xl">
        <q-spinner color="primary" size="3em" />
        <div class="q-mt-md">載入中...</div>
      </div>
      <div v-else class="text-center q-mt-xl text-negative">找不到提案或您沒有權限查看此提案。</div>
    </div>
  </q-page>
  <q-dialog :model-value="!!activeUrl" persistent>
    <q-card :style="$q.screen.lt.sm ? 'min-width: 100vw' : 'min-width: 60vw'">
      <q-card-section style="width: 100%">
        <q-btn class="q-mb-sm" color="negative" flat icon="close" style="float: right" @click="activeUrl = ''" />
        <q-btn :href="activeUrl" flat icon="open_in_new" style="float: right" target="_blank" />
      </q-card-section>
      <q-card-section>
        <iframe :height="$q.screen.height - 200" :src="getGoogleFileEmbed(activeUrl)" allow="autoplay" class="no-print" width="100%" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { doc, getDoc, updateDoc, collection } from 'firebase/firestore';
import { useFirestore } from 'vuefire';
import type { ProposalId } from 'src/ts/proposalmodels.ts';
import { proposalConverter, translateProposalType } from 'src/ts/proposalmodels.ts';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import { loggedInUser, loggedInUserClaims } from 'src/ts/auth.ts';
import type { PersonRecord } from 'src/ts/proposalmodels.ts';
import { log } from 'node:console';

const route = useRoute();
const db = useFirestore();
const proposal = ref<ProposalId | null>(null);
const loading = ref(true);
const cosigner = ref<PersonRecord>({
  classNum: (Array.isArray(loggedInUserClaims.clazz) ? loggedInUserClaims.clazz[0] : loggedInUserClaims.clazz) ?? '',
  jobTitle:
    loggedInUserClaims.role === 50
      ? '班代'
      : loggedInUserClaims.role === 150
        ? '副議長'
        : loggedInUserClaims.role === 200
          ? '議長'
          : loggedInUserClaims.role === 999
            ? '議長'
            : '',
  name: '',
});
const activeUrl = ref('');

async function loadProposal() {
  const userId = route.params.userId as string;
  const proposalId = route.params.proposalId as string;

  const types = ['law', 'general', 'presentation'];
  for (const t of types) {
    try {
      const collectionRef = collection(db, `proposal/${t}/${userId}/`).withConverter(proposalConverter);
      const docRef = doc(collectionRef, proposalId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        proposal.value = { id: snapshot.id, ...snapshot.data()!, type: t };
        break;
      }
    } catch (e) {
      console.warn(`Error loading ${t} proposal:`, e);
    }
  }
  loading.value = false;
}

async function addCosigner() {
  if (!loggedInUser.value) {
    notifyError('請先登入');
    return;
  }
  if (!proposal.value) return;
  if (!cosigner.value.name.trim()) {
    notifyError('請填寫姓名');
    return;
  }

  const newCosigner: PersonRecord = {
    classNum: (Array.isArray(loggedInUserClaims.clazz) ? loggedInUserClaims.clazz[0] : loggedInUserClaims.clazz) ?? cosigner.value.classNum.trim(),
    jobTitle:
      loggedInUserClaims.role === 50
        ? '班代'
        : loggedInUserClaims.role === 150
          ? '副議長'
          : loggedInUserClaims.role === 200
            ? '議長'
            : loggedInUserClaims.role === 999
              ? '議長'
              : '',
    name: cosigner.value.name.trim(),
  };

  // Check if already cosigned
  if (proposal.value.cosigners?.some((c) => c.classNum === newCosigner.classNum)) {
    notifyError('您已經連署過此提案');
    return;
  }

  try {
    const collectionRef = collection(db, `proposal/${proposal.value.type}/${route.params.userId as string}/`).withConverter(proposalConverter);
    const updatedCosigners = [...(proposal.value.cosigners || []), newCosigner];
    await updateDoc(doc(collectionRef, proposal.value.id), { cosigners: updatedCosigners });

    proposal.value.cosigners = updatedCosigners;
    cosigner.value = { classNum: '', jobTitle: '', name: '' };
    notifySuccess('連署成功');
  } catch (e) {
    notifyError('連署失敗', e);
  }
}

function downloadAttachment(url: string) {
  window.open(url, '_blank');
}

function getGoogleFileEmbed(input: string) {
  let file_id = null;
  const driveCapture = input.match(/https:\/\/drive\.google\.com\/file\/d\/(.*)\/view.*/);
  if (driveCapture && driveCapture.length > 1) {
    file_id = driveCapture[1];
  }
  const documentCapture = input.match(/https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/(.*)\/edit.*/);
  if (documentCapture && documentCapture.length > 2) {
    file_id = documentCapture[2];
  }
  if (file_id) {
    return `https://drive.google.com/file/d/${file_id}/preview`;
  }
  return input;
}

onMounted(() => {
  void loadProposal();
});
</script>
