# Configuración para Tu Máquina - Ableton AI Control Bridge

## RESUMEN RÁPIDO

**Dos cosas que corren en TU PC:**
1. **Dev server Next.js** — http://localhost:[PUERTO] (mira cuál en tu terminal)
2. **Bridge Python** — http://127.0.0.1:8765 (comunicación con Ableton)

---

## PASO 1: Lanza el Bridge (SIN TOKEN)

**Windows CMD/PowerShell:**

1. Abre el Explorador
2. Navega a donde descargaste `ableton-ai-control-bridge`
3. **Haz doble clic en `start-bridge.bat`**

Deberías ver una ventana negra que dice:
```
WebSocket server listening on ws://127.0.0.1:8765
```

**Si ves error "No module named ableton_bridge":**
- El .bat intenta instalar automáticamente con `pip install -e .`
- Si sigue sin funcionar, abre CMD en esa carpeta y corre:
  ```
  pip install -e .
  start-bridge.bat
  ```

**✅ Si ves `listening on ws://127.0.0.1:8765` → El bridge está corriendo correctamente.**

---

## PASO 2: Abre tu Browser en el Dev Server

En tu browser, ve a:
```
http://localhost:[PUERTO]/test-tempo
```

**¿Cuál es tu puerto?** Mira el terminal donde corre `pnpm dev` o `npm dev`. Dirá algo como:
```
▲ Next.js 16.0.0
  ► Local:        http://localhost:4444
```

Copia ese puerto. Si es **4444**, ve a:
```
http://localhost:4444/test-tempo
```

---

## PASO 3: Prueba el Comando

En la página `/test-tempo`:

1. Haz clic en **132** (o el BPM que quieras)
2. Haz clic en **"Set 132 BPM in Ableton"**
3. **Mira Ableton Live** — el tempo debería cambiar a 132 en tiempo real

**Si ves error "Bridge unreachable":**
- Verifica que la ventana del bridge sigue abierta y dice `listening on ws://127.0.0.1:8765`
- Recarga la página (`F5` en el browser)
- Si sigue sin funcionar, abre DevTools (`F12`) y ve la pestaña **Console** — busca errores CORS

---

## PASO 4: Instala el Max for Live Device en Ableton

Para que Ableton reciba los comandos, necesita el device:

1. Ve a http://localhost:[PUERTO]/download-m4l
2. Descarga estos 3 archivos:
   - `AI-Control-Bridge-Receiver.maxpat`
   - `bridge_receiver.js`
   - `MAX_FOR_LIVE_SETUP.md`

3. Copia `AI-Control-Bridge-Receiver.maxpat` y `bridge_receiver.js` a:
   ```
   C:\Users\[TU-USUARIO]\AppData\Roaming\Ableton\Live 11\Max for Live\Patches\midifx\
   ```
   (Crea la carpeta si no existe)

4. Reinicia Ableton Live 11

5. En una pista **MIDI** (no audio), haz clic en "Add MIDI Effect" → busca "AI Control Bridge Receiver"

---

## DIAGRAMA DE PUERTOS

```
Tu PC:
  ┌─────────────────────────────────────┐
  │  Ableton Live 11 (track MIDI)        │
  │  ↑                                   │
  │  │ (Max for Live device recibe aquí) │
  │  │                                   │
  │  └─────────────────────────────────┘
           ↑
           │ UDP 127.0.0.1:9001
           │
  ┌─────────────────────────────────────┐
  │  Bridge Python                       │
  │  http://127.0.0.1:8765               │
  │  (escucha WebSocket/REST)            │
  │  ↑                                   │
  │  │ HTTP POST /command                │
  │  │                                   │
  │  └─────────────────────────────────┘
           ↑
           │ browser fetch()
           │
  ┌─────────────────────────────────────┐
  │  Browser (Chrome/Firefox)            │
  │  http://localhost:[PUERTO]/test-tempo│
  │  (TU MÁQUINA)                        │
  └─────────────────────────────────────┘
```

---

## CHECKLIST FINAL

- [ ] `start-bridge.bat` ejecutado → `listening on ws://127.0.0.1:8765` visible
- [ ] Browser abierto en `http://localhost:[PUERTO]/test-tempo`
- [ ] Página `/test-tempo` cargó sin errores
- [ ] Hiciste clic en 132 BPM
- [ ] Hiciste clic en "Set 132 BPM in Ableton"
- [ ] **Ableton cambió el tempo a 132** ✅

Si todo está en verde, **¡funciona!**

---

## TROUBLESHOOTING

| Problema | Solución |
|----------|----------|
| "Bridge unreachable" en `/test-tempo` | Verifica que `start-bridge.bat` está corriendo |
| Ableton no tiene el Max device | Descargalo de `/download-m4l` e instálalo correctamente |
| "No module named ableton_bridge" | Abre CMD en la carpeta del proyecto y corre `pip install -e .` |
| Ableton no recibe comandos | Verifica que el device MAX está en una pista **MIDI**, no Audio |
| CORS errors en DevTools | El bridge se relanzó correctamente, recarga el browser |

