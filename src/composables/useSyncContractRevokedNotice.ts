import { onBeforeUnmount, onMounted, ref } from 'vue';
import { $text } from 'src/modules/lang';
import { SYNC_CONTRACT_REJECTED_EVENT } from 'src/modules/storage/sync/syncContractIncoming';

/** Peer ended or rejected the sync contract — header alert (red). */
export function useSyncContractRevokedNotice() {
  const show = ref(false);
  const deviceName = ref('');
  const bannerText = ref('');

  function applyDetail(detail: unknown): void {
    if (!detail || typeof detail !== 'object') {
      show.value = false;
      return;
    }
    const name =
      typeof (detail as { rejectorDeviceName?: string }).rejectorDeviceName === 'string'
        ? (detail as { rejectorDeviceName: string }).rejectorDeviceName.trim()
        : '';
    if (!name) {
      show.value = false;
      return;
    }
    deviceName.value = name;
    bannerText.value = $text('sync.contract_revoked_banner').replace('{device}', name);
    show.value = true;
  }

  const onRejected = (ev: Event) => {
    const detail = (ev as CustomEvent).detail;
    applyDetail(detail ?? null);
  };

  onMounted(() => {
    window.addEventListener(SYNC_CONTRACT_REJECTED_EVENT, onRejected);
  });

  onBeforeUnmount(() => {
    window.removeEventListener(SYNC_CONTRACT_REJECTED_EVENT, onRejected);
  });

  function dismiss(): void {
    show.value = false;
  }

  return { show, deviceName, bannerText, dismiss };
}
