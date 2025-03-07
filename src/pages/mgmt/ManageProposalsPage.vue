<template>
  <q-page>
    <q-tabs v-if="!embed" align="left">
      <q-route-tab :to="'/meetings/' + meetingId" label="會議" />
      <q-route-tab
        :to="`/meetings/${meetingId.length == 0 ? '' : meetingId + '/'}proposals/${proposalId}`"
        label="提案"
      />
      <q-route-tab
        :disable="!selected"
        :to="`/meetings/${meetingId.length == 0 ? '' : meetingId + '/'}proposals/${proposalId.length == 0 ? '' : proposalId + '/'}votables`"
        label="投票案件"
      />
    </q-tabs>
    <span v-if="meetingId.length == 0 && !embed">請先選擇一個會議</span>
    <div v-else class="q-ma-md">
      <q-btn color="primary" icon="add" label="新增提案" style="margin-bottom: 10px" @click="add" />
      <span class="q-ml-md">提示：可以直接拖拉提案方塊以重新排序</span>
      <VueDraggable v-model="proposals" class="q-gutter-md" style="cursor: move" @update="rearrange()">
        <ProposalDisplay
          v-for="prop of proposals"
          :key="prop.id"
          :class="selected == prop.id ? 'bg-green-1' : ''"
          :proposal="prop"
          editable
          :selectable="!embed"
          @del="del(prop.id)"
          @edit="edit(prop)"
          @select="
            selected = prop.id;
            $router.push(`/meetings/${meetingId}/proposals/${prop.id}/votables`);
          "
        />
      </VueDraggable>
    </div>
  </q-page>
  <q-dialog v-model="dialog" persistent>
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新增' }}提案</h6>
      </q-card-section>
      <q-card-section>
        <q-input v-model="target.title" label="標題" />
        <q-input v-model="target.proposer" label="提案人" />
        <q-input v-model="target.content" label="內容" type="textarea" />
        <div>附件：</div>
        <ListEditor v-model="target.attachments" />
        <AttachmentUploader :filename-prefix="`${meeting?.name}_`" @uploaded="addAttachments" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="action = ''" />
        <q-btn color="positive" flat label="確定" @click="submit()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { getMeeting, Proposal, proposalCollection, rawProposalCollection } from 'src/ts/models.ts';
import { useRoute, useRouter } from 'vue-router';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Dialog, Loading } from 'quasar';
import { useFirestore } from 'vuefire';
import { computed, reactive, ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { generateRandomText, notifyError, notifySuccess } from 'src/ts/utils.ts';
import ListEditor from 'components/ListEditor.vue';
import ProposalDisplay from 'components/ProposalDisplay.vue';
import AttachmentUploader from 'components/AttachmentUploader.vue';

const props = defineProps({
  meetingId: {
    type: String,
    required: false,
    default: '',
  },
  embed: {
    type: Boolean,
    required: false,
    default: false,
  },
});
interface ProposalId extends Proposal {
  id: string;
}

const meetingId = props.embed ? props.meetingId : useRoute().params.id as string;
const proposalId = useRoute().params.proposalId as string;
const meeting = getMeeting(meetingId);
const proposals = proposalCollection(meetingId);
const action = ref('');
const target = reactive({} as ProposalId);
const router = useRouter();
const attachmentUploader = ref<InstanceType<typeof AttachmentUploader> | null>(null);
let selected = computed({
  get: () => proposalId,
  set: (value) => {
    if (props.embed) {
      return;
    }
    if (value === selected.value) {
      router.push({ params: { proposalId: '' } });
    } else {
      router.push({ params: { proposalId: value } });
    }
  },
});
const dialog = computed(() => {
  return action.value === 'edit' || action.value === 'add';
});
const db = useFirestore();

function edit(proposal: any) {
  Object.assign(target, proposal);
  target.id = proposal.id;
  action.value = 'edit';
}

function add() {
  target.attachments = [];
  target.content = '';
  target.proposer = '';
  target.title = '';
  target.order = proposals.value.length - 1;
  target.activeVotable = null;
  target.speakRequests = [];
  target.id = '';
  action.value = 'add';
}

async function del(id: string) {
  Dialog.create({
    title: '刪除提案',
    message: '確定要刪除此提案嗎？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    Loading.show();
    try {
      await deleteDoc(doc(rawProposalCollection(meetingId), id));
    } catch (e) {
      notifyError('刪除失敗', e);
      return;
    }
    Loading.hide();
    notifySuccess('成功刪除提案');
  });
}

async function submit() {
  Loading.show();
  try {
    const data = {
      attachments: target.attachments,
      content: target.content,
      proposer: target.proposer,
      title: target.title,
    };
    if (action.value === 'edit') {
      await updateDoc(doc(db, `meetings/${meetingId}/proposals`, target.id), data);
    } else if (action.value === 'add') {
      await setDoc(doc(db, `meetings/${meetingId}/proposals`, generateRandomText(6, null)), {
        ...data,
        order: target.order,
        activeVotable: target.activeVotable,
        speakRequests: target.speakRequests,
      });
    }
  } catch (e) {
    notifyError('更新失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  action.value = '';
  notifySuccess('更新成功');
}

async function rearrange() {
  Loading.show();
  const tasks = [];
  try {
    for (let i = 0; i < proposals.value.length; i++) {
      tasks.push(
        updateDoc(doc(db, `meetings/${meetingId}/proposals`, proposals.value[i].id), {
          order: i,
        }),
      );
    }
    await Promise.all(tasks);
  } catch (e) {
    notifyError('重新排序失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('成功重新排序');
}

function addAttachments(a: string[]) {
  if (!attachmentUploader.value?.check()) {
    return;
  }
  for (const attachment of a) {
    target.attachments.push(attachment);
  }
}
</script>

<style scoped></style>
