# 🍍 Pineapple Notes Enterprise

> Sistema empresarial de gestión del conocimiento, notas ricas, seguimiento de tareas y gestión de temas para reuniones con almacenamiento 100% local en disco.

---

## 🌟 Características Principales

- **Arquitectura Local-First con File System Access API**: Los datos se guardan de forma directa en el archivo local `datos.json` e imágenes en el directorio `images/` sin intermediarios externos ni nube forzada.
- **Árbol Jerárquico de Notas**: Soporte ilimitado de subnotas, reordenación fluida mediante Drag & Drop y memoria de estado de carpetas expandidas.
- **Sección de Favoritos Sincronizados**: Acceso rápido y anclaje directo de notas frecuentes con icono estrella ⭐.
- **Editor WYSIWYG de Alto Rendimiento**:
  - Formato tipográfico completo (H1, H2, Párrafo, Negrita, Cursiva, Subrayado, Tachado, Citas y Listas).
  - Paleta de **Resaltadores Pastel** (6 colores pastel + opción de limpieza).
  - Bloques de código con **resaltado de sintaxis en tiempo real** para JavaScript, TypeScript, Python, SQL, HTML, CSS, Bash y JSON, con botón de copiado en un clic y eliminación segura.
  - Generador interactivo de **Tablas dinámicas** personalizadas en filas y columnas.
  - Bloques de aviso **Importante** con eliminación protegida contra borrado accidental.
  - **Widget Dinámico de Tareas (☑️)**: Bloque interactivo incrustable dentro de cualquier nota con formulario de creación, filtros y estados.
  - Subida directa de imágenes con barra flotante de redimensionamiento porcentual.
  - **Métricas del documento**: Contador en tiempo real de palabras, caracteres y cálculo de tiempo de lectura estimado.
- **Módulo Especializado: Tareas Raúl (✅)**:
  - Gestor personal de tareas con priorización (Alta, Normal, Baja), fecha límite y notas ampliables.
  - Detección automática de tareas vencidas con alertas visuales.
  - Filtros rápidos por estado (Pendientes, Completadas, Todas).
- **Módulo Especializado: Reuniones Internas (💬)**:
  - Recopilador ágil de temas: selecciona cualquier fragmento en cualquier nota y envíalo a la lista de temas a comentar con un solo clic.
  - Backlinks directos que enlazan con la nota original para navegación contextual rápida.
- **Experiencia de Usuario Empresarial**:
  - Sistema de **Notificaciones Toast** no bloqueantes.
  - **Modales accesibles** para confirmaciones y edición rápida.
  - Tema Claro / Oscuro con detección automática del sistema.
  - Control de escala / zoom de interfaz de usuario (80% - 140%).
  - Exportación de copias completas en JSON, exportación individual a **Markdown (.md)** y exportación a **PDF (📄 PDF)** con diseño optimizado para impresión.

---

## 🏗️ Arquitectura del Proyecto

```
PIÑA/
├── index.html                     # Entrada HTML5 semántica y accesible
├── server.js                      # Servidor HTTP ligero y ultra-rápido
├── package.json                   # Dependencias y scripts de desarrollo
├── vite.config.js                 # Configuración de empaquetador moderno
├── README.md                      # Documentación técnica completa
├── .gitignore                     # Exclusiones estándar
├── datos.json                     # Archivo de datos de persistencia local
├── images/                        # Directorio para almacenamiento de imágenes
├── legacy/
│   └── original_pina_notes.html   # Respaldo intacto del archivo original
└── src/
    ├── styles/                    # Design System Modular
    │   ├── variables.css          # Tokens de diseño y variables CSS
    │   ├── base.css               # Reset y layouts principales
    │   ├── components.css         # Componentes UI (sidebar, toast, árbol)
    │   ├── editor.css             # Editor WYSIWYG, tablas y código
    │   ├── tasks.css              # Estilos del gestor de tareas y widgets
    │   ├── meetings.css           # Estilos del módulo de reuniones
    │   └── modals.css             # Modales accesibles y pantalla de bloqueo
    └── js/
        ├── app.js                 # Bootstrapper y orquestador principal
        ├── config/
        │   └── constants.js       # Constantes, paletas y semillas
        ├── core/
        │   └── state.js           # Store reactivo centralizado con Pub/Sub
        ├── services/
        │   ├── fsService.js       # Integración con File System Access API
        │   ├── storageService.js  # Respaldo, exportación MD/JSON/PDF
        │   ├── taskService.js     # Lógica de negocio de tareas
        │   └── meetingService.js  # Lógica de extracción de fragmentos de reunión
        ├── components/
        │   ├── sidebar.js         # Árbol de notas, drag-and-drop y favoritos
        │   ├── toolbar.js         # Barra de herramientas de edición
        │   ├── editor.js          # Editor de contenido y métricas
        │   ├── tasksView.js       # Vista interactiva de tareas
        │   └── meetingsView.js    # Vista de temas de reuniones
        └── utils/
            ├── dom.js             # Helpers del DOM y sanitización XSS
            ├── toast.js           # Notificaciones Toast no bloqueantes
            └── modal.js           # Controlador de modales accesibles
```

---

## 🚀 Puesta en Marcha

### Iniciar Servidor de Desarrollo

```bash
npm run dev
# o bien
npm start
```
Abre [http://localhost:3000/](http://localhost:3000/) en cualquier navegador moderno.

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
| :--- | :--- |
| `Ctrl + S` | Forzar guardado inmediato en el disco local |
| `Ctrl + N` / `Alt + N` | Crear una nueva nota |
| `Ctrl + F` | Enfocar la barra de búsqueda de notas |
| `Ctrl + P` | Abrir diálogo de exportación / impresión a PDF |
| `Ctrl + B` | Aplicar formato Negrita |
| `Ctrl + I` | Aplicar formato Cursiva |
| `Ctrl + U` | Aplicar formato Subrayado |
| `Tab` | Aumentar nivel de sangría en listas o sangrar código |
| `Shift + Tab` | Reducir sangría en listas |
| `F1` / `Ctrl + /` | Abrir modal de ayuda con todos los atajos |

---

## 🔒 Privacidad y Seguridad

- **Sanitización de Contenido**: Todo el contenido pegado o insertado se filtra y sanitiza contra inyecciones XSS.
- **Almacenamiento Local Soberano**: Tus notas nunca viajan a servidores remotos. Todo permanece en tu directorio local bajo tu control absoluto.
