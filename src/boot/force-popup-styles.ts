export default () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('coq-popup-overrides')) return;
  const css = `
/* Force outlined field pseudo-element borders to white */
.q-field--outlined .q-field__control::before,
.q-field--outlined .q-field__control:before,
.q-field--outlined .q-field__control::after,
.q-field--outlined .q-field__control:after {
  border: 1px solid rgba(255,255,255,0.95) !important;
  background: transparent !important;
  box-shadow: none !important;
}
/* Hover/focus variants */
.q-field--outlined .q-field__control:hover::before,
.q-field--outlined .q-field__control:hover:before,
.q-field--outlined.q-focused .q-field__control::before {
  border-color: rgba(255,255,255,0.95) !important;
}
`;
  const s = document.createElement('style');
  s.id = 'coq-popup-overrides';
  s.textContent = css;
  document.head.appendChild(s);
};
