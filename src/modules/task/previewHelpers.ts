import type { Ref } from 'vue';

export function createPreviewTaskHandler(args: {
  previewTaskId: Ref<string | null>;
  previewTaskPayload: Ref<Record<string, unknown> | null>;
}) {
  const { previewTaskId, previewTaskPayload } = args;

  return (payload: string | number | Record<string, unknown> | null) => {
    if (payload == null) {
      previewTaskId.value = null;
      previewTaskPayload.value = null;
      return;
    }
    if (typeof payload === 'string' || typeof payload === 'number') {
      previewTaskId.value = String(payload);
      previewTaskPayload.value = null;
      return;
    }
    const p = payload;
    const pid = p['id'];
    previewTaskId.value = typeof pid === 'string' || typeof pid === 'number' ? String(pid) : null;
    previewTaskPayload.value = p;
  };
}
