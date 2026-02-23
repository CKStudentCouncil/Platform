<template>
  <q-page>
    <q-tabs>
      <q-route-tab label="我的提案" to="/proposal" />
    </q-tabs>
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
            <q-btn flat dense icon="delete" @click="deleteProposal(props.row)" />
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog 
        v-model="showAddDialog"
        persistent
      >
      <q-card style="max-width: 100%;">
        <q-card-section>
          <h6 class="q-ma-none">新增提案</h6>
        </q-card-section>

        <q-card-section>
          <q-input area-required v-model="newProposal.title" label="標題" />
          <q-input area-required v-model="newProposal.proposer" label="提案人" />
          <q-select area-required v-model="newProposal.type" :options="proposalTypes" label="類型" emit-value map-options />
          <q-input area-required v-model="newProposal.content" label="內容" type="textarea" />
          <br />
          <div>附件：</div>
          <ListEditor v-model="newProposal.attachments" /><br />
          <AttachmentUploader area-required ref="attachmentUploader" @uploaded="addAttachments" />
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
import type { ProposalId } from 'src/ts/proposalmodels.ts';
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

const proposalTypes = [
  { label: '法律修正案', value: 'law' },
  { label: '一般提案', value: 'general' },
  { label: '專案報告', value: 'presentation' },
];

const newProposal = ref({
  title: '',
  content: '',
  type: 'law',
  proposer: '',
  reign: getCurrentReign(),
  basis: '',
  done: false,
  attachments: [] as string[],
  uploadedAt: new Date(),
});

const attachmentUploader = ref<InstanceType<typeof AttachmentUploader> | null>(null);

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
  { name: 'proposer', label: '提案人', field: 'proposer', sortable: true, align: 'left' },
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
    format: (val: boolean) => (val ? '已完成' : '進行中'),
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
      reign: newProposal.value.reign,
      done: false,
      attachments: newProposal.value.attachments,
      uploadedAt: new Date(),
    };

    if (newProposal.value.basis) {
      proposalData.basis = newProposal.value.basis;
    }

    console.log('準備儲存的類型:', newProposal.value.type);
    console.log('提案資料:', proposalData);

    let collectionRef;
    if (newProposal.value.type === 'law') collectionRef = collectlaw(loggedInUser.value.uid);
    else if (newProposal.value.type === 'general') collectionRef = collectgeneral(loggedInUser.value.uid);
    else collectionRef = collectpresentation(loggedInUser.value.uid);

    console.log('Collection 路徑:', collectionRef.path);

    await setDoc(doc(collectionRef, proposalId), proposalData);

    notifySuccess('新增提案成功');
    showAddDialog.value = false;

    newProposal.value = {
      title: '',
      content: '',
      type: 'law',
      proposer: '',
      reign: getCurrentReign(),
      basis: '',
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
