// Official themes and sub-themes, with the CSP exam split
// (40 questions: 28 knowledge + 12 scenarios).

const THEMES_FR = [
  {
    id: 'pv', icon: '🤝',
    name: 'Principes et valeurs de la République',
    subs: [
      { id: 'symboles', n: 3, name: 'Devise et symboles de la République' },
      { id: 'laicite', n: 2, name: 'Laïcité' },
      { id: 'situation', n: 6, name: 'Mises en situation' },
    ],
  },
  {
    id: 'sip', icon: '🏛️',
    name: 'Système institutionnel et politique',
    subs: [
      { id: 'democratie', n: 3, name: 'Démocratie et droit de vote' },
      { id: 'organisation', n: 2, name: 'Organisation de la République' },
      { id: 'europe', n: 1, name: 'Institutions européennes' },
    ],
  },
  {
    id: 'dd', icon: '⚖️',
    name: 'Droits et devoirs',
    subs: [
      { id: 'fondamentaux', n: 2, name: 'Droits fondamentaux' },
      { id: 'obligations', n: 3, name: 'Obligations et devoirs' },
      { id: 'situation', n: 6, name: 'Mises en situation' },
    ],
  },
  {
    id: 'hgc', icon: '🗺️',
    name: 'Histoire, géographie et culture',
    subs: [
      { id: 'histoire', n: 3, name: 'Périodes et personnages historiques' },
      { id: 'geo', n: 3, name: 'Territoires et géographie' },
      { id: 'patrimoine', n: 2, name: 'Patrimoine français' },
    ],
  },
  {
    id: 'vsf', icon: '🏠',
    name: 'Vivre dans la société française',
    subs: [
      { id: 'installer', n: 1, name: "S'installer et résider en France" },
      { id: 'soins', n: 1, name: 'Accès aux soins' },
      { id: 'travail', n: 1, name: 'Travailler en France' },
      { id: 'ecole', n: 1, name: 'Autorité parentale et école' },
    ],
  },
];

// Names become [French, help language] pairs (2nd slot filled from the help language pack).
const pair = (fr) => [fr, fr];
export const THEMES = THEMES_FR.map((t) => ({ ...t, name: pair(t.name), subs: t.subs.map((x) => ({ ...x, name: pair(x.name) })) }));

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

export function subName(themeId, subId) {
  const s = THEME_BY_ID[themeId]?.subs.find((x) => x.id === subId);
  return s ? s.name : [subId, subId];
}

export const EXAM = { total: 40, minutes: 45, pass: 32 };
