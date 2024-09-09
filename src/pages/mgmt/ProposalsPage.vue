<template>
  <q-tabs align="left">
    <q-route-tab :to="'/meetings/' + $route.params.id" label="會議" />
    <q-route-tab
      :to="`/meetings/${$route.params.id.length == 0 ? '' : $route.params.id + '/'}proposals/${$route.params.proposalId}`"
      label="提案"
    />
    <q-route-tab
      :to="`/meetings/${$route.params.id.length == 0 ? '' : $route.params.id + '/'}proposals/${$route.params.proposalId.length == 0 ? '' : $route.params.proposalId + '/'}votables`"
      label="投票案件"
    />
  </q-tabs>
  <span v-if="$route.params.id.length == 0">請先選擇一個會議</span>
  <q-page v-else padding>
    <q-btn
      color="primary"
      icon="add"
      label="新增提案"
      style="margin-bottom: 10px"
      @click="add"
    />
    <span class="q-ml-md">提示：可以直接拖拉提案方塊以重新排序</span>
    <VueDraggable
      v-model="proposals"
      class="q-gutter-md"
      style="cursor: move"
      @update="rearrange()"
    >
      <q-card
        v-for="prop of proposals.sort((a, b) => a.order - b.order)"
        :key="prop.order"
        :class="selected == prop.id ? 'bg-green-1' : ''"
      >
        <q-card-section>
          <div class="text-h6">{{ prop.title }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-subtitle1">提案人：{{ prop.proposer }}</div>
          <div>{{ prop.content }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-subtitle1">附件：</div>
          <q-list>
            <q-item
              v-for="attachment of prop.attachments"
              :key="attachment"
              v-ripple
              :href="attachment"
              clickable
              target="_blank"
            >
              <q-item-section>{{ attachment }}</q-item-section>
              <q-item-section side>
                <q-icon name="visibility" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-separator />
        <q-card-actions>
          <q-btn
            color="positive"
            flat
            label="選擇並檢視投票案件"
            @click="
              selected = prop.id;
              $router.push(
                `/meetings/${$route.params.id}/proposals/${prop.id}/votables`,
              );
            "
          />
          <q-btn color="primary" flat label="編輯" @click="edit(prop)" />
          <q-btn color="negative" flat label="刪除" @click="del(prop.id)" />
        </q-card-actions>
      </q-card>
    </VueDraggable>
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
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="action = ''" />
        <q-btn color="positive" flat label="確定" @click="submit()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { proposalCollection } from 'src/ts/models.ts';
import { useRoute, useRouter } from 'vue-router';
import {
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Dialog, Loading, Notify } from 'quasar';
import { useFirestore } from 'vuefire';
import { computed, reactive, ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { generateRandomText } from 'src/ts/utils.ts';
import ListEditor from 'components/ListEditor.vue';

let proposals =
  useRoute().params.id.length == 0
    ? ref([])
    : proposalCollection(useRoute().params.id as string);
let action = ref('');
let target = reactive(
  {} as {
    attachments: string[];
    content: string;
    proposer: string;
    title: string;
    id: string;
    order: number;
    activeVotable?: string | null;
    speakRequests: string[];
  },
);
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
  target.attachments = proposal.attachments;
  target.content = proposal.content;
  target.proposer = proposal.proposer;
  target.title = proposal.title;
  target.order = proposal.order;
  target.id = proposal.id;
  target.activeVotable = proposal.activeVotable;
  target.speakRequests = proposal.speakRequests;
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
      await deleteDoc(
        doc(
          collection(useFirestore(), `meetings/${route.params.id}/proposals`),
          id,
        ),
      );
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
      order: target.order,
      activeVotable: target.activeVotable,
      speakRequests: target.speakRequests,
    };
    if (action.value === 'edit') {
      await updateDoc(
        doc(db, `meetings/${route.params.id}/proposals`, target.id),
        data,
      );
    } else if (action.value === 'add') {
      await setDoc(
        doc(db, `meetings/${route.params.id}/proposals`, generateRandomText(6)),
        data,
      );
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
        updateDoc(
          doc(
            db,
            `meetings/${route.params.id}/proposals`,
            proposals.value[i].id,
          ),
          {
            order: i,
          },
        ),
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
</script>

<style scoped></style>
