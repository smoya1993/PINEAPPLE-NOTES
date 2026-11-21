/**
 * Script CLI para importar un archivo datos.json existente a PostgreSQL
 * Uso: node scripts/importJson.js <email-usuario> [ruta-datos.json]
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../db/conn");
const { pool } = require("../db/pool");

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const jsonPath = process.argv[3] || path.resolve(__dirname, "../../datos.json");

  if (!email) {
    console.error("Uso: node scripts/importJson.js <email-usuario> [ruta-datos.json]");
    process.exit(1);
  }

  if (!fs.existsSync(jsonPath)) {
    console.error(`No se encontró el archivo: ${jsonPath}`);
    process.exit(1);
  }

  await connectDB();

  const userRes = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (!userRes.rowCount) {
    console.error(`No existe ningún usuario registrado con el email: ${email}`);
    process.exit(1);
  }

  const userId = userRes.rows[0].id;
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const favSet = new Set(Array.isArray(raw.favorites) ? raw.favorites : []);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (raw.activeId) {
      await client.query("UPDATE users SET active_page_id = $1 WHERE id = $2", [raw.activeId, userId]);
    }

    for (const p of raw.pages || []) {
      await client.query(
        `
          INSERT INTO pages (id, user_id, title, icon, parent_id, sort_order, content, is_favorite, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (user_id, id) DO UPDATE SET
            title = EXCLUDED.title,
            icon = EXCLUDED.icon,
            parent_id = EXCLUDED.parent_id,
            sort_order = EXCLUDED.sort_order,
            content = EXCLUDED.content,
            is_favorite = EXCLUDED.is_favorite,
            updated_at = EXCLUDED.updated_at
        `,
        [
          p.id,
          userId,
          p.title ?? "Sin título",
          p.icon ?? "📄",
          p.parentId ?? null,
          Number.isFinite(p.order) ? p.order : 0,
          p.content ?? "<p><br></p>",
          favSet.has(p.id),
          new Date(p.createdAt || Date.now()),
          new Date(p.updatedAt || Date.now()),
        ]
      );
    }

    for (const t of raw.taskItems || []) {
      await client.query(
        `
          INSERT INTO task_items (id, user_id, title, details, priority, due_date, status, created_at, updated_at, completed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (user_id, id) DO UPDATE SET
            title = EXCLUDED.title,
            details = EXCLUDED.details,
            priority = EXCLUDED.priority,
            due_date = EXCLUDED.due_date,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at,
            completed_at = EXCLUDED.completed_at
        `,
        [
          t.id,
          userId,
          t.title ?? "",
          t.details ?? "",
          t.priority ?? "normal",
          t.dueDate ?? "",
          t.status ?? "pending",
          new Date(t.createdAt || Date.now()),
          new Date(t.updatedAt || Date.now()),
          t.completedAt ? new Date(t.completedAt) : null,
        ]
      );
    }

    for (const m of raw.meetingItems || []) {
      await client.query(
        `
          INSERT INTO meeting_items (id, user_id, source_page_id, source_title, source_path, text, html, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (user_id, id) DO UPDATE SET
            source_page_id = EXCLUDED.source_page_id,
            source_title = EXCLUDED.source_title,
            source_path = EXCLUDED.source_path,
            text = EXCLUDED.text,
            html = EXCLUDED.html,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
        `,
        [
          m.id,
          userId,
          m.sourcePageId ?? null,
          m.sourceTitle ?? "",
          m.sourcePath ?? "",
          m.text ?? "",
          m.html ?? "",
          m.status ?? "open",
          new Date(m.createdAt || Date.now()),
          new Date(m.updatedAt || Date.now()),
        ]
      );
    }

    await client.query("COMMIT");
    console.log(
      `✔ Importación completada para ${email}: ${(raw.pages || []).length} notas, ${(raw.taskItems || []).length} tareas, ${(raw.meetingItems || []).length} puntos de reunión.`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error importando datos.json:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
