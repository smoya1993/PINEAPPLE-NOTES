const { pool } = require("../db/pool");

function toDate(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toNullableDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const getWorkspace = async (req, res, next) => {
  try {
    const userId = req.user;

    const [userRes, pagesRes, tasksRes, meetingsRes] = await Promise.all([
      pool.query("SELECT active_page_id FROM users WHERE id = $1", [userId]),
      pool.query(
        `
          SELECT id, title, icon, parent_id, sort_order, content, is_favorite, created_at, updated_at
          FROM pages
          WHERE user_id = $1
          ORDER BY parent_id NULLS FIRST, sort_order ASC, created_at ASC
        `,
        [userId]
      ),
      pool.query(
        `
          SELECT id, title, details, priority, due_date, status, created_at, updated_at, completed_at
          FROM task_items
          WHERE user_id = $1
          ORDER BY created_at ASC
        `,
        [userId]
      ),
      pool.query(
        `
          SELECT id, source_page_id, source_title, source_path, text, html, status, created_at, updated_at
          FROM meeting_items
          WHERE user_id = $1
          ORDER BY created_at ASC
        `,
        [userId]
      ),
    ]);

    const favorites = [];
    const pages = pagesRes.rows.map((row) => {
      if (row.is_favorite) favorites.push(row.id);
      return {
        id: row.id,
        title: row.title,
        icon: row.icon,
        parentId: row.parent_id,
        order: row.sort_order,
        content: row.content,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    });

    const taskItems = tasksRes.rows.map((row) => ({
      id: row.id,
      title: row.title,
      details: row.details,
      priority: row.priority,
      dueDate: row.due_date,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    }));

    const meetingItems = meetingsRes.rows.map((row) => ({
      id: row.id,
      sourcePageId: row.source_page_id,
      sourceTitle: row.source_title,
      sourcePath: row.source_path,
      text: row.text,
      html: row.html,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));

    res.json({
      version: 7,
      activeId: userRes.rows[0]?.active_page_id || pages[0]?.id || "welcome",
      pages,
      taskItems,
      meetingItems,
      favorites,
    });
  } catch (error) {
    next(error);
  }
};

const syncWorkspace = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const userId = req.user;
    const {
      activeId = null,
      pages = [],
      taskItems = [],
      meetingItems = [],
      favorites = [],
    } = req.body || {};

    if (!Array.isArray(pages)) {
      return res.status(400).json({ message: "El campo pages debe ser un array" });
    }

    const favSet = new Set(Array.isArray(favorites) ? favorites : []);

    await client.query("BEGIN");

    if (activeId) {
      await client.query(
        "UPDATE users SET active_page_id = $1, updated_at = now() WHERE id = $2",
        [activeId, userId]
      );
    }

    // 1. Sync pages
    const pageIds = [];
    for (const p of pages) {
      if (!p?.id) continue;
      pageIds.push(p.id);
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
          String(p.id),
          userId,
          p.title ?? "Sin título",
          p.icon ?? "📄",
          p.parentId ?? null,
          Number.isFinite(p.order) ? p.order : 0,
          p.content ?? "<p><br></p>",
          favSet.has(p.id),
          toDate(p.createdAt),
          toDate(p.updatedAt),
        ]
      );
    }

    if (pageIds.length > 0) {
      await client.query(
        "DELETE FROM pages WHERE user_id = $1 AND NOT (id = ANY($2::text[]))",
        [userId, pageIds]
      );
    } else {
      await client.query("DELETE FROM pages WHERE user_id = $1", [userId]);
    }

    // 2. Sync taskItems
    const taskIds = [];
    if (Array.isArray(taskItems)) {
      for (const t of taskItems) {
        if (!t?.id) continue;
        taskIds.push(t.id);
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
            String(t.id),
            userId,
            t.title ?? "",
            t.details ?? "",
            t.priority ?? "normal",
            t.dueDate ?? "",
            t.status ?? "pending",
            toDate(t.createdAt),
            toDate(t.updatedAt),
            toNullableDate(t.completedAt),
          ]
        );
      }
    }

    if (taskIds.length > 0) {
      await client.query(
        "DELETE FROM task_items WHERE user_id = $1 AND NOT (id = ANY($2::text[]))",
        [userId, taskIds]
      );
    } else {
      await client.query("DELETE FROM task_items WHERE user_id = $1", [userId]);
    }

    // 3. Sync meetingItems
    const meetingIds = [];
    if (Array.isArray(meetingItems)) {
      for (const m of meetingItems) {
        if (!m?.id) continue;
        meetingIds.push(m.id);
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
            String(m.id),
            userId,
            m.sourcePageId ?? null,
            m.sourceTitle ?? "",
            m.sourcePath ?? "",
            m.text ?? "",
            m.html ?? "",
            m.status ?? "open",
            toDate(m.createdAt),
            toDate(m.updatedAt),
          ]
        );
      }
    }

    if (meetingIds.length > 0) {
      await client.query(
        "DELETE FROM meeting_items WHERE user_id = $1 AND NOT (id = ANY($2::text[]))",
        [userId, meetingIds]
      );
    } else {
      await client.query("DELETE FROM meeting_items WHERE user_id = $1", [userId]);
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      syncedAt: new Date().toISOString(),
      counts: {
        pages: pageIds.length,
        taskItems: taskIds.length,
        meetingItems: meetingIds.length,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
};

module.exports = { getWorkspace, syncWorkspace };
