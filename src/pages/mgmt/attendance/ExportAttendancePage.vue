<template>
  <q-tabs>
    <q-route-tab label="檢視班代出席時數" to="/attendance" />
    <q-route-tab label="列出連續未出席者" to="/attendance/serial_absence" />
    <q-route-tab label="列出請假情況" to="/attendance/scheduled_absence" />
    <q-route-tab label="匯出期末時數與記功嘉獎表" to="/attendance/export" />
  </q-tabs>
  <div class="q-ma-md">
    <q-btn color="primary" label="匯出" @click="exp()"></q-btn>
  </div>
</template>

<script lang="ts" setup>
import { getAllUsers } from 'src/ts/auth.ts';
import { rawMeetingsOfCurrentReignQuery } from 'src/ts/models.ts';
import ExcelJS from 'exceljs';
import { exportFile, Loading } from 'quasar';
import { getDocs } from 'firebase/firestore';
import {cleanseName, notifyError} from 'src/ts/utils.ts';

async function exp() {
  Loading.show();
  const accounts = await getAllUsers();
  const meetings = (await getDocs(rawMeetingsOfCurrentReignQuery())).docs;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('出席情況');
  sheet.columns = [
    { header: '姓名', key: 'name' },
    { header: '班級', key: 'clazz' },
    { header: '座號', key: 'seatNumber' },
    { header: '學號', key: 'schoolNumber' },
    { header: '服務時數', key: 'serviceHours' },
    { header: '出席率', key: 'attendanceRate', style: { numFmt: '0.00%' } },
    { header: '記功嘉獎', key: 'awardType' },
  ];
  for (const account of accounts) {
    try {
      if (!account.clazz) continue;
      let serviceHours = 0;
      for (const meeting of meetings) {
        if (!meeting) continue;
        if (meeting.data()?.participants.includes(account.clazz)) {
          serviceHours++;
        }
      }
      const attRate = serviceHours / meetings.length;
      let awardType;
      if (attRate == 1) {
        awardType = '小功乙支';
      } else if (attRate >= 0.8 && !account.clazz.startsWith('3')) {
        awardType = '嘉獎兩支';
      } else if (attRate >= 0.7 && account.clazz.startsWith('3')) {
        awardType = '嘉獎兩支';
      } else if (attRate >= 0.6 && !account.clazz.startsWith('3')) {
        awardType = '嘉獎乙支';
      } else if (attRate >= 0.5 && account.clazz.startsWith('3')) {
        awardType = '嘉獎乙支';
      } else {
        awardType = '';
      }
      sheet.addRow({
        name: cleanseName(account.name),
        clazz: account.clazz,
        seatNumber: account.seatNumber,
        schoolNumber: account.schoolNumber,
        serviceHours,
        attendanceRate: attRate,
        awardType,
      });
    } catch (e) {
      notifyError('匯出中途出現錯誤，可能會有若干筆資料遺失', e);
    }
  }
  sheet.autoFilter = 'A1:G1';
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (exportFile('出席情況.xlsx', blob) != true) {
    notifyError('匯出失敗');
  }
  Loading.hide();
}
</script>

<style scoped></style>
