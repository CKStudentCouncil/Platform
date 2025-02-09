<template>
  <q-tabs v-model="tab">
    <q-tab label="班級轉換" name="classTransformation" />
  </q-tabs>
  <q-page padding>
    <q-tab-panels v-model="tab">
      <q-tab-panel name="classTransformation">
        <q-select v-model="from" :option-label="(o) => o.label" :options="choices" label="轉換自" />
        <q-select v-model="to" :option-label="(o) => o.label" :options="choices" label="轉換成" />
        <q-btn color="primary" label="轉換" @click="transform()" />
        <q-input v-model="input" label="輸入班級，每行一個" style="min-height: 80vh" type="textarea" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { getAllUsers } from 'src/ts/auth.ts';
import { Loading } from 'quasar';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

const input = ref('');
const tab = ref('classTransformation');
const choices = ref([
  { label: '班級', value: 'clazz' },
  { label: '姓名', value: 'name' },
  { label: 'Email', value: 'email' },
  { label: '學號', value: 'schoolNumber' },
  { label: '座號', value: 'seatNumber' },
]);
const from = ref(choices.value[0]);
const to = ref(choices.value[1]);
const accounts = [] as any[];
Loading.show({ message: '載入資料中' });
getAllUsers()
  .then((users) => {
    accounts.push(...(users as any[]));
    notifySuccess('資料載入完成');
  })
  .catch((e) => {
    notifyError('資料載入失敗', e);
  })
  .finally(() => {
    Loading.hide();
  });

async function transform() {
  const lines = input.value.split('\n');
  const result = lines.map((clazz) => {
    try {
      const users = (accounts as any[]).filter((user) => user[from.value.value] == clazz);
      return users[0][to.value.value];
    } catch (e) {
      console.error(e);
      return '!!!!錯誤';
    }
  });
  input.value = result.join('\n');
}
</script>

<style scoped></style>
