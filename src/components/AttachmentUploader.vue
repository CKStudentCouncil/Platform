<template>
  <div class="q-gutter-md row items-start">
    <q-file v-model="files" filled label="選擇檔案 (或拖至此，可多選)" multiple style="max-width: 300px" :error="error" error-message="請按下上傳按鈕再繼續！" @input="check">
      <template v-slot:prepend>
        <q-icon name="attach_file" />
      </template>
    </q-file>
    <q-btn class="row" color="primary" dense @click="upload" no-caps :disable="uploading">
      <div><q-icon name="cloud_upload" /><br>上傳並加入附件</div>
    </q-btn>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue';
import { useFunction } from 'boot/vuefire.ts';
import { Loading } from 'quasar';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import { MAX_ATTACHMENT_BYTES } from '../../shared/constants';

const files = ref<File[]>([]);
const emits = defineEmits<{
  uploaded: [urls: string[]];
}>();
const props = defineProps({
  filenamePrefix: {
    type: String,
    required: false,
    default: '',
  },
});
const error = ref(false);
const uploading = ref(false);
// Resolved during setup: the callable is used from async callbacks, where the
// component's injection context is no longer available.
const uploadAttachment = useFunction('uploadAttachment');
const megabyteLimit = Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024);

/**
 * The picked file cannot be uploaded and no code change would help — it is too
 * large, empty, or the browser could not read it. Reported like the
 * `report: false` auth codes: the user is told, Sentry gets a breadcrumb rather
 * than an issue.
 */
class UnusableFileError extends Error {}

/**
 * What the user is told. Our own rejections already name the file and the
 * reason; a raw callable failure carries a server-side English message that
 * belongs in Sentry, not in a toast, so it falls back to the generic wording.
 */
function describeUploadFailure(file: File, error: unknown): string {
  return error instanceof UnusableFileError ? error.message : `「${file.name}」上傳失敗`;
}

function shouldReportUploadError(error: unknown): boolean {
  if (error instanceof UnusableFileError) return false;
  // The server rejecting the file as invalid is the same class of problem,
  // decided one layer down. Anything else — internal, unauthenticated, a
  // missing url — is ours to fix.
  return (error as { code?: string } | null)?.code !== 'functions/invalid-argument';
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split('base64,')[1];
      if (!base64) {
        // An empty or unreadable file yields a data URL with no payload; sending it
        // would fail server-side with no indication of which file was at fault.
        reject(new UnusableFileError(`無法讀取「${file.name}」的內容`));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new UnusableFileError(`讀取「${file.name}」失敗：${reader.error?.message ?? '未知原因'}`));
    reader.onabort = () => reject(new UnusableFileError(`讀取「${file.name}」已取消`));
    reader.readAsDataURL(file);
  });
}

async function uploadOne(file: File): Promise<string> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new UnusableFileError(`「${file.name}」超過 ${megabyteLimit} MB 上限`);
  }
  const response = await uploadAttachment({
    name: `${props.filenamePrefix}${file.name}`,
    mimeType: file.type || 'application/octet-stream',
    content: await readAsBase64(file),
  });
  const url = (response.data as { url?: string } | null)?.url;
  if (!url) {
    throw new Error(`「${file.name}」上傳後未取得連結`);
  }
  return url;
}

async function upload() {
  if (uploading.value) return;
  const pending = files.value;
  if (pending.length === 0) {
    notifyError('請先選擇檔案');
    return;
  }

  uploading.value = true;
  Loading.show();
  try {
    const results = await Promise.allSettled(pending.map((file) => uploadOne(file)));
    const urls: string[] = [];
    const failed: File[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        urls.push(result.value);
      } else {
        const file = pending[index]!;
        failed.push(file);
        notifyError(describeUploadFailure(file, result.reason), result.reason, { report: shouldReportUploadError(result.reason) });
      }
    });
    // Keep whatever failed selected so it can be retried without re-picking the files.
    files.value = failed;
    error.value = failed.length !== 0;
    if (urls.length !== 0) {
      notifySuccess(`已上傳 ${urls.length} 個附件`);
      emits('uploaded', urls);
    }
  } finally {
    Loading.hide();
    uploading.value = false;
  }
}

onBeforeUnmount(() => {
  // Loading is a global overlay, so an upload still in flight when the dialog closes
  // would otherwise leave the screen blocked for good.
  if (uploading.value) {
    Loading.hide();
  }
});

function check() {
  const r = (files.value.length !== 0);
  error.value = r;
  return !r;
}

defineExpose({
  check,
});
</script>

<style scoped></style>
