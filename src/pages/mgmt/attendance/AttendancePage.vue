<template>
  <q-page>
    <q-tabs>
      <q-route-tab label="檢視班代出席時數" to="/attendance" />
      <q-route-tab label="列出連續未出席者" to="/attendance/serial_absence" />
      <q-route-tab label="列出請假情況" to="/attendance/scheduled_absence" />
      <q-route-tab label="匯出期末時數與記功嘉獎表" to="/attendance/export" />
    </q-tabs>
    <div class="q-ma-md">
      <q-table :columns="columns" :filter="filter" :rows="attendance" :title="`${currentReign} 班代出席時數`" row-key="name">
        <template v-slot:top-right>
          <q-input v-model="filter" debounce="300" dense placeholder="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>
      </q-table>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { getAllUsers } from 'src/ts/auth.ts';
import { currentReign, currentReignMeetingCollection, User } from 'src/ts/models.ts';
import { ref, watch } from 'vue';
import { QTableColumn } from 'quasar';

const accounts = ref(null as User[] | null);
const meetings = currentReignMeetingCollection();
const attendance = ref([] as AttendanceInfo[]);
const filter = ref('');
const columns = [
  { name: 'name', label: '姓名', field: 'name', sortable: true, align: 'left' },
  {
    name: 'clazz',
    label: '班級',
    field: 'clazz',
    sortable: true,
    align: 'left',
  },
  {
    name: 'attendedMeetings',
    label: '出席次數',
    field: 'attendedMeetings',
    sortable: true,
    align: 'left',
  },
  {
    name: 'scheduledAbsence',
    label: '請假次數',
    field: 'scheduledAbsence',
    sortable: true,
    align: 'left',
  },
  {
    name: 'unscheduledAbsence',
    label: '缺席次數',
    field: 'unscheduledAbsence',
    sortable: true,
    align: 'left',
  },
  {
    name: 'attendanceRate',
    label: '出席率',
    field: 'attendanceRate',
    format: (value: number) => (value * 100).toFixed(2) + '%',
    sortable: true,
    align: 'left',
  },
] as QTableColumn[];

interface AttendanceInfo {
  name: string;
  clazz: string;
  attendedMeetings: number;
  scheduledAbsence: number;
  unscheduledAbsence: number;
  attendanceRate: number;
}

async function updateAttendance() {
  if (!accounts.value) return;
  attendance.value.length = 0;
  const tempAttendance = {} as Record<string, AttendanceInfo>;
  for (const user of accounts.value!) {
    if (!user.clazz) continue;
    tempAttendance[user.clazz] = {
      name: user.name,
      clazz: user.clazz,
      attendedMeetings: 0,
      scheduledAbsence: 0,
      unscheduledAbsence: -1,
      attendanceRate: 0,
    };
  }
  let meetingsCount = 0;
  for (const meeting of meetings.value) {
    if (!meeting) continue;
    for (const clazz of meeting.participants) {
      if (!tempAttendance[clazz]) continue;
      tempAttendance[clazz].attendedMeetings++;
    }
    for (const clazz in meeting.absences) {
      if (!tempAttendance[clazz] || meeting.participants.includes(clazz)) continue;
      if (meeting.absences[clazz].scheduledAt) {
        tempAttendance[clazz].scheduledAbsence++;
      } else {
        tempAttendance[clazz].unscheduledAbsence++;
      }
    }
    meetingsCount++;
  }
  for (const clazz in tempAttendance) {
    tempAttendance[clazz].attendanceRate = tempAttendance[clazz].attendedMeetings / meetingsCount;
    tempAttendance[clazz].unscheduledAbsence = meetingsCount - tempAttendance[clazz].attendedMeetings - tempAttendance[clazz].scheduledAbsence;
  }
  attendance.value = Object.values(tempAttendance);
}

getAllUsers().then((users) => {
  accounts.value = users;
  watch(
    meetings,
    () => {
      updateAttendance();
    },
    { deep: true },
  );
  updateAttendance();
});
</script>

<style scoped></style>
