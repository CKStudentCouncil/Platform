<template>
  <q-page>
    <div class="q-ma-md">
      <q-table :columns="columns" :filter="filter" :loading="loading" :rows="proposals" :title="`${getCurrentReign()} 我的提案`" row-key="id">
        <template v-slot:top-right>
          <q-btn color="primary" label="新增提案" @click="showAddDialog = true" class="q-mr-md" />
          <q-input v-model="filter" debounce="300" dense placeholder="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              v-if="!props.row.submittedAt && loggedInUserClaims.role !== 25"
              class="text-blue-9 q-ml-sm q-mr-sm"
              round
              icon="link"
              @click="copyCoSignLink(props.row)"
            >
              <q-tooltip>複製連署連結</q-tooltip>
            </q-btn>
            <q-btn
              v-if="!props.row.submittedAt"
              class="text-green-9 q-ml-sm q-mr-sm"
              round
              icon="cloud_upload"
              @click="uploadProposalToSystem(props.row)"
            >
              <q-tooltip>上傳至系統</q-tooltip>
            </q-btn>
            <q-icon v-if="props.row.submittedAt" name="cloud_done" color="green" size="md">
              <q-tooltip>已上傳至系統</q-tooltip>
            </q-icon>
            <q-btn class="text-red-9 q-ml-sm q-mr-sm" round icon="delete" @click="deleteProposal(props.row)" />
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="showAddDialog" persistent maximized>
      <q-card style="max-width: 100%; min-width: 320px">
        <q-stepper v-model="step" ref="stepper" color="primary" animated>
          <q-step :name="1" title="建立提案" icon="edit" :done="step > 1">
            <q-input area-required v-model="newProposal.title" label="標題 例：法規標準法修正案" stack-label />
            <q-input area-required v-model="newProposal.basis" label="法源依據 例：班代大會議事規則第六條" stack-label />
            <q-input area-required v-model="newProposal.proposer" label="提案人(班級 職稱 姓名) 例：322 班代 詹閎威" stack-label class="q-mt-sm" />
            <q-select area-required v-model="newProposal.type" :options="proposalTypes" label="類型" emit-value map-options class="q-mt-sm" />
            <q-input area-required v-model="newProposal.content" label="提案說明" type="textarea" stack-label />
            <br v-if="newProposal.type === 'law' || loggedInUserClaims.role === 25" />
            <div v-if="newProposal.type === 'law' || loggedInUserClaims.role === 25">
              <div v-if="loggedInUserClaims.role >= 50">條文對照表：</div>
              <div v-if="loggedInUserClaims.role === 25 && newProposal.type === 'law'">相關公文與條文對照表：</div>
              <div v-if="loggedInUserClaims.role === 25 && newProposal.type != 'law'">相關公文：</div>
              <ListEditor v-model="newProposal.attachments" /><br />
              <AttachmentUploader area-required ref="attachmentUploader" @uploaded="addAttachments" />
            </div>
          </q-step>

          <q-step :name="2" title="產生連署連結" icon="link" :done="step > 2" v-if="loggedInUserClaims.role !== 25">
            <div class="q-mb-md">
              <p>提案已建立。您可以複製以下連結分享給連署人：</p>
              <q-input
                v-model="cosignLink"
                readonly
                label="連署連結"
                stack-label
                class="q-mt-sm"
                @click="cosignLinkInput?.select()"
                ref="cosignLinkInput"
              >
                <template v-slot:append>
                  <q-btn flat round icon="content_copy" @click="copyCosignLink" />
                </template>
              </q-input>
            </div>
            <div class="text-caption text-grey-7 q-mb-md">連署人必須登入系統才能連署。</div>
            <div v-if="currentProposal" class="q-mt-md">
              <div class="text-subtitle2 q-mb-sm">目前連署人：</div>
              <q-chip v-for="cosigner in currentProposal.cosigners || []" :key="cosigner.name" color="primary" text-color="white" icon="person">
                {{ cosigner.classNum }} {{ cosigner.jobTitle }} {{ cosigner.name }}
              </q-chip>
              <div v-if="!currentProposal.cosigners || currentProposal.cosigners.length === 0" class="text-grey-6">尚無連署人</div>
            </div>
          </q-step>

          <q-step :name="3" title="上傳至系統" icon="cloud_upload" :done="step > 3">
            <div class="q-mb-md">
              <div class="row q-gutter-sm q-mb-md">
                <q-btn color="primary" icon="edit" label="編輯提案" @click="step = 1" />
                <q-btn color="info" icon="refresh" label="重新載入" @click="refreshCurrentProposal" />
              </div>
              <p>請確認以下提案資訊，確認無誤後按「上傳」將提案提交至系統：</p>
            </div>

            <q-card class="q-mt-md" v-if="currentProposal">
              <q-card-section>
                <div class="text-h6">{{ currentProposal.title }}</div>
                <div class="text-subtitle2">類型： {{ translateProposalType(currentProposal.type) }}</div>
                <div class="text-subtitle2">提案人： {{ currentProposal.proposer }}</div>
                <div v-if="currentProposal.basis" class="text-subtitle2">法源依據： {{ currentProposal.basis }}</div>
              </q-card-section>
              <q-card-section>
                <div class="text-body1">{{ currentProposal.content }}</div>
              </q-card-section>
              <q-card-section v-if="currentProposal.attachments && currentProposal.attachments.length > 0">
                <div class="text-subtitle2 q-mb-sm">附件：</div>
                <q-list>
                  <q-item v-for="attachment in currentProposal.attachments" :key="attachment">
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
                <div class="text-subtitle2 q-mb-sm">連署人：</div>
                <q-chip v-for="cosigner in currentProposal.cosigners || []" :key="cosigner.name" color="primary" text-color="white" icon="person">
                  {{ cosigner.classNum }} {{ cosigner.jobTitle }} {{ cosigner.name }}
                </q-chip>
                <div v-if="!currentProposal.cosigners || currentProposal.cosigners.length === 0" class="text-grey-6">無連署人</div>
              </q-card-section>
            </q-card>

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
          </q-step>
        </q-stepper>

        <q-card-actions align="right">
          <q-btn v-if="step > 1" flat label="上一步" @click="prevStep" />
          <q-btn v-if="step < 3" flat label="下一步" color="primary" @click="nextStep" />
          <!-- <q-btn v-if="step === 3" flat label="上傳" color="positive" @click="submitProposal" /> -->
          <q-btn v-if="step === 3" flat label="創建提案" color="positive" @click="laterUpload" />
          <q-btn flat label="取消" color="negative" @click="cancelDialog" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { QTableColumn } from 'quasar';
import { Loading, Notify } from 'quasar';
import { deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { loggedInUser, loggedInUserClaims, translateRole } from 'src/ts/auth.ts';
import type { ProposalId, PersonRecord } from 'src/ts/proposalmodels.ts';
import {
  generateProposalId,
  rawUserProposalCollectionGeneral as collectgeneral,
  rawUserProposalCollectionLaw as collectlaw,
  rawUserProposalCollectionPresentation as collectpresentation,
  translateProposalType,
} from 'src/ts/proposalmodels.ts';
import { getCurrentReign, notifyError, notifySuccess } from 'src/ts/utils.ts';
import ListEditor from 'components/ListEditor.vue';
import AttachmentUploader from 'components/AttachmentUploader.vue';
import { Role } from 'app/shared/models';

const filter = ref('');
const loading = ref(false);
const showAddDialog = ref(false);
const proposals = ref<any[]>([]);
const step = ref(1);
const cosignLink = ref('');
const cosignLinkInput = ref<any>(null);
const createdProposalId = ref('');
const currentProposal = ref<any>(null);
const activeUrl = ref('');

const proposalTypes = computed(() => [
  { label: '法律修正案', value: 'law' },
  { label: '一般提案', value: 'general' },
  { label: '專案報告', value: 'presentation' },
  ...(loggedInUserClaims.role === 25
    ? [
        { label: '人事案', value: 'nomination' },
        { label: '學代選舉案', value: 'election' },
      ]
    : []),
]);

const newProposal = ref({
  title: '',
  content: loggedInUserClaims.role >= 50 ? '(提案說明)\n\n綜上，是否有當？敬請公決。' : '',
  type: 'law',
  proposer: '' as string,
  reign: getCurrentReign(),
  basis: '',
  cosigners: [] as PersonRecord[],
  done: false,
  attachments: [] as string[],
  uploadedAt: new Date(),
});

const attachmentUploader = ref<InstanceType<typeof AttachmentUploader> | null>(null);

function formatPersonRecord(p: PersonRecord | string | undefined): string {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return `${p.classNum}`.trim();
}

const columns: QTableColumn[] = [
  { name: 'title', label: '提案標題', field: 'title', sortable: true, align: 'left' },
  {
    name: 'type',
    label: '類型',
    field: 'type',
    format: (val: string) => translateProposalType(val),
    sortable: true,
    align: 'left',
  },
  {
    name: 'proposer',
    label: '提案人',
    field: 'proposer',
    format: (val: PersonRecord | string) => formatPersonRecord(val),
    sortable: false,
    align: 'left',
  },
  {
    name: 'cosigners',
    label: '連署人',
    field: 'cosigners',
    format: (val: PersonRecord[]) => val?.map(formatPersonRecord).join('、') ?? '—',
    sortable: false,
    align: 'left',
  },
  {
    name: 'uploadedAt',
    label: '創建時間',
    field: 'uploadedAt',
    format: (val: Date) => new Date(val).toLocaleDateString('zh-TW'),
    sortable: true,
    align: 'left',
  },
  {
    name: 'done',
    label: '狀態',
    field: 'done',
    format: (val: boolean) => (val ? '審議完成' : '未審議'),
    sortable: true,
    align: 'left',
  },
  { name: 'actions', label: '操作', field: '', align: 'center' },
];

watch(loggedInUser, (user) => {
  if (user) loadProposals(user.uid);
  else proposals.value = [];
});

function loadProposals(uid: string) {
  proposals.value = [];
  const collections = [
    { ref: collectlaw(uid), type: 'law' },
    { ref: collectgeneral(uid), type: 'general' },
    { ref: collectpresentation(uid), type: 'presentation' },
  ];

  collections.forEach(({ ref, type }) => {
    onSnapshot(ref, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        type,
      }));
      proposals.value = [...proposals.value.filter((p) => p.type !== type), ...docs];
    });
  });
}

async function createProposal() {
  if (!loggedInUser.value) return notifyError('請先登入');
  if (!newProposal.value.title || !newProposal.value.content || !newProposal.value.proposer || !newProposal.value.basis)
    return notifyError('請填寫所有必填欄位');
  if (!newProposal.value.type) return notifyError('請選擇提案類型');
  if (newProposal.value.type === 'law' && !attachmentUploader.value?.check()) return;

  try {
    loading.value = true;
    Loading.show({ message: '正在建立提案...' });

    const proposalId = generateProposalId(new Date(), Math.floor(Math.random() * 10000));
    createdProposalId.value = proposalId;

    const proposalData: any = {
      title: newProposal.value.title,
      content: newProposal.value.content,
      proposer: newProposal.value.proposer,
      basis: newProposal.value.basis,
      cosigners: [],
      reign: newProposal.value.reign,
      done: false,
      attachments: newProposal.value.attachments,
      uploadedAt: new Date(),
    };

    let collectionRef;
    if (newProposal.value.type === 'law') collectionRef = collectlaw(loggedInUser.value.uid);
    else if (newProposal.value.type === 'general') collectionRef = collectgeneral(loggedInUser.value.uid);
    else collectionRef = collectpresentation(loggedInUser.value.uid);

    await setDoc(doc(collectionRef, proposalId), proposalData);

    // Generate cosign link
    cosignLink.value = `${window.location.origin}/proposal/${loggedInUser.value.uid}/${proposalId}/cosign`;

    // Start listening to the proposal for real-time co-signer updates
    const unsubscribe = onSnapshot(doc(collectionRef, proposalId), (docSnap) => {
      if (docSnap.exists()) {
        currentProposal.value = { id: docSnap.id, ...docSnap.data() };
      }
    });

    notifySuccess('提案建立成功');
    step.value = loggedInUserClaims.role === 25 ? 3 : 2;
  } catch (e) {
    console.error('建立提案失敗:', e);
    Notify.create({
      type: 'negative',
      message: `建立提案失敗: ${e instanceof Error ? e.message : String(e)}`,
    });
  } finally {
    Loading.hide();
    loading.value = false;
  }
}

async function nextStep() {
  if (step.value === 1) {
    await createProposal();
  } else if (step.value === 2 || (step.value === 1 && loggedInUserClaims.role === 25)) {
    step.value = 3;
  }
}

function prevStep() {
  if (step.value === 3 && loggedInUserClaims.role === 25) {
    step.value = 1;
  } else {
    step.value--;
  }
}

async function copyCosignLink() {
  try {
    await navigator.clipboard.writeText(cosignLink.value);
    notifySuccess('連署連結已複製');
  } catch (e) {
    notifyError('複製失敗', e);
  }
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

function refreshCurrentProposal() {
  // The currentProposal is already being updated in real-time via the listener
  // This function can be used to manually refresh if needed
  if (currentProposal.value) {
    notifySuccess('提案資訊已更新');
  }
}

function submitProposal() {
  if (!loggedInUser.value || !createdProposalId.value) return;

  try {
    loading.value = true;
    Loading.show({ message: '正在上傳至系統...' });

    // Proposal is now available for management - no need to mark as done
    notifySuccess('提案已上傳至系統');
    showAddDialog.value = false;
    resetDialog();
    loadProposals(loggedInUser.value.uid);
  } catch (e) {
    notifyError('上傳失敗', e);
  } finally {
    Loading.hide();
    loading.value = false;
  }
}

function laterUpload() {
  notifySuccess('提案已儲存，您可以稍後在「我的提案」中上傳至系統');
  showAddDialog.value = false;
  resetDialog();
  if (loggedInUser.value) {
    loadProposals(loggedInUser.value.uid);
  }
}

function resetDialog() {
  step.value = 1;
  cosignLink.value = '';
  createdProposalId.value = '';
  currentProposal.value = null;
  newProposal.value = {
    title: '',
    content: '',
    type: 'law',
    proposer: '',
    reign: getCurrentReign(),
    basis: '',
    cosigners: [],
    done: false,
    attachments: [],
    uploadedAt: new Date(),
  };
}

function cancelDialog() {
  showAddDialog.value = false;
  resetDialog();
}

async function deleteProposal(proposal: ProposalId) {
  if (!loggedInUser.value) return;
  try {
    loading.value = true;
    let collectionRef;
    if (proposal.type === 'law') collectionRef = collectlaw(loggedInUser.value.uid);
    else if (proposal.type === 'general') collectionRef = collectgeneral(loggedInUser.value.uid);
    else collectionRef = collectpresentation(loggedInUser.value.uid);

    await deleteDoc(doc(collectionRef, proposal.id));
    notifySuccess('刪除提案成功');
  } catch (e) {
    notifyError('刪除提案失敗', e);
  } finally {
    loading.value = false;
  }
}

function addAttachments(files: string[]) {
  for (const file of files) {
    newProposal.value.attachments.push(file);
  }
}

async function uploadProposalToSystem(proposal: any) {
  if (!loggedInUser.value) return;

  try {
    loading.value = true;
    Loading.show({ message: '正在上傳至系統...' });

    let collectionRef;
    if (proposal.type === 'law') collectionRef = collectlaw(loggedInUser.value.uid);
    else if (proposal.type === 'general') collectionRef = collectgeneral(loggedInUser.value.uid);
    else collectionRef = collectpresentation(loggedInUser.value.uid);

    // Mark as submitted by adding a submittedAt timestamp
    await updateDoc(doc(collectionRef, proposal.id), {
      submittedAt: new Date(),
      done: false, // Keep as not done since it hasn't been reviewed yet
    });

    notifySuccess(`提案「${proposal.title}」已上傳至系統`);
    loadProposals(loggedInUser.value.uid);
  } catch (e) {
    notifyError('上傳失敗', e);
  } finally {
    Loading.hide();
    loading.value = false;
  }
}

async function copyCoSignLink(proposal: any) {
  if (!loggedInUser.value) return;
  const cosignLink = `${window.location.origin}/proposal/${loggedInUser.value.uid}/${proposal.id}/cosign`;
  try {
    await navigator.clipboard.writeText(cosignLink);
    notifySuccess('連署連結已複製');
  } catch (e) {
    notifyError('複製失敗', e);
  }
}

const router = useRouter();

onMounted(() => {
  if (!loggedInUserClaims || loggedInUserClaims.role < 25) {
    Notify.create({ type: 'negative', message: '您無權存取提案頁面。' });
    void router.push('/');
    return;
  }

  if (loggedInUser.value) {
    loadProposals(loggedInUser.value.uid);
  }
});
</script>

<style scoped></style>
