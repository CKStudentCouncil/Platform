<template>
  <q-page>
    <q-tabs>
      <q-route-tab label="所有提案" to="/proposal/manage" />
    </q-tabs>
    <div class="q-ma-md">
      <q-table :columns="columns" :filter="filter" :rows="proposals" :title="`${currentReign} 所有提案`" row-key="id" :loading="loading">
        <template v-slot:top-right>
          <q-input v-model="filter" debounce="300" dense placeholder="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat dense color="primary" icon="link" @click="copyProposalLink(props.row)">
              <q-tooltip>複製提案附件</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              :color="props.row.done ? 'warning' : 'positive'"
              :icon="props.row.done ? 'refresh' : 'check'"
              @click="toggleDone(props.row)"
            >
              <q-tooltip>{{ props.row.done ? '標記為進行中' : '標記為已完成' }}</q-tooltip>
            </q-btn>
            <q-btn flat dense icon="delete" color="negative" @click="confirmDelete(props.row)">
              <q-tooltip>刪除</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="showDeleteDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">確認刪除</div>
        </q-card-section>
        <q-card-section> 確定要刪除提案「{{ proposalToDelete?.title }}」嗎？ </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn flat label="刪除" color="negative" @click="deleteProposal" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import type { QTableColumn } from 'quasar';
import { getDocs, doc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { useFirestore } from 'vuefire';
import type { ProposalId } from 'src/ts/proposalmodels.ts';
import { proposalConverter, translateProposalType } from 'src/ts/proposalmodels.ts';
import { currentReign, notifyError, notifySuccess } from 'src/ts/utils.ts';
import { getAllUsers } from 'src/ts/auth.ts';

const filter = ref('');
const loading = ref(false);
const proposals = ref<ProposalId[]>([]);
const showDeleteDialog = ref(false);
const proposalToDelete = ref<ProposalId | null>(null);
const db = useFirestore();

const PROPOSAL_TYPES = ['law', 'general', 'presentation'] as const;
type ProposalType = (typeof PROPOSAL_TYPES)[number];

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
    format: (val: Date) => new Date(val).toLocaleString('zh-TW'),
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

function getCollectionRef(type: ProposalType, userId: string) {
  return collection(db, `proposal/${type}/${userId}/`).withConverter(proposalConverter);
}

async function loadProposals() {
  loading.value = true;
  proposals.value = [];

  try {
    const users = await getAllUsers();

    const loadPromises = users.flatMap((user) =>
      PROPOSAL_TYPES.map(async (type) => {
        try {
          const collectionRef = getCollectionRef(type, user.uid);
          const snapshot = await getDocs(collectionRef);

          return snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              type,
              userId: user.uid,
            } as ProposalId & { userId: string };
          });
        } catch (e) {
          console.warn(`無法載入 ${user.uid} 的 ${type} 提案:`, e);
          return [];
        }
      }),
    );

    const results = await Promise.all(loadPromises);
    proposals.value = results.flat().sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (e) {
    notifyError('載入提案失敗', e);
  } finally {
    loading.value = false;
  }
}

async function copyProposalLink(proposal: ProposalId & { userId: string }) {
  const attachmentUrls = proposal.attachments?.filter((url) => url).join('\n') || '';

  if (!attachmentUrls || attachmentUrls === '') {
    notifyError('此提案無附件');
    return;
  }

  try {
    await navigator.clipboard.writeText(attachmentUrls);
    notifySuccess('已複製提案附件連結');
  } catch (e) {
    notifyError('複製失敗', e);
  }
}

async function toggleDone(proposal: ProposalId & { userId: string }) {
  try {
    const collectionRef = getCollectionRef(proposal.type as ProposalType, proposal.userId);
    await updateDoc(doc(collectionRef, proposal.id), { done: !proposal.done });

    proposal.done = !proposal.done;
    notifySuccess(proposal.done ? '標記為已完成' : '標記為進行中');
  } catch (e) {
    notifyError('更新狀態失敗', e);
  }
}

function confirmDelete(proposal: ProposalId & { userId: string }) {
  proposalToDelete.value = proposal;
  showDeleteDialog.value = true;
}

async function deleteProposal() {
  if (!proposalToDelete.value) return;

  try {
    const proposal = proposalToDelete.value as ProposalId & { userId: string };
    const collectionRef = getCollectionRef(proposal.type as ProposalType, proposal.userId);
    await deleteDoc(doc(collectionRef, proposal.id));

    notifySuccess('刪除提案成功');
    showDeleteDialog.value = false;
    await loadProposals();
  } catch (e) {
    notifyError('刪除提案失敗', e);
  }
}

onMounted(() => {
  void loadProposals();
});
</script>

<style scoped></style>
