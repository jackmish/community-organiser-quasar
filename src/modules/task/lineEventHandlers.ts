export function createLineEventHandlers() {
  const pendingLineEvents = new Map<string, (payload?: any) => void>();

  function waitForLineEvent(
    taskId: string | number | undefined,
    idx: number,
    type: 'collapsed' | 'expanded',
  ) {
    if (!taskId && taskId !== 0) return Promise.resolve();
    const key = `${taskId}:${idx}:${type}`;
    return new Promise<void>((res) => {
      pendingLineEvents.set(key, () => res());
    });
  }

  function onLineCollapsed(payload: any) {
    try {
      const key = `${payload.taskId}:${payload.idx}:collapsed`;
      const fn = pendingLineEvents.get(key);
      if (fn) {
        fn(payload);
        pendingLineEvents.delete(key);
      }
    } catch (e) {
      // ignore
    }
  }

  function onLineExpanded(payload: any) {
    try {
      const key = `${payload.taskId}:${payload.idx}:expanded`;
      const fn = pendingLineEvents.get(key);
      if (fn) {
        fn(payload);
        pendingLineEvents.delete(key);
      }
    } catch (e) {
      // ignore
    }
  }

  return { pendingLineEvents, waitForLineEvent, onLineCollapsed, onLineExpanded } as const;
}
