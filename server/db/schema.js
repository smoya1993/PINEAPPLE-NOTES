async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      name text NOT NULL DEFAULT '',
      email text UNIQUE NOT NULL,
      password text NOT NULL,
      roles text[] NOT NULL DEFAULT ARRAY['BasicUser'],
      is_disabled boolean NOT NULL DEFAULT false,
      refresh_token text NOT NULL DEFAULT '',
      active_page_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pages (
      id text NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL DEFAULT 'Sin título',
      icon text NOT NULL DEFAULT '📄',
      parent_id text,
      sort_order integer NOT NULL DEFAULT 0,
      content text NOT NULL DEFAULT '<p><br></p>',
      is_favorite boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_items (
      id text NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      details text NOT NULL DEFAULT '',
      priority text NOT NULL DEFAULT 'normal',
      due_date text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      PRIMARY KEY (user_id, id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_items (
      id text NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_page_id text,
      source_title text NOT NULL DEFAULT '',
      source_path text NOT NULL DEFAULT '',
      text text NOT NULL DEFAULT '',
      html text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS images (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename text NOT NULL,
      mime_type text NOT NULL,
      data bytea NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pages_user_parent ON pages(user_id, parent_id, sort_order);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pages_user_favorite ON pages(user_id, is_favorite) WHERE is_favorite = true;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON task_items(user_id, status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meetings_user_status ON meeting_items(user_id, status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);`);
}

module.exports = { ensureSchema };
