<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab :to="'/meetings/' + selected" label="會議" />
      <q-route-tab :to="`/meetings/${selected.length == 0 ? '' : selected + '/'}proposals`" label="提案" />
      <q-route-tab :to="`/meetings/${selected.length == 0 ? '' : selected + '/'}proposals/votables`" label="投票案件" />
    </q-tabs>
    <q-table
      v-model:pagination="pagination"
      :columns="columns"
      :filter="filter"
      :loading="Object.values(meetings).length === 0"
      :rows="Object.values(meetings)"
      class="rounded-borders shadow-2 q-ma-md"
      color="primary"
      row-key="name"
      title="會議管理"
    >
      <template v-slot:top-right>
        <div class="row justify-end q-gutter-sm">
          <q-btn icon="add" @click="add">新增會議</q-btn>
          <q-input v-model="filter" debounce="300" dense label="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </template>
      <template v-slot:body="props">
        <q-tr :class="selected == props.row.id ? 'bg-green-1' : ''" :props="props">
          <q-td v-for="col in props.cols" :key="col.name" :props="props">
            {{ col.value }}
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
            <q-btn class="text-brown-9 q-ml-sm q-mr-sm" icon="ios_share" round @click="exportAttendance(props.row)">
              <q-tooltip>匯出出席狀況</q-tooltip>
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
        <span style="color: gray; text-decoration: underline; cursor: pointer" @click="targetMeeting.name = `${currentReign} 第次常務會議`"
          >常務會議
        </span>
        <span style="color: gray; text-decoration: underline; cursor: pointer" @click="targetMeeting.name = `${currentReign} 第次臨時會議`"
          >臨時會議</span
        >
        <q-input v-model="targetMeeting.reign" label="屆數" />
        <p class="q-mb-none">開會日期：</p>
        <div class="row q-gutter-md q-ml-none">
          <q-date v-model="targetMeeting.startDate" class="col" mask="YYYY-MM-DD" />
          <q-time v-model="targetMeeting.startTime" class="col" format24h mask="HH:mm" />
        </div>
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
import { currentReign, Meeting, meetingCollection, meetingConverter, rawMeetingCollection, User } from 'src/ts/models.ts';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { date, Dialog, Loading, Notify, QTableColumn } from 'quasar';
import { useFirestore } from 'vuefire';
import { generateRandomText } from 'src/ts/utils.ts';
import { useRoute, useRouter } from 'vue-router';
import { getAllUsers } from 'src/ts/auth.ts';

const columns = [
  { name: 'name', label: '會議名稱', field: 'name', sortable: true, align: 'left' },
  {
    name: 'start',
    label: '開會時間',
    field: 'start',
    format: (val: Date) => val.toLocaleString(),
    sortable: true,
    align: 'left',
  },
  { name: 'reign', label: '屆數', field: 'reign', sortable: true, align: 'left' },
] as QTableColumn[]; // Typescript magic requirements
const filter = ref('');
const action = ref('');
const targetMeeting = reactive({} as { id: string; name: string; startDate: string; startTime: string; reign: string });
const db = useFirestore();
let meetings = meetingCollection();
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
let pagination = ref({ sortBy: 'start', descending: true });

function edit(row: any) {
  action.value = 'edit';
  targetMeeting.id = row.id;
  targetMeeting.name = row.name;
  targetMeeting.startDate = date.formatDate(row.start, 'YYYY-MM-DD');
  targetMeeting.startTime = date.formatDate(row.start, 'HH:mm');
  targetMeeting.reign = row.reign;
}

function add() {
  action.value = 'add';
  targetMeeting.name = '';
  targetMeeting.startDate = date.formatDate(new Date(), 'YYYY-MM-DD');
  targetMeeting.startTime = date.formatDate(new Date(), 'HH:mm:ss');
  targetMeeting.reign = currentReign;
}

async function submit() {
  Loading.show();
  try {
    if (action.value === 'edit') {
      await updateDoc(doc(db, 'meetings', targetMeeting.id).withConverter(meetingConverter), {
        name: targetMeeting.name,
        start: date.extractDate(targetMeeting.startDate + ' ' + targetMeeting.startTime, 'YYYY-MM-DD HH:mm'),
        reign: targetMeeting.reign,
      });
    } else if (action.value === 'add') {
      const d = date.extractDate(targetMeeting.startDate + ' ' + targetMeeting.startTime, 'YYYY-MM-DD HH:mm');

      await setDoc(doc(db, 'meetings', date.formatDate(d, 'YYYYMMDD') + '_' + generateRandomText(6)).withConverter(meetingConverter), {
        active: false,
        name: targetMeeting.name,
        participants: [],
        punchInPasscode: generateRandomText(6),
        signedOff: [],
        start: d,
        activeProposal: null,
        absences: {},
        reign: targetMeeting.reign,
      } as unknown as Meeting);
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
  const url = window.location.origin + (window.location.origin.endsWith('/') ? '' : '/') + '#/schedule_absence/' + row.id;
  await navigator.clipboard.writeText(url);
  Notify.create({
    message: '已複製請假連結',
    color: 'positive',
  });
}

async function exportAttendance(meeting: Meeting) {
  Loading.show();
  try {
    const accounts = (await getAllUsers()) as User[];
    const data = {
      attended: [] as string[],
      absent: [] as string[],
      scheduledAbsence: [] as string[],
    };
    for (const account of accounts) {
      const clazz = account.clazz ?? '';
      if (data.attended.includes(clazz) || data.absent.includes(clazz) || data.scheduledAbsence.includes(clazz)) {
        continue;
      }
      if (meeting.participants.includes(clazz)) {
        data.attended.push(clazz);
      } else if (Object.keys(meeting.absences).includes(clazz)) {
        data.scheduledAbsence.push(clazz);
      } else {
        data.absent.push(clazz);
      }
    }
    Dialog.create({
      title: '出席狀況',
      message: `
      <p>出席：${data.attended.sort().join('、')}；共 ${data.attended.length} 人</p>
      <p>請假：${data.scheduledAbsence.sort().join('、')}；共 ${data.scheduledAbsence.length} 人</p>
      <p>缺席：${data.absent.sort().join('、')}；共 ${data.absent.length} 人</p>
    `,
      persistent: true,
      html: true,
    });
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '匯出失敗',
      color: 'negative',
    });
  } finally {
    Loading.hide();
  }
}
</script>

<style scoped></style>
