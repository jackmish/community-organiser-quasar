/**
 * CentralController — canonical entry point for CC imports.
 *
 * The domain registration and registry instance live in src/CCAccess.ts.
 * This file re-exports everything so both import paths work identically
 * and always share the SAME singleton CCRegistry instance.
 *
 *   import CC from 'src/CentralController'     ← components / composables
 *   import CC from 'src/CCAccess'               ← also fine
 *   import { CCReg } from 'src/CentralController'  ← boot / external registration
 */
export { CC, CCReg } from 'src/CCAccess';
export { default } from 'src/CCAccess';
