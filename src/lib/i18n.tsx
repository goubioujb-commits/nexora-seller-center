'use client';

import { Fragment, ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import { DICT } from './dict';
import { supabase } from './supabase';

export type Lang = 'fr' | 'en' | 'de';
export const LANGS: { code: Lang; label: string; locale: string }[] = [
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
];
const KEY = 'nexora_lang';

// Langue courante, lisible hors composants (formats de dates et de montants)
let current: Lang = 'fr';
export const getLocale = () => LANGS.find((l) => l.code === current)!.locale;
export const getLang = () => current;

const norm = (s: string) => s.replace(/’/g, "'").replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const idx = (l: Lang) => (l === 'en' ? 0 : 1);

// Textes dynamiques (assemblés dans le code)
const PATTERNS: [RegExp, (m: RegExpMatchArray, l: Lang) => string][] = [
  [/^Maximum (\d+) photos : (\d+) ignorée\(s\)\.$/, (m, l) => (l === 'en' ? `Maximum ${m[1]} photos: ${m[2]} ignored.` : `Maximal ${m[1]} Fotos: ${m[2]} ignoriert.`)],
  [/^(.+) : format non accepté \(JPEG, PNG ou WebP\)\.$/, (m, l) => (l === 'en' ? `${m[1]}: format not accepted (JPEG, PNG or WebP).` : `${m[1]}: Format nicht akzeptiert (JPEG, PNG oder WebP).`)],
  [/^(.+) : image illisible\.$/, (m, l) => (l === 'en' ? `${m[1]}: unreadable image.` : `${m[1]}: Bild nicht lesbar.`)],
  [/^Envoi de la photo (\d+) impossible : (.+)$/, (m, l) => (l === 'en' ? `Could not upload photo ${m[1]}: ${m[2]}` : `Foto ${m[1]} konnte nicht hochgeladen werden: ${m[2]}`)],
  [/^Modifier (NX-\S+)$/, (m, l) => (l === 'en' ? `Edit ${m[1]}` : `${m[1]} bearbeiten`)],
  [/^(\d+) annonces hors archives \((\d+) archivées?\)\.$/, (m, l) => (l === 'en' ? `${m[1]} non-archived listings (${m[2]} archived).` : `${m[1]} nicht archivierte Anzeigen (${m[2]} archiviert).`)],
  [/^(\d+) photos?$/, (m, l) => (l === 'en' ? `${m[1]} photo${m[1] === '1' ? '' : 's'}` : `${m[1]} Foto${m[1] === '1' ? '' : 's'}`)],
];
// Remplacements partiels (numéros de membre dans des phrases composées)
const PARTIAL: [RegExp, [string, string]][] = [
  [/Vendeur n°/g, ['Seller #', 'Verkäufer Nr. ']],
  [/Acheteur n°/g, ['Buyer #', 'Käufer Nr. ']],
  [/Membre n°/g, ['Member #', 'Mitglied Nr. ']],
  [/ \(n°/g, [' (#', ' (Nr. ']],
];

export function translate(raw: string, lang: Lang): string {
  if (lang === 'fr' || !raw) return raw;
  const core = norm(raw);
  if (!core) return raw;
  let out: string | undefined = DICT[core]?.[idx(lang)];
  if (out === undefined) {
    for (const [re, fn] of PATTERNS) {
      const m = core.match(re);
      if (m) { out = fn(m, lang); break; }
    }
  }
  if (out === undefined) {
    let s = core;
    PARTIAL.forEach(([re, t]) => { s = s.replace(re, t[idx(lang)]); });
    if (s !== core) out = s;
  }
  if (out === undefined) return raw;
  const lead = raw.match(/^\s*/)![0];
  const trail = raw.match(/\s*$/)![0];
  return lead + out + trail;
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);

function walk(root: Node, lang: Lang) {
  if (root.nodeType === Node.TEXT_NODE) {
    const p = root.parentElement;
    if (p && SKIP.has(p.tagName)) return;
    const v = root.nodeValue || '';
    const t = translate(v, lang);
    if (t !== v) root.nodeValue = t;
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP.has(el.tagName) || el.closest('[data-notranslate]')) return;
  ATTRS.forEach((a) => {
    const v = el.getAttribute(a);
    if (v) {
      const t = translate(v, lang);
      if (t !== v) el.setAttribute(a, t);
    }
  });
  el.childNodes.forEach((c) => walk(c, lang));
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: 'fr', setLang: () => {} });
export const useLang = () => useContext(LangCtx);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');
  const title0 = useRef<string | null>(null);
  current = lang;

  // Langue mémorisée, sinon langue du navigateur (FR par défaut)
  useEffect(() => {
    let l: Lang = 'fr';
    try {
      const s = localStorage.getItem(KEY);
      if (s === 'fr' || s === 'en' || s === 'de') l = s;
      else {
        const n = (navigator.language || 'fr').slice(0, 2);
        if (n === 'en' || n === 'de') l = n;
      }
    } catch {}
    if (l !== 'fr') setLangState(l);
  }, []);

  const setLang = (l: Lang) => {
    try { localStorage.setItem(KEY, l); } catch {}
    setLangState(l);
    // Langue utilisée pour les notifications et e-mails
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id;
      if (!id) return;
      supabase.from('profiles').update({ lang: l }).eq('id', id).then(() => {});
      supabase.from('push_subscriptions').update({ lang: l }).eq('user_id', id).then(() => {});
    }).catch(() => {});
  };

  // Traduction du contenu affiché (et de tout ce que React met à jour ensuite)
  useEffect(() => {
    document.documentElement.lang = lang;
    if (title0.current === null) title0.current = document.title;
    document.title = translate(title0.current, lang);
    if (lang === 'fr') return;
    let busy = false;
    const run = (fn: () => void) => { busy = true; try { fn(); } finally { busy = false; } };
    run(() => walk(document.documentElement, lang));
    const mo = new MutationObserver((muts) => {
      if (busy) return;
      run(() => {
        for (const m of muts) {
          if (m.type === 'childList') m.addedNodes.forEach((n) => walk(n, lang));
          else if (m.type === 'characterData') walk(m.target, lang);
          else if (m.type === 'attributes') walk(m.target, lang);
        }
      });
    });
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => mo.disconnect();
  }, [lang]);

  // key = lang : remonte l'interface pour recalculer dates et montants dans la bonne langue
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangCtx.Provider>
  );
}

function Flag({ code }: { code: Lang }) {
  const common = { width: 22, height: 15, viewBox: '0 0 22 15', 'aria-hidden': true as const, className: 'flag' };
  if (code === 'fr')
    return (<svg {...common}><rect width="7.4" height="15" fill="#2144a8" /><rect x="7.3" width="7.5" height="15" fill="#f4f4f4" /><rect x="14.6" width="7.4" height="15" fill="#d8283c" /></svg>);
  if (code === 'de')
    return (<svg {...common}><rect width="22" height="5.1" fill="#111" /><rect y="5" width="22" height="5.1" fill="#d8283c" /><rect y="10" width="22" height="5" fill="#f2b705" /></svg>);
  return (
    <svg {...common}>
      <rect width="22" height="15" fill="#1f3a8a" />
      <path d="M0 0L22 15M22 0L0 15" stroke="#f4f4f4" strokeWidth="3" />
      <path d="M0 0L22 15M22 0L0 15" stroke="#d8283c" strokeWidth="1.1" />
      <path d="M11 0V15M0 7.5H22" stroke="#f4f4f4" strokeWidth="5" />
      <path d="M11 0V15M0 7.5H22" stroke="#d8283c" strokeWidth="2.8" />
    </svg>
  );
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const cur = LANGS.find((l) => l.code === lang)!;
  return (
    <div className="langsw" ref={ref} data-notranslate="">
      <button type="button" className="langbtn" aria-haspopup="listbox" aria-expanded={open} aria-label={`Langue : ${cur.label}`} onClick={() => setOpen(!open)}>
        <Flag code={lang} />
        <span>{lang.toUpperCase()}</span>
        <i className="chev" aria-hidden="true" />
      </button>
      {open && (
        <ul className="langmenu" role="listbox">
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button type="button" onClick={() => { setLang(l.code); setOpen(false); }}>
                <Flag code={l.code} />
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
