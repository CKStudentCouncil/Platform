<template>
  <q-dialog v-model="parentValue">
    <q-card>
      <q-card-section>
        <h5 class="q-ma-none">選擇登入方式</h5>
      </q-card-section>
      <q-card-section>
        <div v-if="register">
          <q-btn
            color="primary"
            icon="person_add"
            label="註冊"
            @click="
              parentValue = false;
              registerDialogOpen = true;
            "
          >
          </q-btn>
        </div>
        <div v-else class="content-center">
          <q-btn
            class="q-mr-md"
            color="primary"
            @click="
              login();
              parentValue = false;
            "
          >
            <svg class="Bz112c Bz112c-E3DyYd" style="width: 16px; height: 16px; margin-right: 8px" viewBox="0 0 48 48">
              <path
                d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
                data-darkreader-inline-fill=""
                fill="#4285F4"
                style="--darkreader-inline-fill: #4ba0f4"
              ></path>
              <path
                d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
                data-darkreader-inline-fill=""
                fill="#34A853"
                style="--darkreader-inline-fill: #62cf7f"
              ></path>
              <path
                d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
                data-darkreader-inline-fill=""
                fill="#FBBC05"
                style="--darkreader-inline-fill: #fbc31e"
              ></path>
              <path
                d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
                data-darkreader-inline-fill=""
                fill="#EA4335"
                style="--darkreader-inline-fill: #eb5043"
              ></path>
              <path d="M2 2h44v44H2z" fill="none"></path>
            </svg>
            使用學校 Google 帳號登入
          </q-btn>
          <q-btn
            icon="person"
            label="使用班級學號登入"
            @click="
              parentValue = false;
              simpleLoginDialogOpen = true;
            "
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
  <q-dialog v-model="simpleLoginDialogOpen">
    <q-card @keyup.enter="simpleLogin">
      <q-card-section>
        <h5 class="q-ma-none">使用班級學號登入</h5>
      </q-card-section>
      <q-card-section>
        <q-input lazy-rules v-model="schoolNumber" ref="schoolNumberRef" label="學號" type="number" :rules="schoolNumberRule" />
        <q-input lazy-rules v-model="clazz" ref="clazzRef" label="班級" type="number" :rules="clazzRule" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="simpleLoginDialogOpen = false" />
        <q-btn color="primary" flat label="登入" @click="simpleLogin()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="registerDialogOpen">
    <q-card @keyup.enter="submitRegistration">
      <q-card-section>
        <h5 class="q-ma-none">註冊</h5>
      </q-card-section>
      <q-card-section>
        <q-input lazy-rules v-model="schoolNumber" ref="schoolNumberRef" label="學號 (八碼)" type="number" :rules="schoolNumberRule" />
        <q-input lazy-rules v-model="clazz" ref="clazzRef" label="班級 (例：101)" type="number" :rules="clazzRule"/>
        <q-input lazy-rules v-model="seatNumber" ref="seatNumberRef" label="座號 (例：7)" type="number" :rules="seatNumberRule"/>
        <q-input lazy-rules v-model="name" ref="nameRef" label="姓名" :rules="[required]"/>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="registerDialogOpen = false" />
        <q-btn color="primary" flat label="註冊" @click="submitRegistration()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { login, loginWithCredentials } from 'src/ts/auth.ts';
import { computed, ref } from 'vue';
import { useFunction } from 'boot/vuefire.ts';
import { notifyError, schoolEmailFromSchoolNumber } from 'src/ts/utils.ts';
import { Loading } from 'quasar';

const emit = defineEmits(['update:modelValue']);
const props = defineProps({
  modelValue: Boolean,
  register: Boolean,
});
const parentValue = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emit('update:modelValue', val);
  },
});
const simpleLoginDialogOpen = ref(false);
const registerDialogOpen = ref(false);
const clazz = ref('');
const schoolNumber = ref('');
const seatNumber = ref('');
const name = ref('');
const clazzRef = ref();
const schoolNumberRef = ref();
const seatNumberRef = ref();
const nameRef = ref();
const required = (v: string) => !!v || '此欄必填';
const clazzRule = [required, (v: string) => /^[1-3][0-2][0-9]$/.test(v) || '請輸入正確的班級號碼'];
const schoolNumberRule = [required, (v: string) => /^[0-9]{8}$/.test(v) || '請輸入正確的學號'];
const seatNumberRule = [required, (v: string) => /^[1-9]?[0-9]$/.test(v) || '請輸入正確的座號 (個位數免加0)'];

function simpleLogin() {
  clazzRef.value.validate();
  schoolNumberRef.value.validate();
  if (clazzRef.value.hasError || schoolNumberRef.value.hasError) {
    return;
  }
  void loginWithCredentials(schoolNumber.value, clazz.value).then(() => {
    simpleLoginDialogOpen.value = false;
  });
}

async function submitRegistration() {
  clazzRef.value.validate();
  schoolNumberRef.value.validate();
  seatNumberRef.value.validate();
  nameRef.value.validate();
  if (clazzRef.value.hasError || schoolNumberRef.value.hasError || seatNumberRef.value.hasError || nameRef.value.hasError) {
    return;
  }
  Loading.show({ message: '註冊中' });
  try {
    await useFunction('register')({
      clazz: clazz.value,
      schoolNumber: schoolNumber.value,
      seatNumber: seatNumber.value,
      name: name.value,
      email: schoolEmailFromSchoolNumber(schoolNumber.value),
    });
    registerDialogOpen.value = false;
    simpleLogin();
  } catch (e) {
    notifyError('註冊失敗', e);
  }
  Loading.hide();
}
</script>

<style scoped></style>
