import { registerPlugin } from '@capacitor/core';
const Co21LanServer = registerPlugin('Co21LanServer', {
    web: () => import('./web').then((m) => new m.Co21LanServerWeb()),
});
export * from './definitions';
export { Co21LanServer };
