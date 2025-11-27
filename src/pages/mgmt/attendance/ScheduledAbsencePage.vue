<template>
  <q-tabs>
    <q-route-tab label="檢視班代出席時數" to="/attendance" />
    <q-route-tab label="列出連續未出席者" to="/attendance/serial_absence" />
    <q-route-tab label="生成職務訴訟文書" to="/attendance/export_indictment" />
    <q-route-tab label="列出請假情況" to="/attendance/scheduled_absence" />
    <q-route-tab label="匯出期末時數與記功嘉獎表" to="/attendance/export" />
  </q-tabs>
  <div class="q-ma-md">
    <q-select v-model="filter" :options="meetingsOptions" label="選擇會議" />
    <q-table
      :columns="columns"
      :filter="filter"
      :loading="loading"
      :pagination="{ rowsPerPage: 25 }"
      :rows="absences"
      :title="`${currentReign} 班代請假情況`"
      row-key="name"
    >
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
import type { User } from 'src/ts/models.ts';
import { meetingCollectionOfCurrentReign } from 'src/ts/models.ts';
import { computed, ref, watch } from 'vue';
import type { QTableColumn } from 'quasar';
import { getAllUsers } from 'src/ts/auth.ts';
import { currentReign, notifyError } from 'src/ts/utils.ts';

const accounts = ref(null as User[] | null);
const meetings = meetingCollectionOfCurrentReign();
const meetingsOptions = computed(() => meetings.value.map((meeting) => meeting?.name));
const absences = ref([] as AbsenceInfo[]);
const loading = ref(true);

interface AbsenceInfo {
  meeting: string;
  clazz: string;
  name: string;
  scheduledAt: Date;
  reason: string;
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
  {
    name: 'reason',
    label: '原因',
    field: 'reason',
    align: 'left',
  },
] as QTableColumn[];

function updateAbsences() {
  if (!accounts.value) return;
  const toWrite = [] as AbsenceInfo[];
  for (const user of accounts.value) {
    if (!user.clazz) continue;
    for (const meeting of meetings.value) {
      if (meeting?.absences[user.clazz]) {
        const data = {
          meeting: meeting.name,
          clazz: user.clazz,
          name: user.name,
          scheduledAt: meeting.absences[user.clazz]!.scheduledAt,
          reason: meeting.absences[user.clazz]!.reason,
        };
        toWrite.push(data);
      }
    }
  }
  absences.value = toWrite;
}

getAllUsers()
  .then((users) => {
    accounts.value = users;
    watch(
      meetings,
      () => {
        updateAbsences();
      },
      { deep: true },
    );
    updateAbsences();
  })
  .catch((e) => notifyError('載入資料失敗', e))
  .finally(() => {
    loading.value = false;
  });
</script>

<style scoped></style>
