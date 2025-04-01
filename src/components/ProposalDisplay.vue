<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">{{ proposal.title }}</div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="text-subtitle1">提案人：{{ proposal.proposer }}</div>
      <div style="white-space: pre-wrap">{{ proposal.content }}</div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="text-subtitle1">附件：</div>
      <q-list>
        <q-item v-for="attachment of proposal.attachments" :key="attachment">
          <q-item-section style="overflow-wrap: anywhere">{{ attachment }}</q-item-section>
          <q-item-section side>
            <q-btn :dense="$q.screen.lt.sm" :href="attachment" flat icon="open_in_new" target="_blank">
              <q-tooltip>在新視窗開啟</q-tooltip>
            </q-btn>
          </q-item-section>
          <q-item-section side>
            <q-btn :dense="$q.screen.lt.sm" flat icon="visibility" @click="activeUrl = attachment">
              <q-tooltip>在網頁內預覽</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <q-separator />
    <q-card-actions v-if="editable">
      <q-btn v-if="selectable" color="positive" flat label="選擇並檢視投票案件" @click="$emit('select', proposal.id)" />
      <q-btn color="primary" flat label="編輯" @click="$emit('edit', proposal.id)" />
      <q-btn color="negative" flat label="刪除" @click="$emit('del', proposal.id)" />
    </q-card-actions>
    <q-card-actions v-if="endable">
      <q-btn color="negative" flat icon="stop" label="結束議案" @click="$emit('end', proposal.id)" />
    </q-card-actions>
  </q-card>
  <q-dialog :model-value="!!activeUrl" persistent>
    <q-card :style="$q.screen.lt.sm ? 'min-width: 100vw' : 'min-width: 60vw'">
      <q-card-section style="width: 100%">
        <q-btn
          class="q-mb-sm"
          color="negative"
          flat
          icon="close"
          style="float: right"
          @click="
            activeUrl = '';
            lastActiveUrl = '';
          "
        />
        <q-btn :href="activeUrl" flat icon="open_in_new" style="float: right" target="_blank" />
      </q-card-section>
      <q-card-section>
        <iframe :height="$q.screen.height - 200" :src="getGoogleFileEmbed(activeUrl)" allow="autoplay" class="no-print" width="100%" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { QBtn } from 'quasar';
import { ref } from 'vue';

defineProps({
  proposal: {
    type: Object,
    required: true,
  },
  editable: {
    type: Boolean,
    default: false,
  },
  endable: {
    type: Boolean,
    default: false,
  },
  selectable: {
    type: Boolean,
    default: true,
  },
});

defineEmits<{
  select: [proposalId: string];
  edit: [proposalId: string];
  del: [proposalId: string];
  end: [proposalId: string];
}>();

const activeUrl = ref('');
const lastActiveUrl = ref('');

function getGoogleFileEmbed(input: string) {
  let file_id = null;
  const driveCapture = input.match(/https:\/\/drive\.google\.com\/file\/d\/(.*)\/view.*/);
  if (driveCapture && driveCapture.length > 1) {
    file_id = driveCapture[1];
  }
  const documentCapture = input.match(/https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/(.*)\/edit.*/);
  if (documentCapture && documentCapture.length > 2) {
    file_id = documentCapture[2];
  }
  if (file_id) {
    return `https://drive.google.com/file/d/${file_id}/preview`;
  }
  return input;
}

function closeDialog() {
  lastActiveUrl.value = activeUrl.value;
  activeUrl.value = '';
}

function reopenDialog() {
  activeUrl.value = lastActiveUrl.value;
}

defineExpose({
  closeDialog,
  reopenDialog,
});
</script>

<style scoped></style>
