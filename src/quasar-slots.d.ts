import 'quasar';

declare module 'quasar' {
  // Extend QMenuSlots to include the 'anchor' slot used as activator
  interface QMenuSlots {
    anchor?: () => unknown;
  }
}
