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
            <q-btn class="text-red-9 q-ml-sm q-mr-sm" round icon="delete" @click="deleteProposal(props.row)" />
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="showAddDialog" persistent>
      <q-card style="max-width: 100%; min-width: 320px">
        <q-card-section>
          <h6 v-if="newProposal.type === 'law'" class="q-ma-none">新增法律修正案</h6>
          <h6 v-else-if="newProposal.type === 'general'" class="q-ma-none">新增一般提案</h6>
          <h6 v-else class="q-ma-none">新增專案報告案</h6>
        </q-card-section>

        <q-card-section class="q-pa-md">
          <q-input area-required v-model="newProposal.title" label="標題" stack-label />
          <q-input area-required v-model="newProposal.basis" label="法源依據" stack-label />

          <div class="q-mt-sm">
            <div class="text-caption text-grey-7 q-mb-xs">提案人</div>
            <div class="row q-gutter-sm items-center">
              <q-input v-model="newProposal.proposer.classNum" label="班級" dense class="col-2" />
              <q-input v-model="newProposal.proposer.jobTitle" label="職稱" dense class="col-3" />
              <q-input v-model="newProposal.proposer.name" label="姓名" dense class="col" />
            </div>
          </div>

          <div class="q-mt-sm">
            <div class="text-caption text-grey-7 q-mb-xs">連署人</div>
            <div v-if="newProposal.cosigners.length > 0" class="q-mb-sm q-gutter-xs">
              <q-chip
                v-for="(cosigner, i) in newProposal.cosigners"
                :key="i"
                removable
                @remove="newProposal.cosigners.splice(i, 1)"
                color="primary"
                text-color="white"
                icon="person"
              >
                {{ cosigner.classNum }} {{ cosigner.jobTitle }} {{ cosigner.name }}
              </q-chip>
            </div>
            <div class="row q-gutter-sm items-center">
              <q-input v-model="cosignerInput.classNum" label="班級" dense class="col-2" />
              <q-input v-model="cosignerInput.jobTitle" label="職稱" dense class="col-3" />
              <q-input v-model="cosignerInput.name" label="姓名" dense class="col" @keyup.enter="addCosigner" />
              <q-btn round dense icon="add" color="primary" @click="addCosigner" />
            </div>
          </div>

          <q-select area-required v-model="newProposal.type" :options="proposalTypes" label="類型" emit-value map-options class="q-mt-sm" />
          <q-input area-required v-model="newProposal.content" label="提案說明" type="textarea" stack-label />
          <br />
          <div v-if="newProposal.type === 'law'">
            <div>條文對照表：</div>
            <ListEditor v-model="newProposal.attachments" /><br />
            <AttachmentUploader area-required ref="attachmentUploader" @uploaded="addAttachments" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" color="negative" @click="showAddDialog = false" />
          <q-btn flat label="確定" color="positive" @click="addProposal" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';
import type { QTableColumn } from 'quasar';
import { Loading, Notify } from 'quasar';
import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { loggedInUser } from 'src/ts/auth.ts';
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

const filter = ref('');
const loading = ref(false);
const showAddDialog = ref(false);
const proposals = ref<any[]>([]);

const cosignerInput = ref<PersonRecord>({ classNum: '', jobTitle: '', name: '' });

const proposalTypes = [
  { label: '法律修正案', value: 'law' },
  { label: '一般提案', value: 'general' },
  { label: '專案報告', value: 'presentation' },
];

const newProposal = ref({
  title: '',
  content: '',
  type: 'law',
  proposer: { classNum: '', jobTitle: '', name: '' } as PersonRecord,
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
  return `${p.classNum} ${p.jobTitle} ${p.name}`.trim();
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
    label: '上傳時間',
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

function addCosigner() {
  const { classNum, jobTitle, name } = cosignerInput.value;
  if (!name.trim()) return notifyError('請填寫連署人姓名');
  const entry: PersonRecord = { classNum: classNum.trim(), jobTitle: jobTitle.trim(), name: name.trim() };
  if (newProposal.value.cosigners.some((c) => c.name === entry.name)) {
    return notifyError('該連署人已存在');
  }
  newProposal.value.cosigners.push(entry);
  cosignerInput.value = { classNum: '', jobTitle: '', name: '' };
}

async function addProposal() {
  if (!loggedInUser.value) return notifyError('請先登入');
  if (!newProposal.value.title || !newProposal.value.content) return notifyError('請填寫提案標題和內容');
  if (!newProposal.value.type) return notifyError('請選擇提案類型');
  if (!attachmentUploader.value?.check()) return;

  try {
    loading.value = true;
    Loading.show({ message: '正在上傳...' });

    const proposalId = generateProposalId(new Date(), Math.floor(Math.random() * 10000));

    const proposalData: any = {
      title: newProposal.value.title,
      content: newProposal.value.content,
      proposer: newProposal.value.proposer,
      cosigners: newProposal.value.cosigners,
      reign: newProposal.value.reign,
      done: false,
      attachments: newProposal.value.attachments,
      uploadedAt: new Date(),
    };

    if (newProposal.value.basis) {
      proposalData.basis = newProposal.value.basis;
    }

    let collectionRef;
    if (newProposal.value.type === 'law') collectionRef = collectlaw(loggedInUser.value.uid);
    else if (newProposal.value.type === 'general') collectionRef = collectgeneral(loggedInUser.value.uid);
    else collectionRef = collectpresentation(loggedInUser.value.uid);

    await setDoc(doc(collectionRef, proposalId), proposalData);

    notifySuccess('新增提案成功');
    showAddDialog.value = false;

    cosignerInput.value = { classNum: '', jobTitle: '', name: '' };
    newProposal.value = {
      title: '',
      content: '',
      type: 'law',
      proposer: { classNum: '', jobTitle: '', name: '' },
      reign: getCurrentReign(),
      basis: '',
      cosigners: [],
      done: false,
      attachments: [],
      uploadedAt: new Date(),
    };
  } catch (e) {
    console.error('新增提案失敗:', e);
    Notify.create({
      type: 'negative',
      message: `新增提案失敗: ${e instanceof Error ? e.message : String(e)}`,
    });
  } finally {
    Loading.hide();
    loading.value = false;
  }
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

onMounted(() => {
  if (loggedInUser.value) {
    loadProposals(loggedInUser.value.uid);
  }
});
</script>

<style scoped></style>
