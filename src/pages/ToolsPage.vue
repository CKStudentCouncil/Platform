<template>
  <q-tabs v-model="tab">
    <q-tab label="班級轉換" name="classTransformation" />
  </q-tabs>
  <q-page padding>
    <q-tab-panels v-model="tab">
      <q-tab-panel name="classTransformation">
        <q-select v-model="choice" :option-label="(o) => o.label" :options="choices" label="轉換成" />
        <q-btn color="primary" label="轉換" @click="transform()" />
        <q-input v-model="input" label="輸入班級，每行一個" style="min-height: 80vh" type="textarea" />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { getAllUsers } from 'src/ts/auth.ts';
import { Notify } from 'quasar';

const input = ref('');
const tab = ref('classTransformation');
const choices = ref([
  { label: '姓名', value: 'name' },
  { label: 'Email', value: 'email' },
  { label: '學號', value: 'schoolNumber' },
]);
const choice = ref(choices.value[0]);
const accounts = [] as any[];
getAllUsers().then((users) => {
  accounts.push(...(users as any[]));
  Notify.create({ message: '資料載入完成', color: 'positive' });
});

async function transform() {
  const lines = input.value.split('\n');
  const result = lines.map((clazz) => {
    try {
      const users = (accounts as any[]).filter((user) => user.clazz == clazz);
      return users[0][choice.value.value];
    } catch (e) {
      console.error(e);
      return '!!!!錯誤';
    }
  });
  input.value = result.join('\n');
}
</script>

<style scoped></style>
