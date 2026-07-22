# Windows + Ableton Live 11: instalación completa en el Escritorio

Esta es la ruta recomendada. El instalador crea una única carpeta:

```text
Escritorio\Ableton AI Control Bridge
```

Dentro quedan el código, Python, configuración, token, historial, scripts de
inicio, diagnóstico y dispositivo Max. Live 11 utiliza el Max for Live incluido
cuando la licencia lo incorpora; Live Suite no necesita instalar Max aparte.

## 1. Requisitos

- Windows 10 u 11.
- Ableton Live 11 Suite, o Live 11 con licencia de Max for Live.
- Python 3.10 o posterior desde python.org, incluyendo el launcher `py`.
- El repositorio descargado y descomprimido.

## 2. Instalar todo en el Escritorio

Abre la carpeta descargada, haz clic derecho en un espacio vacío y selecciona
**Abrir en Terminal**. Ejecuta:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\windows\install.ps1
```

El instalador crea en el Escritorio:

```text
Ableton AI Control Bridge\
├── START BRIDGE.cmd
├── CHECK INSTALLATION.cmd
├── OPEN MAX DEVICE SOURCE.cmd
├── config.json
├── data\history.sqlite3
├── Max for Live Device\
│   ├── AI-Control-Bridge-Receiver.maxpat
│   ├── bridge_receiver.js
│   └── AI Control Bridge Receiver.amxd  ← se crea una vez desde Max
├── .venv\
├── ableton_bridge\
├── docs\
├── examples\
└── tests\
```

El token se genera aleatoriamente y permanece en `config.json`. La aprobación
manual queda activa por defecto.

## 3. Crear el `.amxd` una sola vez

1. Abre Live 11 y crea un Live Set vacío.
2. Añade un **Max MIDI Effect** vacío a una pista MIDI.
3. Pulsa **Edit** para abrir el Max incluido con Live.
4. En Max selecciona **File → Open**.
5. Abre:

```text
Escritorio\Ableton AI Control Bridge\Max for Live Device\
AI-Control-Bridge-Receiver.maxpat
```

6. Revisa que la consola de Max no muestre errores.
7. Selecciona **File → Save As** y guarda:

```text
Escritorio\Ableton AI Control Bridge\Max for Live Device\
AI Control Bridge Receiver.amxd
```

8. Si Max muestra la opción, congela el dispositivo para incorporar
   `bridge_receiver.js`.
9. Regresa a Live y arrastra el `.amxd` desde el Escritorio a una pista MIDI.

Este paso es inevitable: `.amxd` es un documento generado por Max for Live y
solo la versión de Max incluida en tu instalación puede guardarlo y validarlo.

## 4. Arrancar con doble clic

Dentro de `Escritorio\Ableton AI Control Bridge`, haz doble clic en:

```text
START BRIDGE.cmd
```

Se abre `http://127.0.0.1:8765`. Cuando la interfaz solicite el token, abre
`config.json` con Notepad y copia el valor de `token`.

## 5. Primera prueba

Con Live abierto y el `.amxd` cargado, envía `set_tempo` desde PowerShell:

```powershell
$root = Join-Path ([Environment]::GetFolderPath("Desktop")) "Ableton AI Control Bridge"
$config = Get-Content (Join-Path $root "config.json") | ConvertFrom-Json
$headers = @{ "X-Bridge-Token" = $config.token }
$body = @{ type = "set_tempo"; bpm = 126 } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8765/command -Method Post -Headers $headers -ContentType "application/json" -Body $body
```

En la interfaz:

1. Verás el comando como `pending`.
2. Pulsa **Approve**.
3. Live debe cambiar a 126 BPM.
4. El estado debe pasar a `acknowledged`.

## Diagnóstico con doble clic

Ejecuta:

```text
CHECK INSTALLATION.cmd
```

Comprueba Live 11, Python, configuración, source Max, JavaScript, `.amxd`,
puerto HTTP y las pruebas automáticas.

## Problemas comunes

### PowerShell bloquea los scripts

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

Solo afecta la terminal actual.

### Windows no abre el `.maxpat`

No necesitas asociarlo manualmente. Abre Live 11, edita un Max MIDI Effect y
usa **File → Open** desde Max.

### El estado queda en `sent`

- Confirma que el `.amxd` esté cargado en el Live Set actual.
- Comprueba que `bridge_receiver.js` esté junto al `.amxd`.
- Abre la consola Max y busca mensajes `ableton-ai-bridge`.
- Ejecuta `CHECK INSTALLATION.cmd`.

### `Device not found` o `Parameter not found`

Los nombres deben coincidir con Live. Los parámetros son sensibles a mayúsculas;
las macros de Rack no.

## Referencias oficiales

- [Max for Live incluido con Live](https://help.ableton.com/hc/en-us/articles/360000036850-Max-for-Live-bundled-in-Live)
- [LiveAPI de Cycling '74](https://docs.cycling74.com/max8/vignettes/live_api_overview)
- [Live Object Model](https://docs.cycling74.com/max8/vignettes/live_object_model)
