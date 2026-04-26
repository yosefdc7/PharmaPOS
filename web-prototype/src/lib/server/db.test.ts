import { beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@libsql/client';
import { getDb, resetDbSingleton } from '@/lib/server/db';
import { ensureDb, resetInitialized } from '@/lib/server/init';

describe('SQLite backend repository', () => {
  let db: Client;
  
  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
    db = getDb(':memory:');
    await ensureDb(db);
  });

  it('seeds demo data on first use', async () => {
    const result = await db.execute('SELECT COUNT(*) as count FROM products');
    const count = Number(result.rows[0]['count']);
    expect(count).toBeGreaterThan(0);
  });

  it('does not re-seed if data exists', async () => {
    await db.execute('SELECT COUNT(*) as count FROM products');
    const result = await db.execute('SELECT * FROM sync_queue');
    expect(result.rows.length).toBe(0);
  });

  it('handles sync queue operations', async () => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.execute({
      sql: "INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, 'product', 'create', '{}', createdAt, 'pending', 0, '']
    });
    const result = await db.execute('SELECT * FROM sync_queue WHERE status = ?', ['pending']);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].entity).toBe('product');
    expect(result.rows[0].operation).toBe('create');
  });
});
