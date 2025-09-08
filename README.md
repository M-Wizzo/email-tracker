# email-tracker

Monorepo con:
- backend: Node + Express + SQLite (better-sqlite3)
- frontend: Next.js (App Router) + Tailwind CSS

## Puertos
- Backend: http://127.0.0.1:5055
- Frontend: http://127.0.0.1:4000

## Arranque rápido
Terminal A:
```bash
cd backend
npm i
npm run dev
# espera el log "Backend on http://127.0.0.1:5055"
```

Terminal B (pruebas automáticas):
```bash
# Health
curl -s http://127.0.0.1:5055/api/health
```

ID="demo-$(date +%s)"
curl -s -X POST http://127.0.0.1:5055/api/emails \
  -H "Content-Type: application/json" -H "x-api-key: dev-123" \
  -d "{\"id\":\"$ID\",\"subject\":\"MVP Test\",\"recipient\":\"test@example.com\"}"

Registrar apertura (pixel 1x1):
```bash
open "http://127.0.0.1:5055/pixel?id=$ID"
```

Ver listado agregado:
```bash
curl -s http://127.0.0.1:5055/api/emails -H "x-api-key: dev-123"
```

Frontend:
```bash
cd frontend
npm i
npm run dev
# abre http://127.0.0.1:4000
```

## Notas
- Usa siempre 127.0.0.1 (no localhost) para evitar IPv6 (::1).
- Si un puerto parece colgado:
```bash
lsof -n -P -iTCP:5055 -sTCP:LISTEN
kill -9 <PID>
# o para el frontend
lsof -n -P -iTCP:4000 -sTCP:LISTEN
kill -9 <PID>
```
- El pixel responde 200 con PNG 1x1 (no se ve, es normal).
- Para n8n: crea id (UUID), POST a /api/emails, inserta `<img src="http://127.0.0.1:5055/pixel?id={{id}}">` y reescribe enlaces a `http://127.0.0.1:5055/click?id={{id}}&url={{encodeURIComponent(destino)}}`.
