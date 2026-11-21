const { randomUUID } = require("crypto");
const { pool } = require("../db/pool");

const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se recibió ninguna imagen" });
    }

    const id = randomUUID();
    const filename = req.file.originalname || `${id}.png`;
    const mimeType = req.file.mimetype || "application/octet-stream";

    await pool.query(
      `
        INSERT INTO images (id, user_id, filename, mime_type, data)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [id, req.user, filename, mimeType, req.file.buffer]
    );

    res.status(201).json({
      id,
      filename,
      mimeType,
      url: `/api/images/${id}`,
    });
  } catch (error) {
    next(error);
  }
};

const getImage = async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT filename, mime_type, data FROM images WHERE id = $1",
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Imagen no encontrada" });
    }

    const img = result.rows[0];
    res.setHeader("Content-Type", img.mime_type);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(img.data);
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadImage, getImage };
