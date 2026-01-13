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
/* TASK-LIST BLUE applied to the q-field container (keeps native inputs transparent) */
/* Do NOT touch .q-menu or .q-select__popup (expanded options) */
html body .q-select .q-field,
html body .group-select--header .q-field,
html body .q-dialog .q-card .q-field,
html body .q-dialog__inner .q-field {
  background: #0d47a1 !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  caret-color: #ffffff !important;
  box-shadow: none !important;
}
/* keep placeholders readable */
html body .group-select--header input::placeholder,
html body .group-select--header textarea::placeholder,
html body .group-select--header .q-select__input::placeholder,
html body .q-dialog .q-card input::placeholder,
html body .q-dialog .q-card textarea::placeholder {
  color: rgba(255,255,255,0.65) !important;
}
`;
  const s = document.createElement('style');
  s.id = 'coq-popup-overrides';
  s.textContent = css;
  document.head.appendChild(s);
};
