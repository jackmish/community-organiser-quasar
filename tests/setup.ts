import { setActivePinia, createPinia } from 'pinia';
import { beforeEach } from 'vitest';

// Create a fresh Pinia instance before each test so store state never leaks between tests
beforeEach(() => {
  setActivePinia(createPinia());
});
