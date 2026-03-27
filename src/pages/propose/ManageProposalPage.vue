<template>
  <q-page>
    <div class="q-ma-md">
      <q-table :columns="columns" :filter="search" :rows="filteredProposals" :title="`${getCurrentReign()} 提案管理`" row-key="id" :loading="loading">
        <template v-slot:top-left>
          <div class="text-h6 q-mr-md">{{ getCurrentReign() }} 提案管理</div>
          <q-btn-toggle v-model="activeFilter" :options="filterOptions" />
        </template>
        <template v-slot:top-right>
          <q-input v-model="search" debounce="300" dense placeholder="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn class="text-grey-9 q-ml-sm q-mr-sm" round icon="visibility" @click="viewProposalDetails(props.row)">
              <q-tooltip>檢視詳細內容</q-tooltip>
            </q-btn>
            <q-btn :disable="!props.row.submittedAt" class="text-purple-9 q-ml-sm q-mr-sm" round icon="post_add" @click="openAddToMeeting(props.row)">
              <q-tooltip>加入會議</q-tooltip>
            </q-btn>
            <q-btn class="text-blue-9 q-ml-sm q-mr-sm" round icon="link" @click="copyProposalLink(props.row)">
              <q-tooltip>複製提案附件</q-tooltip>
            </q-btn>
            <q-btn class="text-blue-9 q-ml-sm q-mr-sm" round icon="content_copy" @click="copyProposalcontent(props.row)">
              <q-tooltip>複製提案說明</q-tooltip>
            </q-btn>
            <q-btn
              :disable="!props.row.submittedAt"
              class="q-ml-sm q-mr-sm"
              round
              :text-color="props.row.done ? 'warning' : 'positive'"
              :icon="props.row.done ? 'refresh' : 'check'"
              @click="toggleDone(props.row)"
            >
              <q-tooltip>{{ props.row.done ? '標記為未審議' : '標記為審議完成' }}</q-tooltip>
            </q-btn>
            <q-btn
              :disable="!props.row.submittedAt"
              class="q-ml-sm q-mr-sm"
              round
              icon="delete"
              text-color="negative"
              @click="confirmDelete(props.row)"
            >
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

    <q-dialog v-model="showDetailsDialog" persistent maximized>
      <q-card v-if="proposalToView">
        <q-card-section>
          <div class="text-h6">{{ proposalToView.title }}(預覽)</div>
          <div class="text-subtitle2">類型： {{ translateProposalType(proposalToView.type) }}</div>
          <div class="text-subtitle2">提案人： {{ proposalToView.proposer }}</div>
          <div v-if="proposalToView.basis" class="text-subtitle2">法源依據： {{ proposalToView.basis }}</div>
        </q-card-section>
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">提案說明：</div>
          <div class="text-body1">{{ proposalToView.content }}</div>
        </q-card-section>
        <q-card-section v-if="proposalToView.attachments && proposalToView.attachments.length > 0">
          <div class="text-subtitle2 q-mb-sm">附件：</div>
          <q-list>
            <q-item v-for="attachment in proposalToView.attachments" :key="attachment">
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
          <q-chip v-for="cosigner in proposalToView.cosigners || []" :key="cosigner.name" color="primary" text-color="white" icon="person">
            {{ cosigner.classNum }}
          </q-chip>
          <div v-if="!proposalToView.cosigners || proposalToView.cosigners.length === 0" class="text-grey-6">無連署人</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="關閉" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

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
  </q-page>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import type { QTableColumn } from 'quasar';
import { getDocs, doc, updateDoc, deleteDoc, collection, setDoc, getCountFromServer } from 'firebase/firestore';
import { useFirestore } from 'vuefire';
import type { ProposalId } from 'src/ts/proposalmodels.ts';
import { proposalConverter, translateProposalType } from 'src/ts/proposalmodels.ts';
import { getCurrentReign, notifyError, notifySuccess, generateRandomText } from 'src/ts/utils.ts';
import { getAllUsers } from 'src/ts/auth.ts';
import { Loading } from 'quasar';
import { meetingCollectionOfCurrentReign, rawProposalCollection } from 'src/ts/models.ts';
import type { MeetingId } from 'src/ts/models.ts';
import type { PersonRecord } from 'src/ts/proposalmodels.ts';

type FilterValue = 'all' | 'pending' | 'done';

const activeFilter = ref<FilterValue>('all');
const filterOptions = [
  { label: '未審議', value: 'pending', color: 'warning' },
  { label: '已審議', value: 'done', color: 'positive' },
  { label: '全部', value: 'all', color: 'accent' },
];

// ── State ─────────────────────────────────────────────────────────────────────
const search = ref('');
const loading = ref(false);
const proposals = ref<(ProposalId & { userId: string })[]>([]);

const filteredProposals = computed(() => {
  switch (activeFilter.value) {
    case 'pending':
      return proposals.value.filter((p) => p.submittedAt && !p.done);
    case 'done':
      return proposals.value.filter((p) => p.submittedAt && p.done);
    default:
      return proposals.value; // 'all' — includes unsubmitted
  }
});

const showDeleteDialog = ref(false);
const proposalToDelete = ref<(ProposalId & { userId: string }) | null>(null);
const db = useFirestore();

const showAddToMeetingDialog = ref(false);
const proposalToAdd = ref<(ProposalId & { userId: string }) | null>(null);
const selectedMeeting = ref<MeetingId | null>(null);
const meetingOptions = meetingCollectionOfCurrentReign();
const meetingsLoading = ref(false);

const showDetailsDialog = ref(false);
const proposalToView = ref<(ProposalId & { userId: string }) | null>(null);
const activeUrl = ref('');

const PROPOSAL_TYPES = ['law', 'general', 'presentation'] as const;
type ProposalType = (typeof PROPOSAL_TYPES)[number];

function formatPersonRecord(p: PersonRecord | string | undefined): string {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return `${p.classNum} ${p.jobTitle} ${p.name}`.trim();
}

// ── Table columns ─────────────────────────────────────────────────────────────
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
    name: 'cosigners',
    label: '連署人',
    field: 'cosigners',
    format: (val: PersonRecord[]) => val?.map(formatPersonRecord).join('、') ?? '—',
    sortable: false,
    align: 'left',
  },
  {
    name: 'submittedAt',
    label: '提交時間',
    field: 'submittedAt',
    format: (val: Date) => (val ? new Date(val).toLocaleString('zh-TW') : '—'),
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
  {
    name: 'id',
    label: 'ID',
    field: 'id',
    format: (documentId) => documentId.slice(0, 200),
    sortable: false,
    align: 'left',
  },
];

// ── Data loading ──────────────────────────────────────────────────────────────
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

          return snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            type,
            userId: user.uid,
          })) as (ProposalId & { userId: string })[];
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

// ── Actions ───────────────────────────────────────────────────────────────────
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
    const proposal = proposalToDelete.value;
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
      content:
        '提案說明：\n' +
        proposalToAdd.value.content +
        (proposalToAdd.value.cosigners && proposalToAdd.value.cosigners.length > 0
          ? '\n\n連署人：\n' + proposalToAdd.value.cosigners.map((c) => c.classNum + ' ' + c.jobTitle + ' ' + c.name).join('\n')
          : ''),
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

function viewProposalDetails(proposal: ProposalId & { userId: string }) {
  proposalToView.value = proposal;
  showDetailsDialog.value = true;
}

function getGoogleFileEmbed(input: string) {
  let file_id = null;
  const driveCapture = input.match(/https:\/\/drive\.google\.com\/file\/d\/(.*)\/view.*/);
  if (driveCapture && driveCapture.length > 1) file_id = driveCapture[1];
  const documentCapture = input.match(/https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/(.*)\/edit.*/);
  if (documentCapture && documentCapture.length > 2) file_id = documentCapture[2];
  if (file_id) return `https://drive.google.com/file/d/${file_id}/preview`;
  return input;
}

onMounted(() => {
  void loadProposals();
});
</script>

<style scoped></style>
