import { boot } from 'quasar/wrappers';
import { useSpaceAuth } from 'src/composables/useSpaceAuth';

/** Resolve space lock state before the router or organiser data loads. */
export default boot(async () => {
  const { refreshStatus } = useSpaceAuth();
  await refreshStatus();
});
