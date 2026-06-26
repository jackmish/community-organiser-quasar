import {
  buildLocalBackendServerStatusRow,
  type DeviceConnectionStatus,
  type DeviceStatusRow,
} from 'src/utils/deviceStatusDisplay';
import { $text } from 'src/modules/lang';
import { checkAiServerHealth } from './aiServerService';
import { loadAiServerEnabled } from './aiServerSettings';

export async function probeLocalBackendServerRow(options?: {
  checking?: boolean;
}): Promise<DeviceStatusRow | null> {
  const enabled = await loadAiServerEnabled();
  if (!enabled) return null;

  const tooltip = $text('header.local_backend_server');
  if (options?.checking) {
    return buildLocalBackendServerStatusRow('checking', tooltip);
  }

  let status: DeviceConnectionStatus = 'disconnected';
  try {
    const healthy = await checkAiServerHealth();
    status = healthy ? 'connected' : 'disconnected';
  } catch {
    status = 'disconnected';
  }

  return buildLocalBackendServerStatusRow(status, tooltip);
}
