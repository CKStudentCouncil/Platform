<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab label="檢視班代出席時數" to="/attendance" />
      <q-route-tab label="列出連續未出席者" to="/attendance/serial_absence" />
      <q-route-tab label="生成職務訴訟文書" to="/attendance/export_indictment" />
      <q-route-tab label="列出請假情況" to="/attendance/scheduled_absence" />
      <q-route-tab label="匯出期末時數與記功嘉獎表" to="/attendance/export" />
    </q-tabs>

    <q-card flat bordered class="rounded-borders q-ma-md q-pa-md">
      <div class="row q-gutter-md items-center">
        <div class="col-grow">
          <q-input v-model.number="requirement" type="number" label="連續缺席門檻 (次)" :rules="[(val) => val > 0 || '門檻必須大於 0']" dense />
          <q-input v-model.text="representativeClazz" type="text" label="紀律委員會召集委員班級" dense />
          <br />
          <q-input v-model.text="representativeName" type="text" label="紀律委員會召集委員姓名" dense />
        </div>
      </div>
    </q-card>

    <q-table
      :rows="filtered_serial_absences"
      :columns="tableColumns"
      :title="`${currentReign} 班代連續缺席名單`"
      :loading="!accounts"
      row-key="clazz"
      class="rounded-borders shadow-2 q-ma-md"
    >
      <template v-slot:body-cell-actions="props">
        <q-td :props="props" style="text-align: center">
          <q-btn icon="edit" class="text-blue-9" round flat size="md" @click="exportSpeakerAdvisory([props.row])">
            <q-tooltip>{{ props.row.clazz }} 起草議長函</q-tooltip>
          </q-btn>
          <q-btn icon="description" class="text-amber-9" round flat size="" @click="exportIndictment([props.row])">
            <q-tooltip>{{ props.row.clazz }} 起草訴狀</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="showJsonDialog" persistent>
      <q-card style="max-width: 700px; min-width: 300px">
        <q-card-section>
          <div class="text-h6" align="center">
            {{ dialogTitle }}
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none" v-if="showJsonContent">
          <p class="text-body2 text-grey-7 q-mb-md">已生成文件內容,點擊「起草」按鈕將自動複製並開啟填寫頁面</p>
          <q-input v-model="generatedJson" type="textarea" readonly outlined :rows="10" class="json-textarea" @click="selectAllText" />
          <div class="q-mt-sm">
            <q-btn size="sm" color="secondary" icon="content_copy" label="手動複製" @click="copyJson" flat />
          </div>
        </q-card-section>

        <q-card-actions align="center">
          <q-btn flat label="關閉" color="grey" v-close-popup />
          <q-btn label="起草" color="primary" icon-right="open_in_new" @click="copyAndOpenPage" />
        </q-card-actions>
        <div class="q-pa-sm"></div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script lang="ts" setup>
import { getAllUsers } from 'src/ts/auth.ts';
import { computed, reactive, ref, watch } from 'vue';
import type { User, Meeting } from 'src/ts/models.ts';
import { Role, meetingCollectionOfCurrentReign } from 'src/ts/models.ts';
import { notifyError, notifySuccess, currentReign } from 'src/ts/utils';
import { Dialog, Loading, date, copyToClipboard, Notify } from 'quasar';
import type { QTableColumn } from 'quasar';
import { useRouter } from 'vue-router';

const router = useRouter();

const tableColumns: QTableColumn[] = [
  { name: 'clazz', label: '班級', field: 'clazz', sortable: true, align: 'left' },
  { name: 'count', label: '連續缺席次數', field: 'count', sortable: true, align: 'left', format: (val: number) => `${val} 次` },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' },
];

const accounts = ref(null as User[] | null);
const meetings = meetingCollectionOfCurrentReign();
const absence_map = reactive({} as Record<string, number>);
const requirement = ref(3);

const representativeClazz = ref('');
const representativeName = ref('');

const showJsonDialog = ref(false);
const showJsonContent = ref(true);
const dialogTitle = ref('起草文件');
const generatedJson = ref('');
const currentClazz = ref('');

interface SerialAbsenceRecord {
  clazz: string;
  count: number;
}

const serial_absences_data = computed(() => {
  return Object.entries(absence_map)
    .map(([clazz, count]) => ({ clazz, count }))
    .sort((a, b) => b.count - a.count);
});

const filtered_serial_absences = computed<SerialAbsenceRecord[]>(() => {
  return serial_absences_data.value.filter((item) => item.count >= requirement.value);
});

function updateAttendance() {
  if (!accounts.value) return;

  const participants = [] as string[][];
  const scheduledAbsences = [] as string[][];

  for (const meeting of meetings.value) {
    if (!meeting || meeting.exemptFromAttendance) continue;
    participants.push(meeting.participants);
    scheduledAbsences.push(Object.keys(meeting.absences));
  }

  participants.reverse();
  scheduledAbsences.reverse();

  for (const user of accounts.value) {
    const clazz = user.clazz;
    if (!clazz) continue;

    absence_map[clazz] = 0;

    participants.forEach((participant, i) => {
      if (!participant.includes(clazz) && !scheduledAbsences[i]?.includes(clazz)) {
        absence_map[clazz]!++;
      } else {
        absence_map[clazz] = 0;
      }
    });
  }
}

function getRepresentativeInfo(clazz: string) {
  const user = accounts.value?.find((u) => u.clazz === clazz && u.role === Role.ClassRep);
  const name = user?.name || '【查無姓名】';
  return { clazz, name };
}

function selectAllText(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  target.select();
}

async function copyJson() {
  try {
    await copyToClipboard(generatedJson.value);
    Notify.create({
      type: 'positive',
      message: '已複製到剪貼簿！',
      position: 'top',
      timeout: 2000,
    });
  } catch (e) {
    Notify.create({
      type: 'warning',
      message: '自動複製失敗，請手動選取文字並按 Ctrl+C 複製',
      position: 'top',
      timeout: 3000,
    });
  }
}

async function copyAndOpenPage() {
  try {
    await copyToClipboard(generatedJson.value);
    Notify.create({
      type: 'positive',
      message: '已複製！正在開啟填寫頁面...',
      position: 'top',
    });
  } catch (e) {
    Notify.create({
      type: 'warning',
      message: '無法自動複製，請手動複製後再前往',
      position: 'top',
      timeout: 3000,
    });
  }

  setTimeout(() => {
    window.open('https://law.cksc.tw/manage/document/from_template', '_blank');
    showJsonDialog.value = false;
  }, 500);
}

function getRocDate() {
  const currentYear = date.formatDate(new Date(), 'YYYY');
  const rocYear = parseInt(currentYear) - 1911;
  const datePart = date.formatDate(new Date(), 'M 月 D 日');
  return `中華民國 ${rocYear} 年 ${datePart}`;
}

function exportIndictment(records: SerialAbsenceRecord[]) {
  if (records.length !== 1) {
    notifyError('無法生成訴狀', '只能針對單一班級代表起草訴狀。請透過表格右側按鈕操作。');
    return;
  }

  const record = records[0]!;
  currentClazz.value = record.clazz;

  const repName = representativeName.value.trim();
  const repClazz = representativeClazz.value.trim();

  if (!repName || !repClazz) {
    notifyError('資料不完整', '請填寫紀律委員會召集委員的班級與姓名');
    return;
  }

  const repFull = `${repClazz}班代 ${repName}`;
  const today = getRocDate();

  Loading.show();
  try {
    const defendant = getRepresentativeInfo(record.clazz);
    const defendantList = `${defendant.clazz}班 班級代表 ${defendant.name}`;
    const subjectText = defendant.clazz;

    const lawArticle1 = '臺北市立建國高級中學班聯會班級代表行為法第7條第1項第十一款';
    const lawArticle2 = '臺北市立建國高級中學班聯會班級代表行為法第7條第2項第一款';

    const contentHTML = `
<p><strong>原告：</strong>臺北市立建國高級中學班聯會班代大會紀律委員會</p>
<p><strong>原告代表：</strong>紀律委員會召集委員 ${repFull}</p>
<p><strong>被告：</strong>${defendantList}</p>
<p><strong>附件：</strong>議長函</p>
<p><strong>起訴法條：</strong>${lawArticle2}</p>
<p><strong>根據(違反事項)：</strong>${lawArticle1}</p>
<div style="margin-top: 1em;">
  <p><strong>正文：</strong></p>
  ${record.clazz}班代連續缺席 ${record.count} 次班代大會會議，違反${lawArticle1}。
</div><br />
<div style="margin-top: 1em;">
    <p><strong>法律分析：</strong></p>
    <p>依${lawArticle2}，班代連續三次無故缺席班代大會之會議者，由議長裁示紀律委員會，並由紀律委員會向評議委員會職務法庭起訴，對班代予以停職或撤職。</p>
    <p>
        ${record.clazz}班代由於連續缺席 ${record.count} 次，故本委員會特此向評議委員會職務法庭提起對${record.clazz}班代之職務訴訟，聲請予以撤職處分。
    </p>
</div>
<div style="margin-top: 1em;">
    <p><strong>結論：</strong></p>
    <p>依${lawArticle2}，特此向評議委員會職務法庭提${record.clazz}班代之職務訴訟，聲請予以撤職處分。</p>
</div>

<div style="margin-top: 3em;">
    <p style="text-align: left;">此致</p>
    <p style="text-align: left;">臺北市立建國高級中學班聯會評議委員會 初等法庭 公鑒</p>
    <br />
    <p style="text-align: right;">紀律委員會召集委員 ${repFull}</p>
    <p style="text-align: right;">${today}</p>
</div>
`;

    const result = {
      type: 'CourtIndictment',
      fromSpecific: 'DisciplinaryCommittee',
      toSpecific: ['GeneralCourt'],
      ccSpecific: [],
      confidentiality: 'Public',
      meetingTime: Date.now(),
      subject: `${subjectText}班代職務訴訟起訴狀`,
      fromName: repName,
      fromClazz: repClazz,
      content: contentHTML,
    };

    generatedJson.value = JSON.stringify(result, null, 2);
    dialogTitle.value = `起草 ${subjectText}班 起訴書`;
    showJsonContent.value = true;

    Loading.hide();
    showJsonDialog.value = true;
  } catch (e) {
    Loading.hide();
    notifyError('起草訴狀失敗', e);
    console.error('生成起訴書時發生錯誤:', e);
  }
}

function exportSpeakerAdvisory(records: SerialAbsenceRecord[]) {
  const record = records[0]!;
  currentClazz.value = record.clazz;

  const repName = representativeName.value.trim();
  const repClazz = representativeClazz.value.trim();

  if (!repName || !repClazz) {
    notifyError('資料不完整', '請填寫紀律委員會召集委員的班級與姓名');
    return;
  }

  Loading.show();
  try {
    const defendant = getRepresentativeInfo(record.clazz);

    const contentHTML = `
<p>一、由於貴班之班級代表受職務訴訟，依據<link url="https://law.cksc.tw/legislation/SC006#8">臺北市立建國高級中學班聯會班級代表行為法第七條第5項</link>貴班應選舉一名代理班級代表。</p>
<p>二、根據臺北市立建國高級中學班聯會班級代表行為法第七條第5項，受職務訴訟之班級代表不得任代理班級代表，請貴班於選舉時留意。</p>
<p>三、選舉結束後，請將代理班級代表之聯絡資訊(姓名、電子郵件、Line ID、座號、學號)郵寄至班代大會之信箱 (cksc77th@gmail.com)，俾利後續作業進行。</p>
<p>四、倘若貴班於本會期結束前未選出代理班級代表，則視為貴班放棄於班代大會之代表席位與權利。</p>
`;

    const result = {
      type: 'Advisory',
      fromSpecific: 'Speaker',
      toSpecifive: 'Other',
      toOther: [`${record.clazz}班`],
      ccSpecific: ['DeputySpeaker', 'StudentCouncilSecretary', 'ExecutiveCommittee'],
      confidentiality: 'Public',
      subject: `請貴班選舉代理班級代表，並將代理班級代表聯絡資訊郵寄至本大會之電子郵件信箱`,
      fromName: repName,
      fromClazz: repClazz,
      content: contentHTML,
    };

    generatedJson.value = JSON.stringify(result, null, 2);
    dialogTitle.value = `起草 ${record.clazz}班 議長函`;
    showJsonContent.value = true;

    Loading.hide();
    showJsonDialog.value = true;
  } catch (e) {
    Loading.hide();
    notifyError('起草議長函失敗', e);
    console.error('生成議長函時發生錯誤:', e);
  }
}

getAllUsers()
  .then((users) => {
    accounts.value = users;
    watch(
      meetings,
      () => {
        updateAttendance();
      },
      { deep: true },
    );
    updateAttendance();
  })
  .catch((e) => notifyError('載入資料失敗', e));
</script>

<style scoped>
.json-textarea :deep(textarea) {
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
}
</style>
