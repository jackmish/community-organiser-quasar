import { onBeforeUnmount, onMounted, ref } from 'vue';
import { $text } from 'src/modules/lang';
import {
  dispatchOpenIncomingReview,
  loadIncomingBannerState,
  SYNC_CONTRACT_INCOMING_EVENT,
} from 'src/modules/storage/sync/syncContractIncoming';

/** Incoming sync contract from a paired LAN peer — header + Connections banner. */
export function useSyncContractIncomingNotice() {
  const show = ref(false);
  const bannerMessage = ref('');

  async function refresh(): Promise<void> {
    const state = await loadIncomingBannerState();
    show.value = state.showBanner;
    const name = state.pending?.proposerDeviceName ?? '?';
    bannerMessage.value = $text('sync.incoming_banner').replace('{device}', name);
  }

  function openReview(): void {
    dispatchOpenIncomingReview();
  }

  const onChanged = () => {
    void refresh();
  };

  onMounted(() => {
    void refresh();
    window.addEventListener(SYNC_CONTRACT_INCOMING_EVENT, onChanged);
    window.addEventListener('co21:sync-contract-signed', onChanged);
  });

  onBeforeUnmount(() => {
    window.removeEventListener(SYNC_CONTRACT_INCOMING_EVENT, onChanged);
    window.removeEventListener('co21:sync-contract-signed', onChanged);
  });

  return { show, bannerMessage, refresh, openReview };
}
