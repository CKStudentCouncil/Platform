import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/accounts',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/mgmt/AccountsPage.vue') }],
  },
  {
    path: '/meetings',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: ':id?', component: () => import('pages/mgmt/MeetingsPage.vue') },
      {
        path: ':id?/proposals/:proposalId?',
        component: () => import('pages/mgmt/ProposalsPage.vue'),
      },
      {
        path: ':id?/proposals/:proposalId?/votables',
        component: () => import('pages/mgmt/VotablesPage.vue'),
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
    children: [{ path: ':passcode?', component: () => import('pages/PunchInPage.vue') }],
  },
  {
    path: '/attendee',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: ':id?', component: () => import('pages/AttendeePage.vue') }],
  },
  {
    path: '/tools',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/ToolsPage.vue') }],
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
