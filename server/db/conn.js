const { Client } = require("pg");
const { pool, getPgConfigFromEnv } = require("./pool");
const { ensureSchema } = require("./schema");

async function ensureDatabaseExists() {
  const cfg = getPgConfigFromEnv();
  let targetDb = cfg.database;
  let adminConfig;

  if (cfg.connectionString) {
    const url = new URL(cfg.connectionString);
    targetDb = url.pathname.replace(/^\//, "");
    url.pathname = "/postgres";
    adminConfig = { connectionString: url.toString() };
  } else {
    adminConfig = { ...cfg, database: "postgres" };
  }

  if (!targetDb || !/^[a-zA-Z0-9_]+$/.test(targetDb)) {
    return;
  }

  const adminClient = new Client(adminConfig);
  try {
    await adminClient.connect();
    const exists = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDb]
    );
    if (!exists.rowCount) {
      console.log(`[DB] Creando base de datos "${targetDb}" automáticamente...`);
      await adminClient.query(`CREATE DATABASE "${targetDb}"`);
    }
  } finally {
    await adminClient.end().catch(() => {});
  }
}

const connectDB = async () => {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    // 3D000 = invalid_catalog_name (la base de datos aún no existe)
    if (err && err.code === "3D000") {
      await ensureDatabaseExists();
      await pool.query("SELECT 1");
    } else {
      throw err;
    }
  }

  await ensureSchema(pool);

  if (process.env.DEBUG_DB === "1") {
    try {
      const info = await pool.query(`
        SELECT
          current_database() AS db,
          current_schema() AS schema,
          inet_server_addr() AS server_addr,
          inet_server_port() AS server_port
      `);
      const counts = await pool.query(`SELECT COUNT(*)::int AS users_count FROM users`);
      console.log("[DB] connected", { ...info.rows[0], ...counts.rows[0] });
    } catch (e) {
      console.log("[DB] debug query failed", { message: e?.message });
    }
  }

  return pool;
};

module.exports = connectDB;
