import {
  buildLocalBackendServerStatusRow,
  type DeviceConnectionStatus,
  type DeviceStatusRow,
} from 'src/utils/deviceStatusDisplay';
import { $text } from 'src/modules/lang';
import { checkCo21ServerHealth } from './co21ServerService';
import { loadCo21ServerEnabled } from './co21ServerSettings';

export async function probeLocalBackendServerRow(options?: {
  checking?: boolean;
}): Promise<DeviceStatusRow | null> {
  const enabled = await loadCo21ServerEnabled();
  if (!enabled) return null;

  const tooltip = $text('header.local_backend_server');
  if (options?.checking) {
    return buildLocalBackendServerStatusRow('checking', tooltip);
  }

  let status: DeviceConnectionStatus = 'disconnected';
  try {
    const healthy = await checkCo21ServerHealth();
    status = healthy ? 'connected' : 'disconnected';
  } catch {
    status = 'disconnected';
  }

  return buildLocalBackendServerStatusRow(status, tooltip);
}
