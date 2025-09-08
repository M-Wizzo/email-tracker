# Backend (email-tracker)

## Scripts
- dev: `nodemon server.js`
- start: `node server.js`

## Pruebas rápidas
Terminal A:
```bash
npm i
npm run dev
# espera el log "Backend on http://127.0.0.1:5055"
```

Terminal B:
```bash
curl -s http://127.0.0.1:5055/api/health
```

Crear email:
```bash
ID="demo-$(date +%s)"
curl -s -X POST http://127.0.0.1:5055/api/emails \
  -H "Content-Type: application/json" -H "x-api-key: dev-123" \
  -d "{\"id\":\"$ID\",\"subject\":\"Prueba MVP\",\"recipient\":\"test@example.com\"}"
```

Registrar apertura:
```bash
open "http://127.0.0.1:5055/pixel?id=$ID"
```

Ver listado:
```bash
curl -s http://127.0.0.1:5055/api/emails -H "x-api-key: dev-123"
```
