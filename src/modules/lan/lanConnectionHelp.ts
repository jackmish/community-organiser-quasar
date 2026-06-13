import { Capacitor } from '@capacitor/core';
import { getText } from 'src/modules/lang';
import { CO21_LAN_API_PREFIX, CO21_LAN_PAIRING_PORT } from './lanPairingConstants';

export type LanHelpSectionId = 'quick_test' | 'one_way' | 'linux' | 'windows' | 'router';

export type LanHelpContext = {
  /** Desktop host (Electron / Android LAN server). */
  isDesktopHost: boolean;
  /** Phone/tablet connecting to a PC. */
  isMobileClient: boolean;
  desktopOs: 'linux' | 'windows' | 'mac' | 'unknown';
  port: number;
};

export type LanHelpSection = {
  id: LanHelpSectionId;
  titleKey: string;
  bodyKey: string;
};

const SECTIONS: Record<LanHelpSectionId, LanHelpSection> = {
  quick_test: {
    id: 'quick_test',
    titleKey: 'lan.help.section_quick_test',
    bodyKey: 'lan.help.body_quick_test',
  },
  one_way: {
    id: 'one_way',
    titleKey: 'lan.help.section_one_way',
    bodyKey: 'lan.help.body_one_way',
  },
  linux: {
    id: 'linux',
    titleKey: 'lan.help.section_linux',
    bodyKey: 'lan.help.body_linux',
  },
  windows: {
    id: 'windows',
    titleKey: 'lan.help.section_windows',
    bodyKey: 'lan.help.body_windows',
  },
  router: {
    id: 'router',
    titleKey: 'lan.help.section_router',
    bodyKey: 'lan.help.body_router',
  },
};

/** Best-effort desktop OS for help ordering (Electron renderer). */
export function detectDesktopOs(): LanHelpContext['desktopOs'] {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('linux') || ua.includes('linux')) return 'linux';
  if (platform.includes('win') || ua.includes('windows')) return 'windows';
  if (platform.includes('mac') || ua.includes('mac os')) return 'mac';
  return 'unknown';
}

export function getLanHelpContext(port = CO21_LAN_PAIRING_PORT): LanHelpContext {
  const native = Capacitor.isNativePlatform();
  const isElectronHost =
    typeof window !== 'undefined' &&
    !!(window as Window & { electronLan?: { startServer?: unknown } }).electronLan?.startServer;
  return {
    isDesktopHost: isElectronHost,
    isMobileClient: native && !isElectronHost,
    desktopOs: isElectronHost ? detectDesktopOs() : 'unknown',
    port,
  };
}

/** Section order — most relevant first for this device. */
export function orderedLanHelpSections(context: LanHelpContext): LanHelpSection[] {
  let ids: LanHelpSectionId[];
  if (context.isDesktopHost && context.desktopOs === 'linux') {
    ids = ['one_way', 'linux', 'quick_test', 'router', 'windows'];
  } else if (context.isDesktopHost && context.desktopOs === 'windows') {
    ids = ['one_way', 'windows', 'quick_test', 'router', 'linux'];
  } else if (context.isDesktopHost) {
    ids = ['one_way', 'quick_test', 'linux', 'windows', 'router'];
  } else {
    ids = ['quick_test', 'one_way', 'router', 'linux', 'windows'];
  }
  return ids.map((id) => SECTIONS[id]);
}

/** Sections expanded when the dialog opens. */
export function defaultExpandedLanHelpSections(context: LanHelpContext): LanHelpSectionId[] {
  if (context.isDesktopHost && context.desktopOs === 'linux') {
    return ['one_way', 'linux'];
  }
  if (context.isDesktopHost && context.desktopOs === 'windows') {
    return ['one_way', 'windows'];
  }
  if (context.isMobileClient) {
    return ['quick_test', 'router'];
  }
  return ['quick_test', 'one_way'];
}

export function buildLanInfoProbeUrl(host: string, port = CO21_LAN_PAIRING_PORT): string {
  const h = String(host || '').trim();
  if (!h) return '';
  return `http://${h}:${port}${CO21_LAN_API_PREFIX}/info`;
}

/** Renderer-only — do not import from Electron main (lang uses import.meta.glob). */
export function lanConnectionTroubleshootHint(port: number): string {
  const template = getText('lan.help.inline_hint');
  if (template && template !== 'inline_hint') {
    return template.replaceAll('{port}', String(port));
  }
  return (
    `Connection timed out. Open “Connection help” for firewall and network steps (port ${port}).`
  );
}
