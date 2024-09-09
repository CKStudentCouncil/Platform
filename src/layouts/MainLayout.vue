<template>
  <q-layout view="hHh lpR fFf">
    <q-header class="bg-primary text-white" elevated height-hint="98">
      <q-toolbar>
        <q-btn dense flat icon="menu" round @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <img alt="favicon" src="icon.png" />
          </q-avatar>
          建國中學班代大會議事系統
        </q-toolbar-title>

        <q-btn flat icon="fullscreen" @click="toggleFullscreen" />
        <q-btn
          v-if="!loggedIn"
          align="right"
          dense
          flat
          icon="login"
          round
          @click="loginDialogOpen = true"
          >登入
        </q-btn>
        <q-btn
          v-if="loggedIn"
          align="right"
          dense
          flat
          icon="logout"
          round
          @click="logout()"
          >登出
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered show-if-above side="left">
      <q-list class="menu-list fit column">
        <div v-for="endpoint of endpoints" :key="endpoint.name">
          <q-item
            v-if="endpoint.role == undefined || role >= endpoint.role.valueOf()"
            v-ripple
            :active="selected === endpoint.name"
            :to="endpoint.url"
            @click="changeSelected(endpoint.name)"
          >
            <q-item-section avatar>
              <q-icon :name="endpoint.icon" />
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ endpoint.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </div>
        <q-space />

        <q-item v-if="!loggedIn" clickable @click="loginDialogOpen = true">
          <q-item-section avatar>
            <q-icon name="login" />
          </q-item-section>

          <q-item-section>
            <q-item-label>登入</q-item-label>
          </q-item-section>
        </q-item>
        <q-item
          v-if="loggedIn && loggedInUser !== null && loggedInUser !== undefined"
        >
          <q-item-section v-if="loggedInUser.photoURL !== null" avatar>
            <q-avatar>
              <img :src="loggedInUser.photoURL" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ loggedInUser.displayName }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="loggedIn" clickable @click="logout()">
          <q-item-section avatar>
            <q-icon name="logout" />
          </q-item-section>

          <q-item-section>
            <q-item-label>登出</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
      <LoginDialog v-model="loginDialogOpen" />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  getUserClaims,
  init,
  isLoggedIn,
  logout,
  updateCustomClaims,
} from 'src/ts/auth';
import { Role } from 'src/ts/models.ts';
import { useCurrentUser } from 'vuefire';
import LoginDialog from 'components/LoginDialog.vue';

init();
let leftDrawerOpen = ref(false);
let endpoints = [
  {
    name: '帳號管理',
    url: '/accounts',
    icon: 'badge',
    role: Role.Chair,
  },
  {
    name: '會議管理',
    url: '/meetings',
    icon: 'groups',
    role: Role.Secre,
  },
  {
    name: '主持會議',
    url: '/meeting_host',
    icon: 'forum',
    role: Role.ViceChair,
  },
  {
    name: '加入會議',
    url: '/punch_in',
    icon: 'chat',
  },
];
let selected = ref('Account Information');
let loginDialogOpen = ref(false);
const loggedIn = computed(() => isLoggedIn());
const loggedInUser = useCurrentUser();
const role = ref(0);
watch(
  loggedInUser,
  async (user) => {
    if (user) {
      await updateCustomClaims();
      role.value = getUserClaims().role;
    } else {
      role.value = 0;
    }
  },
  { deep: true },
);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function changeSelected(name: string) {
  selected.value = name;
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
}
</script>
