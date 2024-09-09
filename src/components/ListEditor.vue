<template>
  <q-btn class="q-mb-md" color="primary" label="新增項目" @click="addItem" />
  <q-list bordered>
    <VueDraggable v-model="parentValue" style="cursor: move">
      <q-item v-for="(item, index) in parentValue" :key="item" class="q-mb-sm">
        <q-item-section>
          {{ item }}
        </q-item-section>
        <q-item-section side>
          <q-btn color="negative" icon="delete" @click="removeItem(index)" />
        </q-item-section>
      </q-item>
    </VueDraggable>
  </q-list>
</template>

<script lang="ts" setup>
import { Dialog, QBtn, QItem, QItemSection, QList } from 'quasar';
import { VueDraggable } from 'vue-draggable-plus';
import { computed } from 'vue';

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

function addItem() {
  Dialog.create({
    title: '新增項目',
    prompt: {
      model: '',
      label: '名稱',
    },
    persistent: true,
    ok: true,
    cancel: true,
  }).onOk((data) => {
    parentValue.value.push(data);
  });
}

function removeItem(index: number) {
  parentValue.value.splice(index, 1);
}
</script>

<style scoped></style>
