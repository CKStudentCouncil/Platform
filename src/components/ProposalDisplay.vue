<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">{{ proposal.title }}</div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="text-subtitle1">提案人：{{ proposal.proposer }}</div>
      <div>{{ proposal.content }}</div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="text-subtitle1">附件：</div>
      <q-list>
        <q-item
          v-for="attachment of proposal.attachments"
          :key="attachment"
          v-ripple
          :href="attachment"
          clickable
          target="_blank"
        >
          <q-item-section>{{ attachment }}</q-item-section>
          <q-item-section side>
            <q-icon name="visibility" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
    <q-separator />
    <q-card-actions v-if="editable">
      <q-btn color="positive" flat v-if="selectable" label="選擇並檢視投票案件" @click="$emit('select', proposal.id)" />
      <q-btn color="primary" flat label="編輯" @click="$emit('edit', proposal.id)" />
      <q-btn color="negative" flat label="刪除" @click="$emit('del', proposal.id)" />
    </q-card-actions>
    <q-card-actions v-if="endable">
      <q-btn color="negative" flat icon="stop" label="結束議案" @click="$emit('end', proposal.id)" />
    </q-card-actions>
  </q-card>
</template>

<script lang="ts" setup>
import { QBtn } from 'quasar';

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
  }
});

defineEmits<{
  select: [proposalId: string];
  edit: [proposalId: string];
  del: [proposalId: string];
  end: [proposalId: string];
}>();
</script>

<style scoped></style>
