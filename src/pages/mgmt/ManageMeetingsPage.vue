<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab :to="'/meetings/' + selected" label="會議" />
      <q-route-tab :disable="!selected" :to="`/meetings/${selected?.length == 0 ? '' : selected + '/'}proposals`" label="提案" />
      <q-route-tab disable label="投票案件" />
    </q-tabs>
    <q-table
      v-model:pagination="pagination"
      :columns="columns"
      :filter="filter"
      :loading="Object.values(meetings).length === 0"
      :rows="Object.values(meetings)"
      :title="`${reign} 會議管理`"
      :visible-columns="$q.screen.gt.xs ? ['name', 'start', 'reign'] : ['name']"
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
            <q-btn class="text-yellow-9 q-ml-sm q-mr-sm" icon="edit" round @click="edit(props.row)">
              <q-tooltip>編輯</q-tooltip>
            </q-btn>

            <q-btn class="q-ml-sm q-mr-sm" flat icon="more_vert" round>
              <q-tooltip>更多功能</q-tooltip>
              <q-menu auto-close transition-hide="jump-up" transition-show="jump-down">
                <q-list>
                  <q-item clickable @click="copyLink(props.row)">
                    <q-item-section avatar>
                      <q-icon color="amber" name="content_copy" />
                    </q-item-section>
                    <q-item-section>複製請假連結</q-item-section>
                  </q-item>
                  <q-item clickable @click="exportMeetingNotice(props.row)">
                    <q-item-section avatar>
                      <q-icon color="amber" name="draw" />
                    </q-item-section>
                    <q-item-section>起草開會通知單</q-item-section>
                  </q-item>
                  <q-item clickable @click="exportMeetingRecord(props.row)">
                    <q-item-section avatar>
                      <q-icon color="brown" name="draw" />
                    </q-item-section>
                    <q-item-section>起草會議記錄</q-item-section>
                  </q-item>
                  <q-item clickable @click="exportAttendance(props.row)">
                    <q-item-section avatar>
                      <q-icon color="brown" name="ios_share" />
                    </q-item-section>
                    <q-item-section>匯出出席狀況</q-item-section>
                  </q-item>
                  <q-item clickable @click="del(props.row)">
                    <q-item-section avatar>
                      <q-icon color="red" name="delete" />
                    </q-item-section>
                    <q-item-section>刪除</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
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
        <q-checkbox v-model="targetMeeting.exemptFromAttendance" label="不記入出缺席 (委員會會議用)" />
        <div class="row">
          <q-checkbox :model-value="!!targetMeeting.customAttendanceBar" @update:model-value="editCustomAttendanceBar" label="自訂開會門檻" />
          <q-input
            class="q-ml-sm"
            v-if="targetMeeting.customAttendanceBar"
            v-model.number="targetMeeting.customAttendanceBar"
            type="number"
            dense
            label="開會門檻"
          />
        </div>
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
import type { Meeting, MeetingId, Votable } from 'src/ts/models.ts';
import {
  meetingCollectionOfReign,
  meetingConverter,
  rawMeetingCollection,
  rawProposalCollection,
  rawVotableCollection,
  Role,
} from 'src/ts/models.ts';
import { deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import type { QTableColumn } from 'quasar';
import { date, Dialog, Loading } from 'quasar';
import { useFirestore } from 'vuefire';
import { cleanseName, currentReign, generateRandomText, notifyError, notifySuccess } from 'src/ts/utils.ts';
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

interface EditableMeeting extends MeetingId {
  startDate: string;
  startTime: string;
}

const targetMeeting = reactive({} as EditableMeeting);
const db = useFirestore();
const route = useRoute();
const router = useRouter();
const reign = ref(currentReign);
const meetings = meetingCollectionOfReign(reign);
const selected = computed({
  get: () => route.params.id,
  set: (value) => {
    if (value === selected.value) {
      void router.push({ params: { id: '' } });
    } else {
      void router.push({ params: { id: value } });
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
  targetMeeting.exemptFromAttendance = row.exemptFromAttendance;
  targetMeeting.punchInPasscode = row.punchInPasscode;
  targetMeeting.customAttendanceBar = row.customAttendanceBar;
}

function add() {
  action.value = 'add';
  targetMeeting.name = '';
  targetMeeting.startDate = date.formatDate(new Date(), 'YYYY-MM-DD');
  targetMeeting.startTime = date.formatDate(new Date(), 'HH:mm:ss');
  targetMeeting.reign = currentReign;
  targetMeeting.registration = false;
  targetMeeting.exemptFromAttendance = false;
  targetMeeting.customAttendanceBar = null;
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
        exemptFromAttendance: targetMeeting.exemptFromAttendance,
        customAttendanceBar: targetMeeting.customAttendanceBar ? targetMeeting.customAttendanceBar : null,
        punchInPasscode: targetMeeting.punchInPasscode,
      });
    } else if (action.value === 'add') {
      const d = date.extractDate(targetMeeting.startDate + ' ' + targetMeeting.startTime, 'YYYY-MM-DD HH:mm');

      await setDoc(doc(db, 'meetings', date.formatDate(d, 'YYYYMMDD') + '_' + generateRandomText(6, null)).withConverter(meetingConverter), {
        active: false,
        name: targetMeeting.name,
        participants: [],
        punchInPasscode: targetMeeting.registration ? 'reg' + generateRandomText(3, null) : generateRandomText(6, 'reg'),
        signedOff: [],
        start: d,
        activeProposal: null,
        absences: {},
        reign: targetMeeting.reign,
        registration: targetMeeting.registration,
        exemptFromAttendance: targetMeeting.exemptFromAttendance,
        customAttendanceBar: targetMeeting.customAttendanceBar ? targetMeeting.customAttendanceBar : null,
      } as unknown as Meeting);
    }
  } catch (e) {
    notifyError('更新失敗', e);
  }
  Loading.hide();
  action.value = '';
  notifySuccess('成功更新會議');
}

function del(row: any) {
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
      notifyError('刪除失敗', e);
      return;
    }
    Loading.hide();
    notifySuccess('成功刪除會議');
  });
}

async function copyLink(row: any) {
  const url = window.location.origin.replace(/\/+$/, '') + '/schedule_absence/' + row.id;
  await navigator.clipboard.writeText(url);
  notifySuccess('已複製請假連結');
}

async function getAttendanceData(meeting: Meeting) {
  const accounts = await getAllUsers();
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
    notifyError('匯出失敗', e);
  } finally {
    Loading.hide();
  }
}

async function exportMeetingRecord(meeting: Meeting) {
  Loading.show({ message: '正在取得出席資料' });
  try {
    const data = await getAttendanceData(meeting);
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
      if (data.attachments.length > 0) {
        attachments.push({
          urls: data.attachments,
          description: `「${title}」關係文書附件`,
        });
      }
    }
    const content = `
<div style="font-size: medium">一、出席狀況：</font></div>
<div style="font-size: medium">1. 出席：${data.attended.sort().join('、')}；共 ${data.attended.length} 人</font></div>
<div style="font-size: medium">2. 請假：${data.scheduledAbsence.sort().join('、')}；共 ${data.scheduledAbsence.length} 人</font></div>
<div style="font-size: medium">3. 缺席：${data.absent.sort().join('、')}；共 ${data.absent.length} 人</font></div>
<div style="font-size: medium">二、議案與決議</font></div>
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
    const chairs = data.accounts.filter((u) => u.role === Role.Chair);
    result.fromName = cleanseName(chairs[0]?.name) ?? '找不到議長';
    result.secretarySpecific = 'StudentCouncilSecretary';
    const secretaries = data.accounts.filter((u) => u.role === Role.Secretary);
    result.secretaryName = cleanseName(secretaries[0]?.name) ?? '找不到秘書';
    result.location = '夢紅樓五樓 公民審議論壇教室';
    result.type = 'Record';
    result.attachments = attachments;
    result.meetingTime = meeting.start.valueOf();
    try {
      await navigator.clipboard.writeText(JSON.stringify(result));
      window.open('https://law.cksc.tw/manage/document/from_template');
    } catch (e) {
      Dialog.create({
        title: '起草會議記錄',
        message: '請將以下內容「全選」並複製到剪貼簿中，再按下OK，於新打開的頁面中允許貼上：',
        persistent: true,
        ok: true,
        prompt: {
          model: JSON.stringify(result),
        },
      }).onOk(() => {
        window.open('https://law.cksc.tw/manage/document/from_template');
      });
    }
  } catch (e) {
    notifyError('匯出失敗', e);
  } finally {
    Loading.hide();
  }
}

async function exportMeetingNotice(meeting: Meeting) {
  try {
    const accounts = await getAllUsers();
    let proposals = '';
    let count = 0;
    const attachments = [];
    Loading.show({ message: '正在取得提案資料' });
    for (const proposal of (await getDocs(query(rawProposalCollection((meeting as any).id), orderBy('order')))).docs) {
      count++;
      const data = proposal.data();
      const title = data.title;
      proposals += `<div style="font-size: medium">${count}. ${title}</font></div>`;
      Loading.show({ message: '正在取得投票資料 - ' + title });
      const votables = (await getDocs(query(rawVotableCollection((meeting as any).id, proposal.id), orderBy('order')))).docs.map((d) =>
        d.data(),
      ) as Votable[];
      if (votables.length > 0) {
        proposals += '<div style="font-size: medium">投票案：</font></div>';
        let count = 0;
        for (const votable of votables) {
          count++;
          proposals += `<div style="font-size: medium">(${count}) ${votable.question} (${votable.type.translation})</font></div>`;
        }
        proposals += '<div><br></div>';
      }
      if (data.attachments.length > 0) {
        attachments.push({
          urls: data.attachments,
          description: `「${title}」關係文書附件`,
        });
      }
    }
    const result = {} as any;
    const chairs = accounts.filter((u) => u.role === Role.Chair);
    const host = cleanseName(chairs[0]?.name) ?? '找不到議長';
    result.content = `
<div style="font-size: large">議程：</div>
${proposals}
<div><br></div>
<div style="font-size: medium">備註：</div>
<div style="font-size: medium">一、請尚未加入本期間班級代表LINE社群的班代盡快加入，以便聯繫及接收最新開會資訊。</div>
<div style="font-size: medium">二、班代大會為本校重要學生自治機關，請各位班級代表務必出席，不勝感激。不克出席者請請假或由同班同學代理。</div>
<div style="font-size: medium">三、任何會議資料及會議相關事宜的更動皆會發布在本會社群。</div>`;
    const realName = meeting.name.match(/\d*-\d (.*)/);
    if (realName && realName.length > 1) {
      result.subject = realName[1];
    } else {
      result.subject = meeting.name;
    }
    result.fromSpecific = 'Speaker';
    result.fromName = host;
    result.toSpecific = ['StudentCouncilRepresentative'];
    result.ccSpecific = ['Chairman', 'ViceChairman', 'JudicialCommitteeMember'];
    result.location = '夢紅樓五樓 公民審議論壇教室';
    result.type = 'MeetingNotice';
    result.attachments = attachments;
    result.meetingTime = meeting.start.valueOf();
    try {
      await navigator.clipboard.writeText(JSON.stringify(result));
      window.open('https://law.cksc.tw/manage/document/from_template');
    } catch (e) {
      Dialog.create({
        title: '起草會議記錄',
        message: '請將以下內容「全選」並複製到剪貼簿中，再按下OK，於新打開的頁面中允許貼上：',
        persistent: true,
        ok: true,
        prompt: {
          model: JSON.stringify(result),
        },
      }).onOk(() => {
        window.open('https://law.cksc.tw/manage/document/from_template');
      });
    }
  } catch (e) {
    notifyError('匯出失敗', e);
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

function editCustomAttendanceBar(v: boolean) {
  if (v) {
    targetMeeting.customAttendanceBar = 10;
  } else {
    targetMeeting.customAttendanceBar = null;
  }
}
</script>

<style scoped>
.template-link {
  color: gray;
  text-decoration: underline;
  cursor: pointer;
}
</style>
