import es from '../data/es.json';
import en from '../data/en.json';

const dicts = { es, en };
let lang = localStorage.getItem('gg-lang') || ((navigator.language || 'es').startsWith('en') ? 'en' : 'es');
if (!['es', 'en'].includes(lang)) lang = 'es';

export function getLang() { return lang; }
export function setLang(l) {
  lang = ['es', 'en'].includes(l) ? l : 'es';
  localStorage.setItem('gg-lang', lang);
  document.documentElement.lang = lang;
  applyI18n();
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('active', b.id === `btn-${lang}`));
  const brand = document.querySelector('[data-brand]');
  if (brand) brand.href = `#/${lang}`;
}
export function t(path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dicts[lang]) ?? path;
}
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}
