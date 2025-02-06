<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab :to="'/meetings/' + selected" label="會議" />
      <q-route-tab :disable="!selected" :to="`/meetings/${selected.length == 0 ? '' : selected + '/'}proposals`" label="提案" />
      <q-route-tab :to="`/meetings/${selected.length == 0 ? '' : selected + '/'}proposals/votables`" disable label="投票案件" />
    </q-tabs>
    <q-table
      v-model:pagination="pagination"
      :columns="columns"
      :filter="filter"
      :loading="Object.values(meetings).length === 0"
      :rows="Object.values(meetings)"
      :title="`${reign} 會議管理`"
      class="rounded-borders shadow-2 q-ma-md"
      color="primary"
      row-key="name"
    >
      <template v-slot:top-right>
        <div class="row justify-end q-gutter-sm">
          <q-btn icon="visibility" @click="changeReign">檢視其他屆期</q-btn>
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
            <q-btn class="text-brown-9 q-ml-sm q-mr-sm" icon="draw" round @click="exportMeetingRecord(props.row)">
              <q-tooltip>起草會議記錄</q-tooltip>
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
  <q-dialog :model-value="action === 'edit' || action === 'add'">
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新增' }}會議</h6>
      </q-card-section>
      <q-card-section class="q-gutter-md">
        <q-input v-model="targetMeeting.name" label="會議名稱" />
        <span class="template-link" @click="targetMeeting.name = `${currentReign} 第次常務會議`"> 常務會議 </span>
        <span class="template-link" @click="targetMeeting.name = `${currentReign} 第次臨時會議`"> 臨時會議 </span>
        <span
          class="template-link"
          @click="
            targetMeeting.name = `${currentReign} 預備會議`;
            targetMeeting.registration = true;
          "
        >
          預備會議</span
        >
        <q-input v-model="targetMeeting.reign" label="屆期" />
        <q-checkbox v-model="targetMeeting.registration" label="開放註冊 (預備會議用)" />
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
import {
  Meeting,
  meetingCollectionOfReign,
  meetingConverter,
  rawMeetingCollection,
  rawProposalCollection,
  rawVotableCollection,
  Role,
  User,
} from 'src/ts/models.ts';
import { deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { date, Dialog, Loading, Notify, QTableColumn } from 'quasar';
import { useFirestore } from 'vuefire';
import { currentReign, generateRandomText } from 'src/ts/utils.ts';
import { useRoute, useRouter } from 'vue-router';
import { getAllUsers } from 'src/ts/auth.ts';
import { exportVotingData } from 'pages/mgmt/common.ts';

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
  { name: 'reign', label: '屆期', field: 'reign', sortable: true, align: 'left' },
] as QTableColumn[]; // Typescript magic requirements
const pagination = ref({ sortBy: 'start', descending: true });
const filter = ref('');
const action = ref('');
const targetMeeting = reactive({} as { id: string; name: string; startDate: string; startTime: string; reign: string; registration: boolean; punchInPasscode: string });
const db = useFirestore();
const route = useRoute();
const router = useRouter();
const reign = ref(currentReign);
const meetings = meetingCollectionOfReign(reign);
const selected = computed({
  get: () => route.params.id,
  set: (value) => {
    if (value === selected.value) {
      router.push({ params: { id: '' } });
    } else {
      router.push({ params: { id: value } });
    }
  },
});

function edit(row: any) {
  action.value = 'edit';
  targetMeeting.id = row.id;
  targetMeeting.name = row.name;
  targetMeeting.startDate = date.formatDate(row.start, 'YYYY-MM-DD');
  targetMeeting.startTime = date.formatDate(row.start, 'HH:mm');
  targetMeeting.reign = row.reign;
  targetMeeting.registration = row.registration;
  targetMeeting.punchInPasscode = row.punchInPasscode;
}

function add() {
  action.value = 'add';
  targetMeeting.name = '';
  targetMeeting.startDate = date.formatDate(new Date(), 'YYYY-MM-DD');
  targetMeeting.startTime = date.formatDate(new Date(), 'HH:mm:ss');
  targetMeeting.reign = currentReign;
  targetMeeting.registration = false;
}

async function submit() {
  Loading.show();
  try {
    if (action.value === 'edit') {
      // Reassign the passcode if registration status was changed
      if (targetMeeting.punchInPasscode && targetMeeting.punchInPasscode.startsWith('reg') && !targetMeeting.registration) {
        targetMeeting.punchInPasscode = generateRandomText(6, 'reg');
      }
      if (targetMeeting.punchInPasscode && !targetMeeting.punchInPasscode.startsWith('reg') && targetMeeting.registration) {
        targetMeeting.punchInPasscode = 'reg' + generateRandomText(3, null);
      }
      await updateDoc(doc(db, 'meetings', targetMeeting.id).withConverter(meetingConverter), {
        name: targetMeeting.name,
        start: date.extractDate(targetMeeting.startDate + ' ' + targetMeeting.startTime, 'YYYY-MM-DD HH:mm'),
        reign: targetMeeting.reign,
        registration: targetMeeting.registration,
        punchInPasscode: targetMeeting.punchInPasscode,
      });
    } else if (action.value === 'add') {
      const d = date.extractDate(targetMeeting.startDate + ' ' + targetMeeting.startTime, 'YYYY-MM-DD HH:mm');

      await setDoc(doc(db, 'meetings', date.formatDate(d, 'YYYYMMDD') + '_' + generateRandomText(6, null)).withConverter(meetingConverter), {
        active: false,
        name: targetMeeting.name,
        participants: [],
        punchInPasscode: targetMeeting.registration ? generateRandomText(6, 'reg') : 'reg' + generateRandomText(3, null),
        signedOff: [],
        start: d,
        activeProposal: null,
        absences: {},
        reign: targetMeeting.reign,
        registration: targetMeeting.registration,
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

async function getAttendanceData(meeting: Meeting) {
  const accounts = (await getAllUsers()) as User[];
  const data = {
    attended: [] as string[],
    absent: [] as string[],
    scheduledAbsence: [] as string[],
    accounts,
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
  return data;
}

async function exportAttendance(meeting: Meeting) {
  Loading.show();
  try {
    const data = await getAttendanceData(meeting);
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

async function exportMeetingRecord(meeting: Meeting) {
  Loading.show({ message: '正在取得出席資料' });
  try {
    const data = await getAttendanceData(meeting);
    const dow = ['日', '一', '二', '三', '四', '五', '六'][meeting.start.getDay()];
    let proposals = '';
    let votables = '';
    let count = 0;
    const attachments = [];
    Loading.show({ message: '正在取得提案資料' });
    for (const proposal of (await getDocs(query(rawProposalCollection((meeting as any).id), orderBy('order')))).docs) {
      count++;
      const data = proposal.data();
      const title = data.title;
      proposals += `<div style="font-size: medium">${count}. ${title}</font></div>`;
      Loading.show({ message: '正在取得投票資料 - ' + title });
      votables += `<div style="font-size: medium">${count}. ${title}</font></div>`;
      votables += exportVotingData(
        (await getDocs(query(rawVotableCollection((meeting as any).id, proposal.id), orderBy('order')))).docs.map((d) => d.data()) as any,
      );
      attachments.push({
        urls: data.attachments,
        description: `「${title}」關係文書附件`,
      });
    }
    const content = `<div style="font-size: medium">一、開會時間：中華民國${meeting.start.getFullYear() - 1911}年${meeting.start.getMonth() + 1}月${meeting.start.getDate()}日
星期${dow} ${meeting.start.getHours()}時${meeting.start.getMinutes()}分</font></div>
<div style="font-size: medium">二、出席狀況：</font></div>
<div style="font-size: medium">1. 出席：${data.attended.sort().join('、')}；共 ${data.attended.length} 人</font></div>
<div style="font-size: medium">2. 請假：${data.scheduledAbsence.sort().join('、')}；共 ${data.scheduledAbsence.length}人</font></div>
<div style="font-size: medium">3. 缺席：${data.absent.sort().join('、')}；共 ${data.absent.length} 人</font></div>
<div style="font-size: medium">三、議案以及決議</font></div>
<div style="font-size: medium">(一) 議案順序：</font></div>
${proposals}
<div style="font-size: medium">(二) 議案決議</font></div>
${votables}
`;
    const result = {} as any;
    result.content = content;
    const realName = meeting.name.match(/\d*-\d (.*)/);
    if (realName && realName.length > 1) {
      result.subject = realName[1];
    } else {
      result.subject = meeting.name;
    }
    result.fromSpecific = 'Speaker';
    result.fromName = data.accounts.filter((u) => u.role === Role.Chair)[0].name.replace(/ck[0-9]*/, '');
    result.secretarySpecific = 'StudentCouncilSecretary';
    result.secretaryName = data.accounts.filter((u) => u.role === Role.Secretary)[0].name.replace(/ck[0-9]*/, '');
    result.location = '夢紅樓五樓 公民審議論壇教室';
    result.type = 'Record';
    result.attachments = attachments;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result));
      window.open('https://cksc-legislation.firebaseapp.com/manage/document/from_template');
    } catch (e) {
      Dialog.create({
        title: '起草會議記錄',
        message: '請將以下內容「全選」並複製到剪貼簿中，再按下OK，於新打開的頁面中允許貼上：',
        persistent: true,
        ok: true,
        prompt: {
          model: JSON.stringify(result),
        },
      }).onOk(async (data: any) => {
        window.open('https://cksc-legislation.firebaseapp.com/manage/document/from_template');
      });
    }
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '起草失敗',
      color: 'negative',
    });
  } finally {
    Loading.hide();
  }
}

function changeReign() {
  Dialog.create({
    title: '更改屆期',
    message: `請輸入要檢視的屆期 (例如：${currentReign})`,
    prompt: {
      model: `${reign.value}`,
      label: '屆期',
    },
    persistent: true,
    ok: true,
    cancel: true,
  }).onOk((data) => {
    reign.value = data.trim();
  });
}
</script>

<style scoped>
.template-link {
  color: gray;
  text-decoration: underline;
  cursor: pointer;
}
</style>
