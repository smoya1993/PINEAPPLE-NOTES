/**
 * Script CLI para importar un backup de Dynalist (carpeta con archivos .opml) a PostgreSQL
 * Uso: node scripts/importDynalist.js <email-usuario> <ruta-carpeta-backup>
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const connectDB = require("../db/conn");
const { pool } = require("../db/pool");

function decodeXmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDynalistInline(rawText) {
  let s = escapeHtml(rawText || "");
  // Images ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');
  // Links [label](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Inline code `code`
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic __text__
  s = s.replace(/__([^_]+)__/g, "<em>$1</em>");
  // Strikethrough ~~text~~
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  // Line breaks
  s = s.replace(/\r?\n/g, "<br>");
  return s;
}

function parseAttributes(attrString) {
  const attrs = {};
  const regex = /([a-zA-Z0-9_:-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[2]);
  }
  return attrs;
}

function parseOpml(xml) {
  const titleMatch = xml.match(/<head>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/head>/i);
  const title = titleMatch ? decodeXmlEntities(titleMatch[1]).trim() : "";

  const bodyMatch = xml.match(/<body>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : "";

  const root = { children: [] };
  const stack = [root];

  const tagRegex = /<(\/?)outline\b([\s\S]*?)(\/?)>/gi;
  let match;

  while ((match = tagRegex.exec(body)) !== null) {
    const isClosing = match[1] === "/";
    const attrStr = match[2] || "";
    const isSelfClosing = match[3] === "/";

    if (isClosing) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const attrs = parseAttributes(attrStr);
    const node = {
      text: attrs.text || "",
      note: attrs._note || "",
      heading: attrs.heading ? Number(attrs.heading) : 0,
      complete: attrs.complete === "true",
      checkbox: attrs.checkbox === "true",
      children: [],
    };

    stack[stack.length - 1].children.push(node);
    if (!isSelfClosing) {
      stack.push(node);
    }
  }

  return { title, outlines: root.children };
}

function renderOutlineList(nodes) {
  if (!nodes.length) return "";
  const items = nodes.map((node) => {
    let textHtml = formatDynalistInline(node.text);
    if (node.complete) {
      textHtml = `<s>${textHtml}</s>`;
    }
    if (node.checkbox) {
      textHtml = `${node.complete ? "☑" : "☐"} ${textHtml}`;
    }

    const noteHtml = node.note
      ? `<p style="margin:4px 0 6px;color:var(--muted,#6b7280);font-size:0.95em;">${formatDynalistInline(node.note)}</p>`
      : "";
    const childrenHtml = node.children.length ? renderOutlineList(node.children) : "";

    return `<li>${textHtml}${noteHtml}${childrenHtml}</li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

function opmlToHtml(outlines) {
  if (!outlines.length) return "<p><br></p>";

  const blocks = [];
  let looseListBuffer = [];

  const flushLooseList = () => {
    if (looseListBuffer.length) {
      blocks.push(renderOutlineList(looseListBuffer));
      looseListBuffer = [];
    }
  };

  for (const node of outlines) {
    const isSectionHeader =
      node.heading > 0 ||
      (node.children.length > 0 && /^\*\*.*\*\*/.test(node.text.trim()));

    if (isSectionHeader) {
      flushLooseList();
      const tag = node.heading === 1 ? "h1" : node.heading === 3 ? "h3" : "h2";
      let textHtml = formatDynalistInline(node.text);
      if (node.complete) textHtml = `<s>${textHtml}</s>`;
      blocks.push(`<${tag}>${textHtml}</${tag}>`);
      if (node.note) {
        blocks.push(`<p>${formatDynalistInline(node.note)}</p>`);
      }
      if (node.children.length) {
        blocks.push(renderOutlineList(node.children));
      }
    } else {
      looseListBuffer.push(node);
    }
  }
  flushLooseList();

  return blocks.join("\n") || "<p><br></p>";
}

function stableId(relPath) {
  const hash = crypto.createHash("sha1").update(relPath).digest("hex").slice(0, 12);
  return `dy_${hash}`;
}

function collectDynalistPages(rootDir, baseParentId = null) {
  const pages = [];

  function walk(currentDir, parentId) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    // Folders first, then .opml files, sorted alphabetically
    const dirs = entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    const opmlFiles = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".opml"))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    let order = 0;

    for (const dir of dirs) {
      const fullPath = path.join(currentDir, dir.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      const id = stableId(`dir:${relPath}`);

      pages.push({
        id,
        title: dir.name.trim(),
        icon: "📁",
        parentId,
        order: order++,
        content: `<p>Carpeta importada desde Dynalist: <strong>${escapeHtml(dir.name.trim())}</strong></p>`,
      });

      walk(fullPath, id);
    }

    for (const file of opmlFiles) {
      const fullPath = path.join(currentDir, file.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      const xml = fs.readFileSync(fullPath, "utf8");
      const { title, outlines } = parseOpml(xml);

      const fallbackTitle = file.name.replace(/\.opml$/i, "").trim();
      const finalTitle = (title || fallbackTitle).trim();
      const html = opmlToHtml(outlines);

      pages.push({
        id: stableId(`file:${relPath}`),
        title: finalTitle,
        icon: "📝",
        parentId,
        order: order++,
        content: html,
      });
    }
  }

  walk(rootDir, baseParentId);
  return pages;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const backupDir = process.argv[3];

  if (!email || !backupDir) {
    console.error("Uso: node scripts/importDynalist.js <email-usuario> <ruta-carpeta-backup>");
    process.exit(1);
  }

  if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) {
    console.error(`No se encontró la carpeta: ${backupDir}`);
    process.exit(1);
  }

  await connectDB();

  const userRes = await pool.query("SELECT id, name FROM users WHERE email = $1", [email]);
  if (!userRes.rowCount) {
    console.error(`No existe ningún usuario con el email: ${email}`);
    process.exit(1);
  }

  const userId = userRes.rows[0].id;
  const importedPages = collectDynalistPages(backupDir, null);

  // Obtener el orden máximo actual en la raíz para añadir los nuevos elementos sin colisionar
  const maxOrderRes = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM pages WHERE user_id = $1 AND parent_id IS NULL",
    [userId]
  );
  let rootOrderOffset = Number(maxOrderRes.rows[0].max_order) + 1;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const now = new Date();
    for (const p of importedPages) {
      const sortOrder = p.parentId === null ? rootOrderOffset++ : p.order;
      await client.query(
        `
          INSERT INTO pages (id, user_id, title, icon, parent_id, sort_order, content, is_favorite, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $8)
          ON CONFLICT (user_id, id) DO UPDATE SET
            title = EXCLUDED.title,
            icon = EXCLUDED.icon,
            parent_id = EXCLUDED.parent_id,
            content = EXCLUDED.content,
            updated_at = EXCLUDED.updated_at
        `,
        [p.id, userId, p.title, p.icon, p.parentId, sortOrder, p.content, now]
      );
    }

    await client.query("COMMIT");

    const foldersCount = importedPages.filter((p) => p.icon === "📁").length;
    const notesCount = importedPages.filter((p) => p.icon === "📝").length;
    console.log(
      `✔ Importación de Dynalist completada para ${email}: ${foldersCount} carpetas y ${notesCount} notas (${importedPages.length} páginas en total).`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error importando Dynalist:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
