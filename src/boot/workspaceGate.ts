import { boot } from 'quasar/wrappers';
import { checkMissingWorkspace } from 'src/composables/useMissingWorkspaceGate';

/** Detect broken workspace paths before organiser / welcome UI loads. */
export default boot(async () => {
  await checkMissingWorkspace();
});
