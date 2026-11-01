import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BarCore } from '../shared/core.js';
import { BarRoom, cryptoRand } from './BarRoom.js';
import { Store } from './db.js';

export function createServer(store = new Store()) {
  BarRoom.store = store;
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    express: (app) => {
      app.use(express.json({ limit: '4kb' }));

      // 방장: 새 바 만들기 → 방 코드와 초대 토큰을 돌려준다. 방장은 이 토큰으로 첫 입장한다.
      app.post('/api/rooms', (req, res) => {
        const name = String(req.body?.name ?? '').trim();
        let code: string;
        do { code = makeCode(); } while (store.exists(code));
        const { state, secrets } = BarCore.create(code, name, Date.now(), cryptoRand);
        store.save(state, secrets);
        res.json({ code, inviteToken: secrets.inviteToken });
      });

      app.get('/api/rooms/:code', (req, res) => {
        const r = store.load(req.params.code);
        if (!r) return res.status(404).json({ error: '없는 바예요' });
        res.json({ name: r.state.name, members: Object.keys(r.state.members).length });
      });

      const dist = resolve(import.meta.dirname, '../client/dist');
      if (existsSync(dist)) app.use(express.static(dist));
    },
  });
  server.define('bar', BarRoom).filterBy(['code']);
  return server;
}

function makeCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(cryptoRand() * c.length)];
  return s;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const port = Number(process.env.PORT ?? 2567);
  createServer().listen(port).then(() => console.log(`아지트 서버 실행: http://localhost:${port}`));
}
