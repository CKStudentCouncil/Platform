<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab :to="'/meetings/' + $route.params.id" label="會議" />
      <q-route-tab
        :to="`/meetings/${$route.params.id.length == 0 ? '' : $route.params.id + '/'}proposals/${$route.params.proposalId}`"
        label="提案"
      />
      <q-route-tab
        :to="`/meetings/${$route.params.id.length == 0 ? '' : $route.params.id + '/'}proposals/${$route.params.proposalId.length == 0 ? '' : $route.params.proposalId + '/'}votables`"
        label="投票案件"
        :disable="!selected"
      />
    </q-tabs>
    <span v-if="$route.params.id.length == 0">請先選擇一個會議</span>
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
          @del="del(prop.id)"
          @edit="edit(prop)"
          @select="
            selected = prop.id;
            $router.push(`/meetings/${$route.params.id}/proposals/${prop.id}/votables`);
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
import { Dialog, Loading, Notify } from 'quasar';
import { useFirestore } from 'vuefire';
import { computed, reactive, ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { generateRandomText } from 'src/ts/utils.ts';
import ListEditor from 'components/ListEditor.vue';
import ProposalDisplay from 'components/ProposalDisplay.vue';
import AttachmentUploader from 'components/AttachmentUploader.vue';

let meeting = getMeeting(useRoute().params.id as string);
let proposals = proposalCollection(useRoute().params.id as string);
let action = ref('');

interface ProposalId extends Proposal {
  id: string;
}

let target = reactive({} as ProposalId);
const router = useRouter();
let selected = computed({
  get: () => route.params.proposalId,
  set: (value) => {
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
const route = useRoute();

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
      await deleteDoc(doc(rawProposalCollection(route.params.id as string), id));
    } catch (e) {
      console.error(e);
      Notify.create({
        message: '刪除失敗',
        color: 'negative',
      });
      return;
    }
    Loading.hide();
    Notify.create({
      message: '已刪除提案',
      color: 'positive',
    });
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
      await updateDoc(doc(db, `meetings/${route.params.id}/proposals`, target.id), data);
    } else if (action.value === 'add') {
      await setDoc(doc(db, `meetings/${route.params.id}/proposals`, generateRandomText(6, null)), {
        ...data,
        order: target.order,
        activeVotable: target.activeVotable,
        speakRequests: target.speakRequests,
      });
    }
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '更新失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  action.value = '';
  Notify.create({
    message: '提案已更新',
    color: 'positive',
  });
}

async function rearrange() {
  Loading.show();
  const tasks = [];
  try {
    for (let i = 0; i < proposals.value.length; i++) {
      tasks.push(
        updateDoc(doc(db, `meetings/${route.params.id}/proposals`, proposals.value[i].id), {
          order: i,
        }),
      );
    }
    await Promise.all(tasks);
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '重新排序失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '提案已重新排序',
    color: 'positive',
  });
}

function addAttachments(a: string[]) {
  for (const attachment of a) {
    target.attachments.push(attachment);
  }
}
</script>

<style scoped></style>
