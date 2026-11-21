const { pool } = require("../db/pool");

function mapPageRow(row) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    parentId: row.parent_id,
    order: row.sort_order,
    content: row.content,
    isFavorite: row.is_favorite,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

const getNotes = async (req, res, next) => {
  try {
    const { q } = req.query;
    let result;

    if (q && q.trim()) {
      const pattern = `%${q.trim()}%`;
      result = await pool.query(
        `
          SELECT id, title, icon, parent_id, sort_order, content, is_favorite, created_at, updated_at
          FROM pages
          WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
          ORDER BY parent_id NULLS FIRST, sort_order ASC, created_at ASC
        `,
        [req.user, pattern]
      );
    } else {
      result = await pool.query(
        `
          SELECT id, title, icon, parent_id, sort_order, content, is_favorite, created_at, updated_at
          FROM pages
          WHERE user_id = $1
          ORDER BY parent_id NULLS FIRST, sort_order ASC, created_at ASC
        `,
        [req.user]
      );
    }

    res.json({ notes: result.rows.map(mapPageRow) });
  } catch (error) {
    next(error);
  }
};

const getNoteById = async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT id, title, icon, parent_id, sort_order, content, is_favorite, created_at, updated_at
        FROM pages
        WHERE user_id = $1 AND id = $2
      `,
      [req.user, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Nota no encontrada" });
    }

    res.json({ note: mapPageRow(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

const createNote = async (req, res, next) => {
  try {
    const {
      id,
      title = "Sin título",
      icon = "📄",
      parentId = null,
      order = 0,
      content = "<p><br></p>",
      isFavorite = false,
    } = req.body;

    const noteId = id || `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const result = await pool.query(
      `
        INSERT INTO pages (id, user_id, title, icon, parent_id, sort_order, content, is_favorite)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, title, icon, parent_id, sort_order, content, is_favorite, created_at, updated_at
      `,
      [noteId, req.user, title, icon, parentId, Number(order) || 0, content, Boolean(isFavorite)]
    );

    res.status(201).json({ note: mapPageRow(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

const updateNote = async (req, res, next) => {
  try {
    const { title, icon, parentId, order, content, isFavorite } = req.body;

    const existing = await pool.query(
      "SELECT * FROM pages WHERE user_id = $1 AND id = $2",
      [req.user, req.params.id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: "Nota no encontrada" });
    }

    const current = existing.rows[0];
    const result = await pool.query(
      `
        UPDATE pages
        SET
          title = $3,
          icon = $4,
          parent_id = $5,
          sort_order = $6,
          content = $7,
          is_favorite = $8,
          updated_at = now()
        WHERE user_id = $1 AND id = $2
        RETURNING id, title, icon, parent_id, sort_order, content, is_favorite, created_at, updated_at
      `,
      [
        req.user,
        req.params.id,
        title !== undefined ? title : current.title,
        icon !== undefined ? icon : current.icon,
        parentId !== undefined ? parentId : current.parent_id,
        order !== undefined ? Number(order) : current.sort_order,
        content !== undefined ? content : current.content,
        isFavorite !== undefined ? Boolean(isFavorite) : current.is_favorite,
      ]
    );

    res.json({ note: mapPageRow(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

const toggleFavorite = async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE pages
        SET is_favorite = NOT is_favorite, updated_at = now()
        WHERE user_id = $1 AND id = $2
        RETURNING id, is_favorite
      `,
      [req.user, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Nota no encontrada" });
    }

    res.json({ id: result.rows[0].id, isFavorite: result.rows[0].is_favorite });
  } catch (error) {
    next(error);
  }
};

const deleteNote = async (req, res, next) => {
  try {
    // Delete the page and all of its descendants recursively
    const result = await pool.query(
      `
        WITH RECURSIVE subtree AS (
          SELECT id FROM pages WHERE user_id = $1 AND id = $2
          UNION ALL
          SELECT p.id FROM pages p
          INNER JOIN subtree s ON p.parent_id = s.id
          WHERE p.user_id = $1
        )
        DELETE FROM pages
        WHERE user_id = $1 AND id IN (SELECT id FROM subtree)
        RETURNING id
      `,
      [req.user, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Nota no encontrada" });
    }

    res.json({ deletedIds: result.rows.map((r) => r.id) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  toggleFavorite,
  deleteNote,
  mapPageRow,
};
