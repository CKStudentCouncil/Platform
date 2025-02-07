<template>
  <q-layout view="hHh LpR fFf">
    <q-header class="bg-primary text-white" elevated height-hint="98">
      <q-toolbar>
        <q-btn dense flat icon="menu" round @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <img alt="favicon" src="icon.png" />
          </q-avatar>
          <span v-if="$q.screen.gt.xs" class="q-pl-sm">建國中學班代大會議事系統</span>
          <span v-else class="q-pl-sm">建中班代大會議事系統</span>
        </q-toolbar-title>

        <q-btn v-if="$q.screen.gt.xs" flat icon="fullscreen" @click="toggleFullscreen" />
        <q-btn v-if="!loggedInUser" align="right" dense flat icon="login" round @click="loginDialogOpen = true">登入</q-btn>
        <q-btn v-if="$q.screen.gt.xs && loggedInUser" align="right" dense flat icon="logout" round @click="logout()">登出</q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered show-if-above side="left" style="overflow: hidden">
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
        <div v-if="role >= Role.ViceChair" style="max-height: 30vh">
          <QRPasscode v-for="meeting of activeMeetings" :key="meeting!.name" :passcode="meeting!.punchInPasscode" :size="0.5" />
        </div>
        <q-space />
        <q-item v-if="!loggedInUser" clickable @click="loginDialogOpen = true">
          <q-item-section avatar>
            <q-icon name="login" />
          </q-item-section>

          <q-item-section>
            <q-item-label>登入</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="loggedInUser">
          <q-item-section v-if="loggedInUser.photoURL !== null" avatar>
            <q-avatar>
              <img :src="loggedInUser.photoURL" alt="profile picture" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ loggedInUser.displayName }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="loggedInUser" clickable @click="logout()">
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

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { init, loggedInUser, loggedInUserClaims, logout } from 'src/ts/auth';
import { rawMeetingCollection, Role } from 'src/ts/models.ts';
import { useCollection } from 'vuefire';
import LoginDialog from 'components/LoginDialog.vue';
import { query, where } from 'firebase/firestore';
import QRPasscode from 'components/QRPasscode.vue';

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
    name: '出席狀況管理',
    url: '/attendance',
    icon: 'trending_up',
    role: Role.Secretary,
  },
  {
    name: '會議管理',
    url: '/meetings',
    icon: 'groups',
    role: Role.Secretary,
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
  {
    name: '工具',
    url: '/tools',
    icon: 'construction',
    role: Role.Secretary,
  },
  {
    name: '關於',
    url: '/about',
    icon: 'info',
  },
];
let selected = ref('Account Information');
let loginDialogOpen = ref(false);
const role = computed(() => loggedInUserClaims.role);

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

const activeMeetings = useCollection(query(rawMeetingCollection(), where('active', '==', true)));
</script>
