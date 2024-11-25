<template>
  <q-tabs v-if="!embed" align="left">
    <q-route-tab :to="'/meetings/' + $route.params.id" label="會議" />
    <q-route-tab :to="`/meetings/${$route.params.id.length == 0 ? '' : $route.params.id + '/'}proposals/${$route.params.proposalId}`" label="提案" />
    <q-route-tab
      :to="`/meetings/${$route.params.id.length == 0 ? '' : $route.params.id + '/'}proposals/${$route.params.proposalId.length == 0 ? '' : $route.params.proposalId + '/'}votables`"
      label="投票案件"
    />
  </q-tabs>
  <span v-if="$route.params.id.length == 0 && !embed">請先選擇一個會議</span>
  <span v-if="$route.params.proposalId.length == 0 && !embed">請先選擇一個提案</span>
  <q-page v-else padding>
    <q-btn class="q-mr-md" color="primary" icon="add" label="新增投票案件" style="margin-bottom: 10px" @click="add" />
    <q-btn color="primary" icon="ios_share" label="匯出投票結果" style="margin-bottom: 10px" @click="showResults" />
    <span class="q-ml-md">提示：可以直接拖拉投票案件方塊以重新排序</span>
    <VueDraggable v-model="votables" class="q-gutter-md" style="cursor: move" @update="rearrange()">
      <q-card v-for="votable of sortedVotables" :key="votable.order">
        <q-card-section>
          <div class="text-h6">{{ votable.question }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div>選項：{{ votable.choices.join('、') }}</div>
        </q-card-section>
        <q-separator />
        <q-card-actions>
          <q-btn color="primary" flat label="編輯" @click="edit(votable)" />
          <q-btn color="negative" flat label="刪除" @click="del(votable.id)" />
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
        <q-btn @click="target.choices.push('是', '否')" color="primary">加入是/否</q-btn>
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
import { rawVotableCollection, votableCollection } from 'src/ts/models.ts';
import { useRoute, useRouter } from 'vue-router';
import { computed, reactive, ref } from 'vue';
import { useFirestore } from 'vuefire';
import { Dialog, Loading, Notify } from 'quasar';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { generateRandomText } from 'src/ts/utils.ts';
import ListEditor from 'components/ListEditor.vue';

const router = useRouter();
const props = defineProps({
  meeting: {
    type: String,
    required: false,
    default: '',
  },
  proposal: {
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
let votables =
  props.proposal.length == 0
    ? useRoute().params.id.length == 0 || useRoute().params.proposalId.length == 0
      ? ref([])
      : votableCollection(useRoute().params.id as string, useRoute().params.proposalId as string)
    : votableCollection(props.meeting as string, props.proposal as string);
const sortedVotables = computed(() => votables.value.toSorted((a, b) => a.order - b.order));
let action = ref('');
let target = reactive(
  {} as {
    id: string;
    choices: string[];
    question: string;
    order: number;
    results: Record<string, string[]>;
  },
);
let selected = computed({
  get: () => (props.proposal.length > 0 ? props.proposal : route.params.proposalId),
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
const route = useRoute();

function edit(prop: any) {
  target.id = prop.id;
  target.question = prop.question;
  target.choices = prop.choices;
  target.order = prop.order;
  target.results = prop.results;
  action.value = 'edit';
}

function add() {
  target.question = '';
  target.choices = [];
  target.order = votables.value.length;
  target.results = {};
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
      await deleteDoc(doc(rawVotableCollection(route.params.id as string, route.params.proposalId as string), id));
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
      message: '已刪除投票案件',
      color: 'positive',
    });
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
    };
    if (action.value === 'edit') {
      await updateDoc(doc(db, `meetings/${route.params.id}/proposals/${route.params.proposalId}/votables`, target.id), data);
    } else if (action.value === 'add') {
      await setDoc(doc(db, `meetings/${route.params.id}/proposals/${route.params.proposalId}/votables`, generateRandomText(6)), data);
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
    message: '投票案件已更新',
    color: 'positive',
  });
}

async function rearrange() {
  Loading.show();
  const tasks = [];
  try {
    for (let i = 0; i < votables.value.length; i++) {
      tasks.push(
        updateDoc(doc(db, `meetings/${route.params.id}/proposals/${route.params.proposalId}/votables`, votables.value[i].id), {
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

async function showResults() {
  let r = '';
  let count = 1;
  for (const votable of votables.value) {
    r += `<b>${count}. ${votable.question}</b><br>`;
    let maxLen = 0;
    let maxChoice = '';
    for (const choice of votable.choices) {
      if (!votable.results[choice]) {
        r += `<b>${choice}</b>: 無；共 0 人<br>`;
        continue;
      }
      const length = votable.results[choice].length;
      r += `<b>${choice}</b>: ${votable.results[choice].join('、')}；共 ${length} 人<br>`;
      if (length > maxLen) {
        maxLen = length;
        maxChoice = choice;
      }
    }
    r += '表決結果：<b>' + maxChoice + '</b><br>';
    count++;
  }
  Dialog.create({
    title: '投票結果',
    message: r,
    html: true,
    persistent: true,
  });
}
</script>

<style scoped></style>
