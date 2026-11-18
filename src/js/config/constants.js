/**
 * Configuración global y constantes de Pineapple Notes Enterprise
 */

export const STORAGE_KEYS = {
  DATA: 'pineappleNotesSharedV1',
  ENTERPRISE_DATA: 'pineappleNotesV1',
  LEGACY_DATA: 'pinaNotesV6',
  THEME: 'pineappleNotesSharedTheme',
  ENTERPRISE_THEME: 'pineappleNotesTheme',
  LEGACY_THEME: 'pinaNotesTheme',
  SCALE: 'pineappleNotesSharedScale',
  ENTERPRISE_SCALE: 'pineappleNotesScale',
  LEGACY_SCALE: 'pinaNotesScale',
  EXPANDED: 'pineappleNotesSharedExpanded',
  ENTERPRISE_EXPANDED: 'pineappleNotesExpanded',
  LEGACY_EXPANDED: 'pinaNotesExpanded',
  FAVORITES_COLLAPSED: 'pineappleSharedFavoritesCollapsed'
};

export const SPECIAL_PAGES = {
  MEETINGS_ID: 'reuniones-internas-cosas-comentar',
  TASKS_ID: 'tareas',
  LEGACY_TASKS_ID: 'tareas-raul',
  TOPICS_ID: 'temas-pendientes',
  TIME_ID: 'registro-tiempo',
  MAIL_ID: 'correos-marcados'
};

export const TOOL_PAGE_IDS = [
  SPECIAL_PAGES.TASKS_ID,
  SPECIAL_PAGES.TOPICS_ID,
  SPECIAL_PAGES.TIME_ID
];

export const READONLY_SPECIAL_PAGE_IDS = [
  SPECIAL_PAGES.MEETINGS_ID,
  SPECIAL_PAGES.MAIL_ID,
  SPECIAL_PAGES.TASKS_ID,
  SPECIAL_PAGES.TOPICS_ID,
  SPECIAL_PAGES.TIME_ID
];

export const INDEXED_DB = {
  DB_NAME: 'pineappleNotesSharedHandles',
  ENTERPRISE_DB_NAME: 'pineappleNotesHandles',
  LEGACY_DB_NAME: 'pinaNotesHandles',
  STORE_NAME: 'handles',
  KEY: 'root',
  VERSION: 1
};

export const PASTEL_COLORS = [
  { color: '#fff0a8', label: 'Amarillo pastel' },
  { color: '#d9f2d0', label: 'Verde pastel' },
  { color: '#d8ecff', label: 'Azul pastel' },
  { color: '#ffdce5', label: 'Rosa pastel' },
  { color: '#eadcff', label: 'Lila pastel' },
  { color: '#ffe0c2', label: 'Melocotón pastel' }
];

export const CODE_LANGUAGES = {
  javascript: {
    label: 'JavaScript',
    keywords: 'const let var function return if else for while class new async await try catch throw import from export true false null undefined switch case default break continue'
  },
  typescript: {
    label: 'TypeScript',
    keywords: 'const let var function return if else for while class new async await try catch throw import from export true false null undefined interface type enum implements declare namespace readonly as is keyof'
  },
  python: {
    label: 'Python',
    keywords: 'def return if elif else for while class import from as try except raise with lambda True False None and or not in is async await pass yield global nonlocal'
  },
  html: {
    label: 'HTML',
    keywords: ''
  },
  css: {
    label: 'CSS',
    keywords: ''
  },
  json: {
    label: 'JSON',
    keywords: 'true false null'
  },
  sql: {
    label: 'SQL',
    keywords: 'SELECT FROM WHERE JOIN ON INSERT INTO UPDATE DELETE CREATE TABLE ALTER DROP GROUP BY ORDER HAVING AS AND OR NULL VALUES SET LIMIT OFFSET UNION INNER LEFT RIGHT'
  },
  bash: {
    label: 'Bash',
    keywords: 'if then else elif fi for do done case esac function in echo exit return set source export alias local read'
  },
  text: {
    label: 'Texto',
    keywords: ''
  }
};

export const DEFAULT_TIME_SETTINGS = {
  rounding: 'minute',
  idleReminderMinutes: 90,
  remindersEnabled: false,
  categories: [
    'Interno',
    'Cliente',
    'Formación',
    'Soporte',
    'Reunión',
    'Administrativo',
    'Otro'
  ],
  projects: [
    'Pineapple Notes',
    'Forti',
    'Akamai',
    'Azure',
    'Correos',
    'Reuniones internas'
  ]
};

export const INITIAL_DATA = {
  version: 7,
  activeId: 'welcome',
  pages: [
    {
      id: 'welcome',
      title: 'Bienvenido a Pineapple Notes',
      icon: '📝',
      parentId: null,
      order: 0,
      content: '<h2>Tu espacio de notas</h2><p>Crea notas, subnotas, listas, resaltados y bloques de código.</p>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  timeEntries: [],
  timeTimer: null,
  timeSettings: structuredClone(DEFAULT_TIME_SETTINGS),
  topicItems: [],
  taskItems: [],
  mailItems: [],
  mailStates: {},
  meetingItems: [],
  favorites: []
};
