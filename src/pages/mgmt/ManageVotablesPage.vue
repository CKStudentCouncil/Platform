<template>
  <q-tabs v-if="!embed" align="left">
    <q-route-tab :to="'/meetings/' + meetingId" label="會議" />
    <q-route-tab :to="`/meetings/${meetingId.length == 0 ? '' : meetingId + '/'}proposals/${proposalId}`" label="提案" />
    <q-route-tab
      :to="`/meetings/${meetingId.length == 0 ? '' : meetingId + '/'}proposals/${proposalId.length == 0 ? '' : proposalId + '/'}votables`"
      label="投票案件"
    />
  </q-tabs>
  <span v-if="meetingId.length == 0 && !embed">請先選擇一個會議</span>
  <span v-if="proposalId.length == 0 && !embed">請先選擇一個提案</span>
  <q-page v-else padding>
    <q-btn class="q-mr-md" color="primary" icon="add" label="新增投票案件" style="margin-bottom: 10px" @click="add" />
    <q-btn color="primary" icon="ios_share" label="匯出投票結果" style="margin-bottom: 10px" @click="showResults" />
    <span class="q-ml-md">提示：可以直接拖拉投票案件方塊以重新排序</span>
    <VueDraggable v-model="votables" class="q-gutter-md" style="cursor: move" @update="rearrange()">
      <q-card v-for="votable of votables" :key="(votable as any).id">
        <q-card-section>
          <div class="text-h6">{{ votable!.question }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div>門檻：{{ votable!.type.translation }}</div>
          <div>選項：{{ votable!.choices.join('、') }}</div>
        </q-card-section>
        <q-separator />
        <q-card-actions>
          <q-btn color="primary" flat label="編輯" @click="edit(votable)" />
          <q-btn color="negative" flat label="刪除" @click="del((votable as any).id)" />
        </q-card-actions>
      </q-card>
    </VueDraggable>
  </q-page>
  <q-dialog v-model="dialog" persistent>
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新增' }}投票案件</h6>
      </q-card-section>
      <q-card-section>
        <q-input v-model="target.question" label="問題" />
        <q-select v-model="target.type" :option-label="(o) => o.translation" :options="Object.values(VotableType.VALUES)" label="門檻" />
        <q-btn color="primary" @click="target.choices.push('是', '否')">加入是/否</q-btn>
        <ListEditor v-model="target.choices" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="action = ''" />
        <q-btn color="positive" flat label="確定" @click="submit()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { VueDraggable } from 'vue-draggable-plus';
import { rawVotableCollection, Votable, votableCollection, VotableType } from 'src/ts/models.ts';
import { useRoute, useRouter } from 'vue-router';
import { computed, reactive, ref } from 'vue';
import { useFirestore } from 'vuefire';
import { Dialog, Loading } from 'quasar';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { generateRandomText, notifyError, notifySuccess } from 'src/ts/utils.ts';
import ListEditor from 'components/ListEditor.vue';
import { exportVotingData } from 'pages/mgmt/common.ts';

const props = defineProps({
  meetingId: {
    type: String,
    required: false,
    default: '',
  },
  proposalId: {
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

const meetingId = props.embed ? props.meetingId : (useRoute().params.id as string);
const proposalId = props.embed ? props.proposalId : (useRoute().params.proposalId as string);
const votables = !!meetingId || !!proposalId ? votableCollection(meetingId, proposalId) : ref([]);
const router = useRouter();
let action = ref('');
let target = reactive(
  {} as {
    id: string;
    choices: string[];
    question: string;
    order: number;
    type: VotableType;
    results: Record<string, string[]>;
  },
);
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

function edit(prop: any) {
  target.id = prop.id;
  target.question = prop.question;
  target.choices = prop.choices;
  target.order = prop.order;
  target.results = prop.results;
  target.type = prop.type;
  action.value = 'edit';
}

function add() {
  target.question = '';
  target.choices = [];
  target.order = votables.value.length;
  target.results = {};
  target.type = VotableType.Absolute;
  action.value = 'add';
}

async function del(id: string) {
  Dialog.create({
    title: '刪除投票案件',
    message: '確定要刪除此投票案件嗎？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    Loading.show();
    try {
      await deleteDoc(doc(rawVotableCollection(meetingId, proposalId), id));
    } catch (e) {
      console.error(e);
      notifyError('刪除失敗', e);
      return;
    }
    Loading.hide();
    notifySuccess('成功刪除投票案件');
  });
}

async function submit() {
  Loading.show();
  try {
    const data = {
      order: target.order,
      question: target.question,
      choices: target.choices,
      results: target.results,
      type: target.type.firebase,
    };
    if (action.value === 'edit') {
      await updateDoc(doc(db, `meetings/${meetingId}/proposals/${proposalId}/votables`, target.id), data);
    } else if (action.value === 'add') {
      await setDoc(doc(db, `meetings/${meetingId}/proposals/${proposalId}/votables`, generateRandomText(6, null)), data);
    }
  } catch (e) {
    console.error(e);
    notifyError('更新失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  action.value = '';
  notifySuccess('成功更新投票案件');
}

async function rearrange() {
  Loading.show();
  const tasks = [];
  try {
    for (let i = 0; i < votables.value.length; i++) {
      tasks.push(
        updateDoc(doc(db, `meetings/${meetingId}/proposals/${proposalId}/votables`, (votables.value[i] as any).id), {
          order: i,
        }),
      );
    }
    await Promise.all(tasks);
  } catch (e) {
    console.error(e);
    notifyError('重新排序失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('成功重新排序投票案件');
}

async function showResults() {
  Dialog.create({
    title: '投票結果',
    message: exportVotingData(votables.value as Votable[]),
    html: true,
    persistent: true,
  });
}
</script>

<style scoped></style>
