<template>
  <q-page padding>
    <q-table
      :columns="columns"
      :filter="filter"
      :loading="loading"
      :rows="Object.values(accounts)"
      class="rounded-borders shadow-2"
      color="primary"
      row-key="email"
      title="帳號管理"
    >
      <template v-slot:top-right>
        <div class="row justify-end q-gutter-sm">
          <q-btn icon="add_to_photos" @click="bulkAddUser">批次新增帳號</q-btn>
          <q-btn color="negative" icon="delete" @click="bulkRemoveUser">批次刪除帳號</q-btn>
          <q-btn icon="add" @click="add">新增單一帳號</q-btn>
          <q-input v-model="filter" debounce="300" dense label="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </template>
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td v-for="col in props.cols" :key="col.name" :props="props">
            {{ col.value }}
          </q-td>
          <q-td key="actions" style="text-align: right">
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
  <q-dialog v-model="dialog">
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">編輯帳號</h6>
      </q-card-section>
      <q-card-section>
        <q-input v-model="targetUser.name" :disable="action == 'edit'" :readonly="action == 'edit'" label="姓名" />
        <q-input v-model="targetUser.email" :disable="action == 'edit'" :readonly="action == 'edit'" label="Email" />
        <q-input v-model="targetUser.schoolNumber" label="學號" />
        <q-input v-model="targetUser.clazz" label="班級" />
        <q-input v-model="targetUser.seatNumber" label="座號" />
        <q-select v-model="targetUser.role" :options="roleOptions" emit-value label="身分" />
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
import type { User } from 'src/ts/models.ts';
import { getAllUsers, rootUID, translateRole } from '../../ts/auth.ts';
import { useFunction } from 'boot/vuefire.ts';
import type { QTableColumn } from 'quasar';
import { Dialog, Loading } from 'quasar';
import { useCurrentUser } from 'vuefire';
import { notifyError, notifySuccess, schoolEmailFromSchoolNumber } from 'src/ts/utils.ts';

const columns = [
  { name: 'name', label: '姓名', field: 'name', sortable: true, align: 'left' },
  { name: 'schoolNumber', label: '學號', field: 'schoolNumber', sortable: true, align: 'left' },
  { name: 'clazz', label: '班級', field: 'clazz', sortable: true, align: 'left' },
  { name: 'seatNumber', label: '座號', field: 'seatNumber', sortable: true, align: 'left' },
  {
    name: 'role',
    label: '身分',
    field: (row) => translateRole(row.role).toLowerCase(),
    sort: (a, b, rowA, rowB) => rowA.role - rowB.role,
    sortable: true,
    align: 'left',
  },
  { name: 'email', label: 'Email', field: 'email', sortable: true, align: 'left' },
] as QTableColumn[];
const roleOptions = [
  { label: '班代', value: 50 },
  { label: '秘書', value: 100 },
  { label: '副議長', value: 150 },
  { label: '議長', value: 200 },
  { label: '管理員', value: 999 },
];
const loading = ref(true);
const action = ref('');
const targetUser = reactive({} as User);
const accounts = reactive([] as User[]);
const filter = ref('');
const dialog = computed(() => {
  return action.value === 'edit' || action.value === 'add';
});

async function load() {
  loading.value = true;
  accounts.length = 0; // Typescript magic
  for (const acc of (await getAllUsers())) {
    accounts.push(acc);
  }
  loading.value = false;
}

function edit(row: any) {
  action.value = 'edit';
  targetUser.name = row.name;
  targetUser.email = row.email;
  targetUser.schoolNumber = row.schoolNumber;
  targetUser.seatNumber = row.seatNumber;
  targetUser.clazz = row.clazz;
  targetUser.role = row.role;
  targetUser.uid = row.uid;
}

function add() {
  action.value = 'add';
  targetUser.name = '';
  targetUser.email = '';
  targetUser.schoolNumber = '';
  targetUser.seatNumber = '';
  targetUser.clazz = '';
  targetUser.role = 50;
  targetUser.uid = '';
}

function bulkAddUser() {
  Dialog.create({
    title: '批次新增帳號',
    message: '請依照CSV格式 (班級,座號,學號,姓名) 輸入，每行一筆資料，預設會將這些使用者的身分設為班代，Email為學校Google帳號',
    prompt: {
      model: '',
      type: 'textarea',
    },
    cancel: true,
    persistent: true,
  }).onOk(async (data: any) => {
    const lines = data.split('\n');
    const users = [];
    for (const line of lines) {
      const [clazz, seatNumber, schoolNumber, name] = line.split(',');
      if (name && schoolNumber && clazz && seatNumber) {
        users.push({
          clazz,
          seatNumber,
          schoolNumber,
          name,
          email: schoolEmailFromSchoolNumber(schoolNumber),
          role: 50,
        });
      } else {
        notifyError('格式錯誤');
        return;
      }
    }
    try {
      await useFunction('bulkAddUser')(users);
    } catch (e) {
      notifyError('新增失敗');
    }
    await load();
    notifySuccess('帳號已批次新增');
  });
}

function bulkRemoveUser() {
  Dialog.create({
    title: '批次刪除帳號',
    message: '請勾選要刪除的帳號，預設全選除了目前登入之帳號',
    options: {
      type: 'checkbox',
      model: accounts.map((a) => a.uid).filter((uid) => uid !== useCurrentUser().value?.uid && uid !== rootUID),
      items: accounts.map((a) => ({ label: a.name, value: a.uid, disable: a.uid === rootUID })),
    },
    cancel: true,
    persistent: true,
  }).onOk(async (data: any) => {
    try {
      await useFunction('bulkRemoveUser')({ users: data });
    } catch (e) {
      notifyError('刪除失敗', e);
    }
    await load();
    notifySuccess('帳號已批次刪除');
  });
}

async function submit() {
  Loading.show();
  try {
    if (action.value === 'edit') {
      await useFunction('editUser')({
        uid: targetUser.uid,
        claims: {
          role: targetUser.role,
          schoolNumber: targetUser.schoolNumber,
          clazz: targetUser.clazz,
          seatNumber: targetUser.seatNumber,
        },
      });
    } else if (action.value === 'add') {
      targetUser.email = targetUser.email.trim();
      await useFunction('addUser')(targetUser);
    }
  } catch (e) {
    notifyError('新增失敗', e);
  }
  Loading.hide();
  action.value = '';
  await load();
  notifySuccess('成功新增帳號');
}

function del(row: any) {
  Dialog.create({
    title: '刪除帳號',
    message: '確定要刪除此帳號嗎？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    Loading.show();
    try {
      await useFunction('deleteUser')({ uid: row.uid });
    } catch (e) {
      notifyError('刪除失敗', e);
      return;
    }
    Loading.hide();
    await load();
    notifySuccess('成功刪除帳號');
  });
}

void load();
</script>

<style scoped></style>
