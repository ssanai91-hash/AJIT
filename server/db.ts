// 방 저장소 (SQLite, Node 22 내장 모듈). 방은 아무도 없어도 계속 존재해야 하므로 상태를 통째로 저장한다.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BarState, ChatLine, Secrets } from '../shared/core.js';

export class Store {
  private db: DatabaseSync;

  constructor(file = process.env.AJIT_DB ?? 'data/ajit.db') {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        secrets TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat (
        code TEXT NOT NULL,
        id INTEGER NOT NULL,
        member_id TEXT,
        nick TEXT,
        text TEXT NOT NULL,
        system INTEGER NOT NULL DEFAULT 0,
        at INTEGER NOT NULL,
        PRIMARY KEY (code, id)
      );
    `);
  }

  exists(code: string) {
    return !!this.db.prepare('SELECT 1 FROM rooms WHERE code = ?').get(code);
  }

  load(code: string): { state: BarState; secrets: Secrets } | null {
    const r = this.db.prepare('SELECT state, secrets FROM rooms WHERE code = ?').get(code) as any;
    return r ? { state: JSON.parse(r.state), secrets: JSON.parse(r.secrets) } : null;
  }

  save(state: BarState, secrets: Secrets) {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO rooms (code, state, secrets, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET state = excluded.state, secrets = excluded.secrets, updated_at = excluded.updated_at
    `).run(state.code, JSON.stringify(state), JSON.stringify(secrets), now, now);
  }

  /** 채팅 전체 기록 (상태에는 최근 50개만 있음) */
  appendChat(code: string, lines: ChatLine[]) {
    const st = this.db.prepare('INSERT OR IGNORE INTO chat (code, id, member_id, nick, text, system, at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const l of lines) st.run(code, l.id, l.memberId, l.nick, l.text, l.system ? 1 : 0, l.at);
  }

  chatHistory(code: string, beforeId: number, limit = 50): ChatLine[] {
    const rows = this.db.prepare(
      'SELECT id, member_id, nick, text, system, at FROM chat WHERE code = ? AND id < ? ORDER BY id DESC LIMIT ?'
    ).all(code, beforeId, limit) as any[];
    return rows.reverse().map(r => ({ id: r.id, memberId: r.member_id, nick: r.nick, text: r.text, at: r.at, system: !!r.system }));
  }
}
