const { pool } = require("../db/pool");

function mapTaskRow(row) {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
  };
}

const getTasks = async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM task_items WHERE user_id = $1 ORDER BY created_at ASC",
      [req.user]
    );
    res.json({ tasks: result.rows.map(mapTaskRow) });
  } catch (error) {
    next(error);
  }
};

const createTask = async (req, res, next) => {
  try {
    const { id, title, details = "", priority = "normal", dueDate = "" } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ message: "El título de la tarea es requerido" });
    }
    const taskId = id || `task_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const result = await pool.query(
      `
        INSERT INTO task_items (id, user_id, title, details, priority, due_date, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING *
      `,
      [taskId, req.user, title.trim(), details.trim(), priority, dueDate]
    );

    res.status(201).json({ task: mapTaskRow(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const existing = await pool.query(
      "SELECT * FROM task_items WHERE user_id = $1 AND id = $2",
      [req.user, req.params.id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    const cur = existing.rows[0];
    const { title, details, priority, dueDate, status } = req.body;
    const nextStatus = status !== undefined ? status : cur.status;
    const completedAt =
      nextStatus === "done"
        ? cur.completed_at || new Date()
        : null;

    const result = await pool.query(
      `
        UPDATE task_items
        SET
          title = $3,
          details = $4,
          priority = $5,
          due_date = $6,
          status = $7,
          completed_at = $8,
          updated_at = now()
        WHERE user_id = $1 AND id = $2
        RETURNING *
      `,
      [
        req.user,
        req.params.id,
        title !== undefined ? title.trim() : cur.title,
        details !== undefined ? details.trim() : cur.details,
        priority !== undefined ? priority : cur.priority,
        dueDate !== undefined ? dueDate : cur.due_date,
        nextStatus,
        completedAt,
      ]
    );

    res.json({ task: mapTaskRow(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM task_items WHERE user_id = $1 AND id = $2 RETURNING id",
      [req.user, req.params.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }
    res.json({ deletedId: req.params.id });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTasks, createTask, updateTask, deleteTask };
