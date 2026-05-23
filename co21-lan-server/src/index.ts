import { registerPlugin } from '@capacitor/core';
import type { Co21LanServerPlugin } from './definitions';

const Co21LanServer = registerPlugin<Co21LanServerPlugin>('Co21LanServer', {
  web: () => import('./web').then((m) => new m.Co21LanServerWeb()),
});

export * from './definitions';
export { Co21LanServer };
