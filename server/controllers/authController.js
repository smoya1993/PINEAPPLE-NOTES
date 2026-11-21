const { randomUUID } = require("crypto");
const { pool } = require("../db/pool");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      UserInfo: {
        userId: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles || ["BasicUser"],
      },
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "30m" }
  );
}

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const cleanEmail = email?.trim().toLowerCase();
    const cleanName = name?.trim() || "";

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ message: "Nombre, email y contraseña son requeridos" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    const duplicate = await pool.query("SELECT 1 FROM users WHERE email = $1", [cleanEmail]);
    if (duplicate.rowCount) {
      return res.status(409).json({ message: "Ya existe una cuenta con ese email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    await pool.query(
      `
        INSERT INTO users (id, name, email, password, roles, is_disabled, refresh_token, active_page_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [userId, cleanName, cleanEmail, hashedPassword, ["BasicUser"], false, "", "welcome"]
    );

    res.status(201).json({
      success: true,
      message: "Usuario registrado correctamente",
      user: { id: userId, name: cleanName, email: cleanEmail },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: "Email y contraseña son requeridos" });
    }

    const found = await pool.query("SELECT * FROM users WHERE email = $1", [cleanEmail]);
    const foundUser = found.rows[0];

    if (!foundUser) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    if (foundUser.is_disabled) {
      return res.status(403).json({ message: "Cuenta deshabilitada" });
    }

    const match = await bcrypt.compare(password, String(foundUser.password ?? ""));
    if (!match) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const accessToken = signAccessToken(foundUser);
    const refreshToken = jwt.sign(
      { userId: foundUser.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    await pool.query("UPDATE users SET refresh_token = $1, updated_at = now() WHERE id = $2", [
      refreshToken,
      foundUser.id,
    ]);

    res.cookie("jwt", refreshToken, getCookieOptions());

    res.json({
      accessToken,
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        roles: foundUser.roles || ["BasicUser"],
      },
    });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = cookies.jwt;
    const found = await pool.query("SELECT * FROM users WHERE refresh_token = $1", [token]);
    const foundUser = found.rows[0];

    if (!foundUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
      if (err || foundUser.id !== decoded.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const accessToken = signAccessToken(foundUser);
      res.json({
        accessToken,
        user: {
          id: foundUser.id,
          name: foundUser.name,
          email: foundUser.email,
          roles: foundUser.roles || ["BasicUser"],
        },
      });
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const cookies = req.cookies;
    const clearOpts = getCookieOptions();
    delete clearOpts.maxAge;

    if (!cookies?.jwt) {
      return res.sendStatus(204);
    }

    const token = cookies.jwt;
    const found = await pool.query("SELECT id FROM users WHERE refresh_token = $1", [token]);
    const foundUser = found.rows[0];

    if (foundUser) {
      await pool.query("UPDATE users SET refresh_token = '', updated_at = now() WHERE id = $1", [
        foundUser.id,
      ]);
    }

    res.clearCookie("jwt", clearOpts);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const found = await pool.query(
      "SELECT id, name, email, roles, active_page_id, created_at FROM users WHERE id = $1",
      [req.user]
    );
    if (!found.rowCount) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json({ user: found.rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, refreshToken, logout, me };
