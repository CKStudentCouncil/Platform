<template>
  <q-dialog v-model="parentValue">
    <q-card>
      <q-card-section>
        <h5 class="q-ma-none">選擇登入方式</h5>
      </q-card-section>
      <q-card-section>
        <div class="content-center">
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
            @click="
              parentValue = false;
              simpleLoginDialogOpen = true;
            "
          >
            使用班級學號登入
          </q-btn>
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
        <q-input v-model="schoolNumber" label="學號" />
        <q-input v-model="clazz" label="班級" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn label="取消" @click="simpleLoginDialogOpen = false" />
        <q-btn color="primary" label="登入" @click="simpleLogin()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { login, loginWithCredentials } from 'src/ts/auth.ts';
import { computed, ref } from 'vue';

const emit = defineEmits(['update:modelValue']);
const props = defineProps(['modelValue']);
const parentValue = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emit('update:modelValue', val);
  },
});
const simpleLoginDialogOpen = ref(false);
const schoolNumber = ref('');
const clazz = ref('');

function simpleLogin() {
  loginWithCredentials(schoolNumber.value, clazz.value).then(() => {
    simpleLoginDialogOpen.value = false;
  });
}
</script>

<style scoped></style>
