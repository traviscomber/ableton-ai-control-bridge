# 🎯 ACCESO DESDE TU COMPUTADOR — URLS CORRECTAS

## TU MÁQUINA TIENE DOS SERVIDORES CORRIENDO

### Servidor 1: BRIDGE (127.0.0.1:8765)
**¿Para qué?** Comunica con Ableton vía MIDI/UDP

**Accedeés en el browser:**
```
http://127.0.0.1:8765/health
```

**Respuesta si funciona:**
```json
{
  "ok": true,
  "version": "0.4.2",
  "authentication_required": false
}
```

---

### Servidor 2: DEV SERVER (Next.js)
**¿Para qué?** La interfaz web, test-tempo, diagnostic, etc.

**¿En qué puerto corre?** Mira tu terminal donde corriste `pnpm dev` y busca:
```
▲ Next.js 16.x.x
- Local:        http://localhost:XXXX ← ESTE ES TU PUERTO
```

**Reemplaza XXXX con el número que ves (ej: 4444, 3000, 5000)**

---

## URLS DONDE ACCEDER EN TU BROWSER

| Qué quieres hacer | URL | Servidor |
|---|---|---|
| Cambiar tempo en Ableton | `http://localhost:XXXX/test-tempo` | Dev Server |
| Ver estado del sistema | `http://localhost:XXXX/diagnostic` | Dev Server |
| Aprobar/rechazar comandos | `http://localhost:XXXX/bridge/queue` | Dev Server |
| Ver historial | `http://localhost:XXXX/bridge/history` | Dev Server |
| Verificar bridge online | `http://127.0.0.1:8765/health` | Bridge |

---

## PASOS PARA ACCEDER CORRECTAMENTE

### Paso 1: Abre DOS TERMINALES

**Terminal 1 — Inicia el Bridge:**
```bash
python -m ableton_bridge
```
Verás: `Starting on http://127.0.0.1:8765`

**Terminal 2 — Inicia el Dev Server:**
```bash
pnpm dev
```
Verás: `Local: http://localhost:XXXX` ← **Apunta este número**

### Paso 2: En tu Browser, abre estas URLs

1. **Primero verifica que todo está online:**
   ```
   http://127.0.0.1:8765/health
   ```
   Debería decir `"ok": true`

2. **Luego abre la app de test:**
   ```
   http://localhost:XXXX/test-tempo
   ```
   (Reemplaza XXXX con tu número)

3. **Para debuggear:**
   ```
   http://localhost:XXXX/diagnostic
   ```

---

## EJEMPLO REAL

Si en tu terminal ves:
```
▲ Next.js 16.x.x
- Local:        http://localhost:4444
```

Entonces tus URLs son:

| Propósito | URL |
|---|---|
| Test tempo | `http://localhost:4444/test-tempo` |
| Diagnostic | `http://localhost:4444/diagnostic` |
| Bridge health | `http://127.0.0.1:8765/health` |

---

## SI NADA FUNCIONA

Corre este comando en tu terminal:
```bash
python bridge-diagnostic.py
```

Te mostrará exactamente qué está online y qué no.

---

**¿Cuál es el número que ves en tu terminal donde dice `localhost:XXXX`?**
