import type { Ref } from 'vue';

export function createPreviewTaskHandler(args: { setTask: (p: any) => void }) {
  const { setTask } = args;

  return (payload: string | number | Record<string, unknown> | null) => {
    try {
      setTask(payload as any);
    } catch (e) {
      // ignore
    }
  };
}
