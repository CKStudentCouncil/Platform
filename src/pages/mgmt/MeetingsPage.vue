<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab :to="'/meetings/' + selected" label="會議" />
      <q-route-tab :to="`/meetings/${selected.length == 0 ? '' : selected + '/'}proposals`" label="提案" />
      <q-route-tab :to="`/meetings/${selected.length == 0 ? '' : selected + '/'}proposals/votables`" label="投票案件" />
    </q-tabs>
    <q-table
      :columns="columns"
      :filter="filter"
      :filter-method="customFilter"
      :loading="Object.values(meetings).length === 0"
      :rows="Object.values(meetings)"
      :sort-method="customSort"
      class="rounded-borders shadow-2 q-ma-md"
      color="primary"
      row-key="name"
      title="會議管理"
    >
      <template v-slot:top-right>
        <div class="row justify-end q-gutter-sm">
          <q-btn icon="add" @click="add">新增會議</q-btn>
          <q-input v-model="search" debounce="300" dense label="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </template>
      <template v-slot:body="props">
        <q-tr :class="selected == props.row.id ? 'bg-green-1' : ''" :props="props">
          <q-td key="name">
            {{ props.row.name }}
          </q-td>
          <q-td key="start">
            {{ props.row.start.toLocaleDateString() }}
          </q-td>
          <q-td key="actions" style="text-align: right">
            <q-btn
              class="text-positive q-ml-sm q-mr-sm"
              icon="check"
              round
              @click="
                selected = props.row.id;
                $router.push(`/meetings/${props.row.id}/proposals`);
              "
            >
              <q-tooltip>選擇並管理提案</q-tooltip>
            </q-btn>
            <q-btn class="text-amber-9 q-ml-sm q-mr-sm" icon="content_copy" round @click="copyLink(props.row)">
              <q-tooltip>複製請假連結</q-tooltip>
            </q-btn>
            <q-btn class="text-yellow-9 q-ml-sm q-mr-sm" icon="edit" round @click="edit(props.row)">
              <q-tooltip>編輯</q-tooltip>
            </q-btn>
            <q-btn class="text-red q-ml-sm q-mr-sm" icon="delete" round @click="del(props.row)">
              <q-tooltip>刪除</q-tooltip>
            </q-btn>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </q-page>
  <q-dialog v-model="dialog">
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新增' }}會議</h6>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <q-input v-model="targetMeeting.name" label="會議名稱" />
        <span
          style="color: gray; text-decoration: underline; cursor: pointer"
          @click="targetMeeting.name = '第次常務會議'"
          >常務會議
        </span>
        <span
          style="color: gray; text-decoration: underline; cursor: pointer"
          @click="targetMeeting.name = '第次臨時會議'"
          >臨時會議</span
        >
        <p class="q-mb-none">開會日期：</p>
        <q-date v-model="targetMeeting.start" mask="YYYY-MM-DD" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="action = ''" />
        <q-btn color="primary" flat label="儲存" @click="submit()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';
import { Meeting, meetingCollection, meetingConverter, rawMeetingCollection } from 'src/ts/models.ts';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { date, Dialog, Loading, Notify } from 'quasar';
import { useFirestore } from 'vuefire';
import { generateRandomText } from 'src/ts/utils.ts';
import { useRoute, useRouter } from 'vue-router';

const columns = [
  {
    name: 'name',
    label: '會議名稱',
    field: 'name',
    sortable: true,
    align: 'left',
  },
  {
    name: 'start',
    label: '開會時間',
    field: 'start',
    sortable: true,
    align: 'left',
  },
] as {
  name: string;
  label: string;
  field: string;
  sortable: boolean;
  align: 'left';
}[]; // Typescript magic requirements
let search = ref('');
let action = ref('');
let targetMeeting = reactive({} as { id: string; name: string; start: string });
const db = useFirestore();
let meetings = meetingCollection();
const filter = computed(() => {
  return {
    search: search,
  };
});
const dialog = computed(() => {
  return action.value === 'edit' || action.value === 'add';
});
const route = useRoute();
const router = useRouter();
let selected = computed({
  get: () => route.params.id,
  set: (value) => {
    if (value === selected.value) {
      router.push({ params: { id: '' } });
    } else {
      router.push({ params: { id: value } });
    }
  },
});

function customFilter(rows: readonly any[]): readonly any[] {
  const lowerTerms = search.value.toLowerCase();
  return rows.filter((row: Meeting) => {
    return (String(row.name).toLowerCase() + row.start.toLocaleDateString().toLowerCase()).includes(lowerTerms);
  });
}

function customSort(rows: readonly any[], sortBy: string | undefined, descending: boolean) {
  const data = [...rows];
  if (sortBy) {
    data.sort((a, b) => {
      const x = descending ? b : a;
      const y = descending ? a : b;
      if (sortBy == 'name') {
        // string sort
        return x[sortBy] > y[sortBy] ? 1 : x[sortBy] < y[sortBy] ? -1 : 0;
      } else {
        // numeric sort
        return parseFloat(x[sortBy]) - parseFloat(y[sortBy]);
      }
    });
  }
  return data;
}

function edit(row: any) {
  action.value = 'edit';
  targetMeeting.id = row.id;
  targetMeeting.name = row.name;
  targetMeeting.start = row.start.toISOString().split('T')[0];
}

function add() {
  action.value = 'add';
  targetMeeting.name = '';
  targetMeeting.start = new Date().toISOString().split('T')[0];
}

async function submit() {
  Loading.show();
  try {
    if (action.value === 'edit') {
      await updateDoc(doc(db, 'meetings', targetMeeting.id).withConverter(meetingConverter), {
        name: targetMeeting.name,
        start: new Date(targetMeeting.start),
      });
    } else if (action.value === 'add') {
      var d = new Date(targetMeeting.start);

      await setDoc(
        doc(db, 'meetings', date.formatDate(d, 'YYYYMMDD') + '_' + generateRandomText(6)).withConverter(
          meetingConverter,
        ),
        {
          active: false,
          name: targetMeeting.name,
          participants: [],
          punchInPasscode: generateRandomText(6),
          signedOff: [],
          start: d,
          activeProposal: null,
        } as unknown as Meeting,
      );
    }
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '更新失敗',
      color: 'negative',
    });
  }
  Loading.hide();
  action.value = '';
  Notify.create({
    message: '會議已更新',
    color: 'positive',
  });
}

async function del(row: any) {
  Dialog.create({
    title: '刪除會議',
    message: '確定要刪除此會議嗎？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    Loading.show();
    try {
      await deleteDoc(doc(rawMeetingCollection(), row.id));
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
      message: '已刪除會議',
      color: 'positive',
    });
  });
}

async function copyLink(row: any) {
  const url =
    window.location.origin + (window.location.origin.endsWith('/') ? '' : '/') + '#/schedule_absence/' + row.id;
  await navigator.clipboard.writeText(url);
  Notify.create({
    message: '已複製請假連結',
    color: 'positive',
  });
}
</script>

<style scoped></style>
