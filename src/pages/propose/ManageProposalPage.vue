<template>
  <q-page>
    <div class="q-ma-md">
      <q-table :columns="columns" :filter="filter" :rows="proposals" :title="`${getCurrentReign()} 所有提案`" row-key="id" :loading="loading">
        <template v-slot:top-right>
          <q-input v-model="filter" debounce="300" dense placeholder="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn class="text-purple-9 q-ml-sm q-mr-sm" round icon="post_add" @click="openAddToMeeting(props.row)">
              <q-tooltip>加入會議</q-tooltip>
            </q-btn>
            <q-btn class="text-blue-9 q-ml-sm q-mr-sm" round icon="link" @click="copyProposalLink(props.row)">
              <q-tooltip>複製提案附件</q-tooltip>
            </q-btn>
            <q-btn class="text-blue-9 q-ml-sm q-mr-sm" round icon="content_copy" @click="copyProposalcontent(props.row)">
              <q-tooltip>複製提案說明</q-tooltip>
            </q-btn>
            <q-btn
              class="q-ml-sm q-mr-sm"
              round
              :text-color="props.row.done ? 'warning' : 'positive'"
              :icon="props.row.done ? 'refresh' : 'check'"
              @click="toggleDone(props.row)"
            >
              <q-tooltip>{{ props.row.done ? '標記為未審議' : '標記為審議完成' }}</q-tooltip>
            </q-btn>
            <q-btn class="q-ml-sm q-mr-sm" round icon="delete" text-color="negative" @click="confirmDelete(props.row)">
              <q-tooltip>刪除</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="showAddToMeetingDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">加入會議</div>
          <div class="text-caption text-grey">提案：{{ proposalToAdd?.title }}</div>
        </q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-select
            v-model="selectedMeeting"
            :options="meetingOptions"
            :option-label="(m) => m.name"
            :loading="meetingsLoading"
            label="選擇會議"
            clearable
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn flat label="加入" color="primary" :disable="!selectedMeeting" @click="submitAddToMeeting" />
        </q-card-actions>
      </q-card>
    </q-dialog>

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
import { getDocs, doc, updateDoc, deleteDoc, collection, setDoc, getCountFromServer } from 'firebase/firestore';
import { useFirestore } from 'vuefire';
import type { ProposalId, PersonRecord } from 'src/ts/proposalmodels.ts';
import { proposalConverter, translateProposalType } from 'src/ts/proposalmodels.ts';
import { getCurrentReign, notifyError, notifySuccess, generateRandomText } from 'src/ts/utils.ts';
import { getAllUsers } from 'src/ts/auth.ts';
import { Loading } from 'quasar';
import { meetingCollectionOfCurrentReign, rawProposalCollection } from 'src/ts/models.ts';
import type { MeetingId } from 'src/ts/models.ts';

const filter = ref('');
const loading = ref(false);
const proposals = ref<ProposalId[]>([]);
const showDeleteDialog = ref(false);
const proposalToDelete = ref<ProposalId | null>(null);
const db = useFirestore();

const showAddToMeetingDialog = ref(false);
const proposalToAdd = ref<(ProposalId & { userId: string }) | null>(null);
const selectedMeeting = ref<MeetingId | null>(null);
const meetingOptions = meetingCollectionOfCurrentReign();
const meetingsLoading = ref(false);

const PROPOSAL_TYPES = ['law', 'general', 'presentation'] as const;
type ProposalType = (typeof PROPOSAL_TYPES)[number];

function formatPersonRecord(val: PersonRecord | string | undefined): string {
  if (!val) return '—';
  if (typeof val === 'string') return val;
  return `${val.classNum} ${val.jobTitle} ${val.name}`.trim();
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
    format: (val: boolean) => (val ? '審議完成' : '未審議'),
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
  if (!attachmentUrls) {
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

async function copyProposalcontent(proposal: ProposalId & { userId: string }) {
  if (!proposal.content) {
    notifyError('此提案無說明內容');
    return;
  }
  try {
    await navigator.clipboard.writeText(proposal.content);
    notifySuccess('已複製提案說明內容');
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

function openAddToMeeting(proposal: ProposalId & { userId: string }) {
  proposalToAdd.value = proposal;
  selectedMeeting.value = null;
  showAddToMeetingDialog.value = true;
}

async function submitAddToMeeting() {
  if (!proposalToAdd.value || !selectedMeeting.value) return;

  Loading.show();
  try {
    const toProps = rawProposalCollection(selectedMeeting.value.id);
    const order = (await getCountFromServer(toProps)).data().count;
    const newId = generateRandomText(6, null);

    await setDoc(doc(toProps, newId), {
      title: proposalToAdd.value.title,
      proposer: proposalToAdd.value.proposer,
      cosigners: proposalToAdd.value.cosigners ?? [],
      content: proposalToAdd.value.content ?? '',
      attachments: proposalToAdd.value.attachments ?? [],
      order,
      activeVotable: null,
      speakRequests: [],
    });

    notifySuccess(`已將提案「${proposalToAdd.value.title}」加入「${selectedMeeting.value.name}」`);
    showAddToMeetingDialog.value = false;
  } catch (e) {
    notifyError('加入會議失敗', e);
  } finally {
    Loading.hide();
  }
}

onMounted(() => {
  void loadProposals();
});
</script>

<style scoped></style>
