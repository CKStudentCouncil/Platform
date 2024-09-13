import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/accounts',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/mgmt/ManageAccountsPage.vue') }],
  },
  {
    path: '/meetings',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: ':id?', component: () => import('pages/mgmt/ManageMeetingsPage.vue') },
      {
        path: ':id?/proposals/:proposalId?',
        component: () => import('pages/mgmt/ManageProposalsPage.vue'),
      },
      {
        path: ':id?/proposals/:proposalId?/votables',
        component: () => import('pages/mgmt/ManageVotablesPage.vue'),
      },
    ],
  },
  {
    path: '/meeting_host',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/host/MeetingHostPage.vue') },
      { path: ':id', component: () => import('pages/host/MeetingPunchIn.vue') },
      {
        path: ':id/agenda',
        component: () => import('pages/host/MeetingAgenda.vue'),
      },
      {
        path: ':id/agenda/:proposalId',
        component: () => import('pages/host/MeetingProposal.vue'),
      },
      {
        path: ':id/agenda/:proposalId/vote/:voteId',
        component: () => import('pages/host/MeetingVote.vue'),
      },
    ],
  },
  {
    path: '/punch_in',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: ':passcode?', component: () => import('pages/attendee/PunchInPage.vue') }],
  },
  {
    path: '/attendee',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: ':id?', component: () => import('pages/attendee/AttendeePage.vue') }],
  },
  {
    path: '/tools',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/mgmt/ToolsPage.vue') }],
  },
  {
    path: '/schedule_absence',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: ':id?', component: () => import('pages/attendee/ScheduleAbsencePage.vue') }],
  },
  {
    path: '/attendance',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/mgmt/attendance/AttendancePage.vue') },
      { path: 'serial_absence', component: () => import('pages/mgmt/attendance/SerialAbsencePage.vue') },
      { path: 'scheduled_absence', component: () => import('pages/mgmt/attendance/SchedulesAbsencePage.vue') },
      { path: 'export', component: () => import('pages/mgmt/attendance/ExportAttendancePage.vue') },
    ],
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
  },
  {
    path: '/about',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/AboutPage.vue') }],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
