import { boot } from 'quasar/wrappers';
import { runLoadPhase } from 'src/composables/appLoadProgress';
import { checkMissingWorkspace } from 'src/composables/useMissingWorkspaceGate';

/** Detect broken workspace paths before organiser / welcome UI loads. */
export default boot(async () => {
  await runLoadPhase('workspace', () => checkMissingWorkspace());
});
