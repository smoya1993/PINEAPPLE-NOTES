/**
 * Configuración global y constantes de Pineapple Notes Enterprise
 */

export const STORAGE_KEYS = {
  DATA: 'pineappleNotesV1',
  LEGACY_DATA: 'pinaNotesV6',
  THEME: 'pineappleNotesTheme',
  LEGACY_THEME: 'pinaNotesTheme',
  SCALE: 'pineappleNotesScale',
  LEGACY_SCALE: 'pinaNotesScale',
  EXPANDED: 'pineappleNotesExpanded',
  LEGACY_EXPANDED: 'pinaNotesExpanded'
};

export const SPECIAL_PAGES = {
  MEETINGS_ID: 'reuniones-internas-cosas-comentar',
  TASKS_ID: 'tareas-raul'
};

export const INDEXED_DB = {
  DB_NAME: 'pineappleNotesHandles',
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
  sql: {
    label: 'SQL',
    keywords: 'SELECT FROM WHERE JOIN ON INSERT INTO UPDATE DELETE CREATE TABLE ALTER DROP GROUP BY ORDER HAVING AS AND OR NULL VALUES SET LIMIT OFFSET UNION INNER LEFT RIGHT'
  },
  bash: {
    label: 'Bash',
    keywords: 'if then else elif fi for do done case esac function in echo exit return set source export alias local read'
  },
  json: {
    label: 'JSON',
    keywords: 'true false null'
  },
  html: {
    label: 'HTML',
    keywords: ''
  },
  css: {
    label: 'CSS',
    keywords: ''
  },
  text: {
    label: 'Texto',
    keywords: ''
  }
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
      content: '<h2>Tu espacio de notas</h2><p>Crea notas, subnotas, listas, tablas, widgets de tareas, resaltados pastel y bloques de código interactivos.</p><p>Estas páginas iniciales son de demostración: puedes editarlas o eliminarlas libremente desde el menú <b>•••</b>.</p>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: SPECIAL_PAGES.TASKS_ID,
      title: 'Tareas (Demo)',
      icon: '✅',
      parentId: null,
      order: 1,
      content: '<p>Gestor personal de tareas.</p>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'reuniones',
      title: 'Reuniones (Demo)',
      icon: '📅',
      parentId: null,
      order: 2,
      content: '<p>Notas, acuerdos y acciones de reuniones.</p>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: SPECIAL_PAGES.MEETINGS_ID,
      title: 'Reuniones · Cosas que comentar (Demo)',
      icon: '💬',
      parentId: null,
      order: 3,
      content: '<p>Esta página recopila los fragmentos enviados con el botón 💬.</p>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  meetingItems: [],
  taskItems: [],
  favorites: []
};
