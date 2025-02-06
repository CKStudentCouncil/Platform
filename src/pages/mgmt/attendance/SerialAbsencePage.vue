<template>
  <q-page>
    <q-tabs>
      <q-route-tab label="檢視班代出席時數" to="/attendance" />
      <q-route-tab label="列出連續未出席者" to="/attendance/serial_absence" />
      <q-route-tab label="列出請假情況" to="/attendance/scheduled_absence" />
      <q-route-tab label="匯出期末時數與記功嘉獎表" to="/attendance/export" />
    </q-tabs>
    <div class="q-ma-md">
      <q-input v-model="requirement" label="連續缺席次數" type="number" />
      <p style="white-space: pre-line">
        {{ serial_absences }}
      </p>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { getAllUsers } from 'src/ts/auth.ts';
import { computed, reactive, ref, watch } from 'vue';
import { meetingCollectionOfCurrentReign, User } from 'src/ts/models.ts';

const accounts = ref(null as User[] | null);
const meetings = meetingCollectionOfCurrentReign();
const absence_map = reactive({} as Record<string, number>);
const requirement = ref(3);
const serial_absences = computed(() => {
  const r = Object.entries(absence_map)
    .filter(([_, v]) => v >= requirement.value)
    .sort((a, b) => b[1] - a[1]);
  let a = '';
  for (const [k, v] of r) {
    a += `${k} 連續缺席 ${v}次\n`;
  }
  return a;
});

async function updateAttendance() {
  if (!accounts.value) return;
  const participants = [] as string[][];
  const scheduledAbsences = [] as string[][];
  for (const meeting of meetings.value) {
    if (!meeting) continue;
    participants.push(meeting.participants);
    scheduledAbsences.push(Object.keys(meeting.absences));
  }
  participants.reverse();
  scheduledAbsences.reverse(); // Default sorting order is latest first, so we need to reverse it
  for (const user of accounts.value!) {
    if (!user.clazz) continue;
    absence_map[user.clazz] = 0;
    for (const i in participants) {
      if (!participants[i].includes(user.clazz) && !scheduledAbsences[i].includes(user.clazz)) {
        absence_map[user.clazz]++;
      } else {
        absence_map[user.clazz] = 0;
      }
    }
  }
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
