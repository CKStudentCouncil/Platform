<template>
  <q-page padding>
    <q-table
      :columns="columns"
      :filter="filter"
      :filter-method="customFilter"
      :loading="loading"
      :rows="Object.values(accounts)"
      :sort-method="customSort"
      class="rounded-borders shadow-2"
      color="primary"
      row-key="email"
      title="帳號管理"
    >
      <template v-slot:top-right>
        <div class="row justify-end q-gutter-sm">
          <q-btn icon="add_to_photos" @click="bulkAddUser">批次新增帳號</q-btn>
          <q-btn icon="add" @click="add">新增單一帳號</q-btn>
          <q-input v-model="search" debounce="300" dense label="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </template>
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td key="name">
            {{ props.row.name }}
          </q-td>
          <q-td key="schoolNumber">
            {{ props.row.schoolNumber }}
          </q-td>
          <q-td key="clazz">
            {{ props.row.clazz }}
          </q-td>
          <q-td key="role">
            {{ translateRole(props.row.role) }}
          </q-td>
          <q-td key="email">
            {{ props.row.email }}
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
import { User } from 'src/ts/models.ts';
import { getAllUsers, translateRole } from '../../ts/auth.ts';
import { useFunction } from 'boot/vuefire.ts';
import { Dialog, Loading, Notify } from 'quasar';

const columns = [
  { name: 'name', label: '姓名', field: 'name', sortable: true, align: 'left' },
  {
    name: 'schoolNumber',
    label: '學號',
    field: 'schoolNumber',
    sortable: true,
    align: 'left',
  },
  {
    name: 'clazz',
    label: '班級',
    field: 'clazz',
    sortable: true,
    align: 'left',
  },
  { name: 'role', label: '身分', field: 'role', sortable: true, align: 'left' },
  {
    name: 'email',
    label: 'Email',
    field: 'email',
    sortable: true,
    align: 'left',
  },
] as {
  name: string;
  label: string;
  field: string;
  sortable: boolean;
  align: 'left';
}[]; // Typescript magic requirements
const roleOptions = [
  { label: '班代', value: 50 },
  { label: '秘書', value: 100 },
  { label: '副議長', value: 150 },
  { label: '議長', value: 200 },
  { label: '管理員', value: 999 },
];
let search = ref('');
let loading = ref(true);
let action = ref('');
let targetUser = reactive({} as User);
let accounts = reactive([] as User[]);
const filter = computed(() => {
  return {
    search: search,
  };
});
const dialog = computed(() => {
  return action.value === 'edit' || action.value === 'add';
});

function customFilter(rows: readonly any[]): readonly any[] {
  const lowerTerms = search.value.toLowerCase();
  return rows.filter((row: User) => {
    return (
      String(row.schoolNumber).toLowerCase() +
      String(row.clazz).toLowerCase() +
      String(row.name).toLowerCase() +
      String(row.email).toLowerCase() +
      translateRole(row.role).toLowerCase().toLowerCase()
    ).includes(lowerTerms);
  });
}

function customSort(rows: readonly any[], sortBy: string | undefined, descending: boolean) {
  const data = [...rows];
  if (sortBy) {
    data.sort((a, b) => {
      const x = descending ? b : a;
      const y = descending ? a : b;
      if (sortBy == 'name' || sortBy == 'email') {
        // string sort
        return x[sortBy] > y[sortBy] ? 1 : x[sortBy] < y[sortBy] ? -1 : 0;
      } else {
        // numeric sort
        return parseFloat(x[sortBy]) - parseFloat(y[sortBy]);
      }
    });
  }
  return data;
}

async function load() {
  loading.value = true;
  accounts.length = 0; // Typescript magic
  for (const acc of (await getAllUsers()) as User[]) {
    accounts.push(acc);
  }
  loading.value = false;
}

function edit(row: any) {
  action.value = 'edit';
  targetUser.name = row.name;
  targetUser.email = row.email;
  targetUser.schoolNumber = row.schoolNumber;
  targetUser.clazz = row.clazz;
  targetUser.role = row.role;
  targetUser.uid = row.uid;
}

function add() {
  action.value = 'add';
  targetUser.name = '';
  targetUser.email = '';
  targetUser.schoolNumber = '';
  targetUser.clazz = '';
  targetUser.role = 50;
  targetUser.uid = '';
}

function bulkAddUser() {
  Dialog.create({
    title: '批次新增帳號',
    message: '請依照CSV格式 (姓名,學號,班級,Email) 輸入，每行一筆資料，預設會將這些使用者的身分設為班代',
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
      const [name, schoolNumber, clazz, email] = line.split(',');
      if (name && schoolNumber && clazz && email) {
        users.push({
          name,
          schoolNumber,
          clazz,
          email,
          role: 50,
        });
      } else {
        Notify.create({
          message: '格式錯誤',
          color: 'negative',
        });
        return;
      }
    }
    try {
      await useFunction('bulkAddUser')(users);
    } catch (e) {
      console.error(e);
      Notify.create({
        message: '更新失敗',
        color: 'negative',
      });
    }
    await load();
    Notify.create({
      message: '帳號資料已更新',
      color: 'positive',
    });
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
        },
      });
    } else if (action.value === 'add') {
      await useFunction('addUser')(targetUser);
    }
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '更新失敗',
      color: 'negative',
    });
  }
  Loading.hide();
  action.value = '';
  await load();
  Notify.create({
    message: '帳號資料已更新',
    color: 'positive',
  });
}

async function del(row: any) {
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
      console.error(e);
      Notify.create({
        message: '刪除失敗',
        color: 'negative',
      });
      return;
    }
    Loading.hide();
    await load();
    Notify.create({
      message: '帳號資料已更新',
      color: 'positive',
    });
  });
}

load();
</script>

<style scoped></style>
