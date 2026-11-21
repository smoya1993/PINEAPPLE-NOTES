/**
 * Servicio de Respaldo, Importación y Exportación Multiformato
 */

import { state } from '../core/state.js';
import { stripHtml } from '../utils/dom.js';
import { toastSuccess, toastError } from '../utils/toast.js';

class StorageService {
  /**
   * Exporta todos los datos en formato JSON descargable
   */
  exportJsonBackup() {
    try {
      const data = state.getData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `pineapple-notes-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('Copia de respaldo JSON exportada correctamente');
    } catch (e) {
      toastError(`Error al exportar respaldo: ${e.message}`);
    }
  }

  /**
   * Exporta la nota activa a Markdown (.md)
   */
  exportActivePageToMarkdown() {
    try {
      const page = state.getActivePage();
      let md = `# ${page.title || 'Sin título'}\n\n`;
      
      // Conversión simple de HTML a Markdown estructurado
      const temp = document.createElement('div');
      temp.innerHTML = page.content || '';

      temp.querySelectorAll('h1').forEach((h) => (h.outerHTML = `\n# ${h.textContent}\n`));
      temp.querySelectorAll('h2').forEach((h) => (h.outerHTML = `\n## ${h.textContent}\n`));
      temp.querySelectorAll('h3').forEach((h) => (h.outerHTML = `\n### ${h.textContent}\n`));
      temp.querySelectorAll('blockquote').forEach((b) => (b.outerHTML = `\n> ${b.textContent}\n`));
      temp.querySelectorAll('li').forEach((li) => (li.outerHTML = `\n- ${li.textContent}`));
      temp.querySelectorAll('p').forEach((p) => (p.outerHTML = `\n${p.textContent}\n`));
      
      md += temp.textContent.trim();

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = (page.title || 'nota').toLowerCase().replace(/[^a-z0-9]/gi, '_');
      a.href = url;
      a.download = `${safeTitle}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess(`Nota "${page.title}" exportada a Markdown`);
    } catch (e) {
      toastError(`Error al exportar Markdown: ${e.message}`);
    }
  }

  /**
   * Exporta la nota activa a PDF mediante el diálogo de impresión con estilos optimizados
   */
  exportActivePageToPdf() {
    try {
      const page = state.getActivePage();
      const originalTitle = document.title;
      document.title = `${page.title || 'Nota'} - Pineapple Notes`;
      toastSuccess('Abriendo diálogo para exportar a PDF...');
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    } catch (e) {
      toastError(`Error al exportar PDF: ${e.message}`);
    }
  }
}

export const storageService = new StorageService();

