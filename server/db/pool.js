const { Pool } = require("pg");

function parsePostgresJdbcUri(jdbcUri) {
  // Expected: jdbc:postgresql://host:port/database?params
  if (!jdbcUri || typeof jdbcUri !== "string") return null;
  if (!jdbcUri.startsWith("jdbc:postgresql://")) return null;

  const withoutPrefix = jdbcUri.replace(/^jdbc:postgresql:\/\//, "");
  const [hostPort, dbAndQuery = ""] = withoutPrefix.split("/", 2);
  const [database] = dbAndQuery.split("?", 1);

  const [host, portStr] = hostPort.split(":", 2);
  const port = portStr ? Number(portStr) : 5432;

  if (!host || !database || Number.isNaN(port)) return null;

  return { host, port, database };
}

function getPgConfigFromEnv() {
  const uri = process.env.POSTGRES_URI || process.env.DATABASE_URL;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;

  const jdbc = parsePostgresJdbcUri(uri);
  if (jdbc) {
    return {
      host: jdbc.host,
      port: jdbc.port,
      database: jdbc.database,
      user,
      password,
    };
  }

  if (uri && (uri.startsWith("postgres://") || uri.startsWith("postgresql://"))) {
    return {
      connectionString: uri,
    };
  }

  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "pineapple_notes",
    user: user || process.env.PGUSER || "postgres",
    password: password || process.env.PGPASSWORD || "",
  };
}

const pool = new Pool(getPgConfigFromEnv());

module.exports = { pool, parsePostgresJdbcUri, getPgConfigFromEnv };
