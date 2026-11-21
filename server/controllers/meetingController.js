const { pool } = require("../db/pool");

function mapMeetingRow(row) {
  return {
    id: row.id,
    sourcePageId: row.source_page_id,
    sourceTitle: row.source_title,
    sourcePath: row.source_path,
    text: row.text,
    html: row.html,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

const getMeetings = async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM meeting_items WHERE user_id = $1 ORDER BY created_at ASC",
      [req.user]
    );
    res.json({ meetingItems: result.rows.map(mapMeetingRow) });
  } catch (error) {
    next(error);
  }
};

const createMeeting = async (req, res, next) => {
  try {
    const { id, sourcePageId = null, sourceTitle = "", sourcePath = "", text = "", html = "" } = req.body;
    const itemId = id || `mi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const result = await pool.query(
      `
        INSERT INTO meeting_items (id, user_id, source_page_id, source_title, source_path, text, html, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
        RETURNING *
      `,
      [itemId, req.user, sourcePageId, sourceTitle, sourcePath, text, html]
    );

    res.status(201).json({ item: mapMeetingRow(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

const updateMeeting = async (req, res, next) => {
  try {
    const existing = await pool.query(
      "SELECT * FROM meeting_items WHERE user_id = $1 AND id = $2",
      [req.user, req.params.id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: "Punto de reunión no encontrado" });
    }
    const cur = existing.rows[0];
    const { status, text, html } = req.body;

    const result = await pool.query(
      `
        UPDATE meeting_items
        SET status = $3, text = $4, html = $5, updated_at = now()
        WHERE user_id = $1 AND id = $2
        RETURNING *
      `,
      [
        req.user,
        req.params.id,
        status !== undefined ? status : cur.status,
        text !== undefined ? text : cur.text,
        html !== undefined ? html : cur.html,
      ]
    );

    res.json({ item: mapMeetingRow(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

const deleteMeeting = async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM meeting_items WHERE user_id = $1 AND id = $2 RETURNING id",
      [req.user, req.params.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: "Punto de reunión no encontrado" });
    }
    res.json({ deletedId: req.params.id });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMeetings, createMeeting, updateMeeting, deleteMeeting };
