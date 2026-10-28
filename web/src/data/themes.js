// Official themes and sub-themes, with the CSP exam split
// (40 questions: 28 knowledge + 12 scenarios).

export const THEMES = [
  {
    id: 'pv', icon: '🤝',
    name: ['Principes et valeurs de la République', "Cumhuriyet'in ilke ve değerleri"],
    subs: [
      { id: 'symboles', n: 3, name: ['Devise et symboles de la République', "Cumhuriyet'in şiarı ve sembolleri"] },
      { id: 'laicite', n: 2, name: ['Laïcité', 'Laiklik'] },
      { id: 'situation', n: 6, name: ['Mises en situation', 'Durum soruları'] },
    ],
  },
  {
    id: 'sip', icon: '🏛️',
    name: ['Système institutionnel et politique', 'Kurumsal ve siyasi sistem'],
    subs: [
      { id: 'democratie', n: 3, name: ['Démocratie et droit de vote', 'Demokrasi ve oy hakkı'] },
      { id: 'organisation', n: 2, name: ['Organisation de la République', "Cumhuriyet'in teşkilatı"] },
      { id: 'europe', n: 1, name: ['Institutions européennes', 'Avrupa kurumları'] },
    ],
  },
  {
    id: 'dd', icon: '⚖️',
    name: ['Droits et devoirs', 'Haklar ve ödevler'],
    subs: [
      { id: 'fondamentaux', n: 2, name: ['Droits fondamentaux', 'Temel haklar'] },
      { id: 'obligations', n: 3, name: ['Obligations et devoirs', 'Yükümlülükler ve ödevler'] },
      { id: 'situation', n: 6, name: ['Mises en situation', 'Durum soruları'] },
    ],
  },
  {
    id: 'hgc', icon: '🗺️',
    name: ['Histoire, géographie et culture', 'Tarih, coğrafya ve kültür'],
    subs: [
      { id: 'histoire', n: 3, name: ['Périodes et personnages historiques', 'Tarihî dönemler ve şahsiyetler'] },
      { id: 'geo', n: 3, name: ['Territoires et géographie', 'Topraklar ve coğrafya'] },
      { id: 'patrimoine', n: 2, name: ['Patrimoine français', 'Fransız mirası'] },
    ],
  },
  {
    id: 'vsf', icon: '🏠',
    name: ['Vivre dans la société française', 'Fransız toplumunda yaşamak'],
    subs: [
      { id: 'installer', n: 1, name: ["S'installer et résider en France", "Fransa'ya yerleşmek ve ikamet etmek"] },
      { id: 'soins', n: 1, name: ['Accès aux soins', 'Sağlık hizmetlerine erişim'] },
      { id: 'travail', n: 1, name: ['Travailler en France', "Fransa'da çalışmak"] },
      { id: 'ecole', n: 1, name: ['Autorité parentale et école', 'Ebeveyn yetkisi ve okul'] },
    ],
  },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

export function subName(themeId, subId) {
  const s = THEME_BY_ID[themeId]?.subs.find((x) => x.id === subId);
  return s ? s.name : [subId, subId];
}

export const EXAM = { total: 40, minutes: 45, pass: 32 };
