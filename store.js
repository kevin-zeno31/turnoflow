import { DatabaseSync } from 'node:sqlite';

export class QueueError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

export function openStore(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','active','done')),
      created_at TEXT NOT NULL,
      called_at TEXT,
      finished_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status,id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_one_active ON tickets(status) WHERE status='active';
    PRAGMA optimize;
  `);
  const present = row => row ? { ...row, code: `A-${String(row.id).padStart(3, '0')}` } : null;
  const byId = id => present(db.prepare('SELECT id,status,created_at,called_at,finished_at FROM tickets WHERE id=?').get(id));
  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = action(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return {
    create(key) {
      return transaction(() => {
        const existing = db.prepare('SELECT id FROM tickets WHERE request_key=?').get(key);
        if (existing) return byId(existing.id);
        const row = db.prepare('INSERT INTO tickets(request_key,created_at) VALUES (?,?)').run(key, new Date().toISOString());
        return byId(Number(row.lastInsertRowid));
      });
    },
    callNext() {
      return transaction(() => {
        if (db.prepare("SELECT id FROM tickets WHERE status='active'").get()) throw new QueueError('Finaliza la atención actual antes de llamar otro turno.');
        const next = db.prepare("SELECT id FROM tickets WHERE status='waiting' ORDER BY id LIMIT 1").get();
        if (!next) throw new QueueError('No hay turnos en espera.');
        db.prepare("UPDATE tickets SET status='active',called_at=? WHERE id=?").run(new Date().toISOString(), next.id);
        return byId(next.id);
      });
    },
    finish(id) {
      return transaction(() => {
        const ticket = byId(id);
        if (!ticket || ticket.status !== 'active') throw new QueueError('Ese turno ya no está en atención. Actualiza la vista.');
        db.prepare("UPDATE tickets SET status='done',finished_at=? WHERE id=?").run(new Date().toISOString(), id);
        return byId(id);
      });
    },
    snapshot() {
      return transaction(() => ({
        active: present(db.prepare("SELECT id,status,created_at,called_at,finished_at FROM tickets WHERE status='active'").get()),
        waiting: db.prepare("SELECT id,status,created_at,called_at,finished_at FROM tickets WHERE status='waiting' ORDER BY id LIMIT 100").all().map(present),
        waitingCount: db.prepare("SELECT count(*) AS count FROM tickets WHERE status='waiting'").get().count,
        doneCount: db.prepare("SELECT count(*) AS count FROM tickets WHERE status='done'").get().count,
        recent: db.prepare("SELECT id,status,created_at,called_at,finished_at FROM tickets WHERE status='done' ORDER BY id DESC LIMIT 5").all().map(present)
      }));
    },
    close() { db.close(); }
  };
}
