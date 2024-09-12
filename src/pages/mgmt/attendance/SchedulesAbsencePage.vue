<template>
  <q-tabs>
    <q-route-tab label="檢視班代出席時數" to="/attendance" />
    <q-route-tab label="列出連續未出席者" to="/attendance/serial_absence" />
    <q-route-tab label="列出請假情況" to="/attendance/scheduled_absence" />
    <q-route-tab label="匯出期末時數與記功嘉獎表" to="/attendance/export" />
  </q-tabs>
  <div class="q-ma-md">
    <q-select v-model="filter" :options="meetingsOptions" label="選擇會議" />
    <q-table :columns="columns" :filter="filter" :rows="absences" :title="`${currentReign} 班代出席時數`" row-key="name">
      <template v-slot:top-right>
        <q-input v-model="filter" debounce="300" dense placeholder="搜尋">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
      </template>
    </q-table>
  </div>
</template>

<script lang="ts" setup>
import { currentReign, currentReignMeetingCollection, User } from 'src/ts/models.ts';
import { computed, ref, watch } from 'vue';
import { QTableColumn } from 'quasar';
import { getAllUsers } from 'src/ts/auth.ts';

const accounts = ref(null as User[] | null);
const meetings = currentReignMeetingCollection();
const meetingsOptions = computed(() => meetings.value.map((meeting) => meeting?.name));
const absences = ref([] as AbsenceInfo[]);

interface AbsenceInfo {
  meeting: string;
  clazz: string;
  name: string;
  scheduledAt: Date;
}

const filter = ref('');
const columns = [
  { name: 'meeting', label: '會議', field: 'meeting', sortable: true, align: 'left' },
  {
    name: 'clazz',
    label: '班級',
    field: 'clazz',
    sortable: true,
    align: 'left',
  },
  {
    name: 'name',
    label: '姓名',
    field: 'name',
    sortable: true,
    align: 'left',
  },
  {
    name: 'scheduledAt',
    label: '請假時間',
    field: 'scheduledAt',
    format: (value: Date) => value.toLocaleString(),
    sortable: true,
    align: 'left',
  },
] as QTableColumn[];

async function updateAbsences() {
  if (!accounts.value) return;
  absences.value = [];
  for (const user of accounts.value) {
    if (!user.clazz) return;
    for (const meeting of meetings.value) {
      if (!meeting) continue;
      if (meeting.absences[user.clazz]) {
        absences.value.push({
          meeting: meeting.name,
          clazz: user.clazz,
          name: user.name,
          scheduledAt: meeting.absences[user.clazz].scheduledAt,
        });
      }
    }
  }
}

getAllUsers().then((users) => {
  accounts.value = users;
  watch(
    meetings,
    () => {
      updateAbsences();
    },
    { deep: true },
  );
  updateAbsences();
});
</script>

<style scoped></style>
