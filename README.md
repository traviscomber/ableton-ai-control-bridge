# Ableton AI Control Bridge

Puente local y auditable para controlar **Ableton Live** mediante comandos JSON generados por una IA, un agente o cualquier cliente HTTP.

La aplicación traduce instrucciones estructuradas recibidas por HTTP, las valida y las envía por UDP a un dispositivo de Max for Live. Ese dispositivo utiliza la Live API para ejecutar acciones dentro de Ableton Live.

```text
IA / agente / aplicación
          ↓ JSON por HTTP
Ableton AI Control Bridge (Python)
          ↓ JSON por UDP
Receptor Max for Live
          ↓ Live API
Ableton Live
```

## ¿Para qué sirve?

El proyecto permite construir flujos donde una IA puede proponer o ejecutar acciones musicales explícitas, por ejemplo:

- Cambiar el tempo de una sesión.
- Lanzar escenas o detener todos los clips.
- Crear pistas MIDI o de audio.
- Ajustar volumen, panorama, macros y parámetros de dispositivos.
- Crear clips MIDI con notas, duración y velocidad definidas.
- Generar secuencias completas como JSONL para revisarlas antes de enviarlas a Ableton.

Cada acción se representa como JSON legible. El objetivo no es generar archivos `.als` de forma opaca ni controlar Ableton mediante automatizaciones frágiles de pantalla, sino utilizar un protocolo pequeño, verificable y extensible.

## Estado actual

**Beta técnica / versión 0.4.0, optimizada para Windows + Live 11.**

La v0.4 amplía el bridge de control a **composición de canciones por escenas**:
transporte, compás, metrónomo, loops, escenas, pistas, clips, mezcla, nombres y
colores pueden combinarse con la creación de notas MIDI en planes JSONL revisables.

| Componente | Estado |
| --- | --- |
| Servidor HTTP en Python | Funcional |
| Validación de comandos | Funcional |
| Transporte UDP | Funcional |
| CLI para enviar comandos | Funcional |
| Modo de simulación (`--dry-run`) | Funcional |
| Pruebas unitarias | Incluidas |
| Receptor Max for Live | Fuente `.maxpat` y motor LiveAPI incluidos |
| Dispositivo `.amxd` listo para instalar | Pendiente |

> El bridge Python y el source del receptor están disponibles. Max for Live debe abrir el `.maxpat` y guardarlo como `AI Control Bridge Receiver.amxd`; un `.amxd` válido no puede generarse ni verificarse fuera de Max. Sigue [`max-for-live/device-build-guide.md`](max-for-live/device-build-guide.md).

## Requisitos

- Python 3.10 o superior.
- Ableton Live con Max for Live para la integración real.
- No requiere VSTs de terceros.
- Todo funciona localmente; no necesita una API key para ejecutar el bridge.

## Instalación rápida

### Windows + Ableton Live 11 — recomendado

El instalador deja **todo** dentro de `Escritorio\Ableton AI Control Bridge`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\windows\install.ps1
```

Después sigue la guía específica: [`docs/windows-live11.md`](docs/windows-live11.md).
Al finalizar tendrás tres launchers de doble clic: `START BRIDGE.cmd`,
`CHECK INSTALLATION.cmd` y `OPEN MAX DEVICE SOURCE.cmd`.
Si Python no está instalado, el script intenta instalar Python 3.12
automáticamente mediante `winget`.

### macOS o Linux

```bash
git clone https://github.com/traviscomber/ableton-ai-control-bridge.git
cd ableton-ai-control-bridge
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```

### Instalación Python manual en Windows

```powershell
git clone https://github.com/traviscomber/ableton-ai-control-bridge.git
cd ableton-ai-control-bridge
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
```

## Primer inicio

Ejecuta el servidor:

```bash
python -m ableton_bridge.server --token "change-this-token" --require-approval
```

Por defecto abre el endpoint HTTP local:

```text
http://127.0.0.1:8765
```

y reenvía los comandos al receptor Max for Live mediante:

```text
UDP 127.0.0.1:9001
```

Comprueba que el bridge está activo:

```bash
curl http://127.0.0.1:8765/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "dry_run": false,
  "commands_forwarded": 0,
  "udp_host": "127.0.0.1",
  "udp_port": 9001
}
```

## Probar sin Ableton

El modo `dry-run` valida, registra y contabiliza comandos, pero no los envía por UDP. Es la forma recomendada de probar integraciones de IA antes de permitir que controlen una sesión real.

```bash
python -m ableton_bridge.server --dry-run
```

En otra terminal:

```bash
curl -X POST http://127.0.0.1:8765/command \
  -H "Content-Type: application/json" \
  -d '{"type":"set_tempo","bpm":132}'
```

El servidor responderá con HTTP `202` e indicará `"forwarded": false`.

## Conectar Ableton Live

1. Abre `max-for-live/AI-Control-Bridge-Receiver.maxpat` desde Max for Live.
2. Verifica que encuentre `bridge_receiver.js`.
3. Guárdalo como `AI Control Bridge Receiver.amxd` o congela el dispositivo.
4. Colócalo en una pista y deja el bridge Python ejecutándose.

La lista de objetos Max, rutas de la Live API y orden recomendado de implementación está en [`max-for-live/device-build-guide.md`](max-for-live/device-build-guide.md).

## Formas de enviar comandos

### Con `curl`

```bash
curl -X POST http://127.0.0.1:8765/command \
  -H "Content-Type: application/json" \
  -d '{"type":"launch_scene","scene":0}'
```

### Con la CLI incluida

Después de instalar el proyecto con `pip install -e .`:

```bash
ableton-bridge-send --token "change-this-token" '{"type":"set_tempo","bpm":132}'
```

También puedes utilizar directamente el módulo Python:

```bash
python -m ableton_bridge.cli --token "change-this-token" '{"type":"set_macro","track":1,"macro":1,"value":0.8}'
```

### Desde un archivo JSON

```bash
ableton-bridge-send --token "change-this-token" examples/commands/create_bass_clip.json
```

## Comandos soportados

Los índices de pistas y escenas comienzan en `0`. Los índices de macros comienzan en `1`.

| Comando | Función | Campos requeridos |
| --- | --- | --- |
| `set_tempo` | Cambia el tempo | `bpm` entre 20 y 300 |
| `launch_scene` | Lanza una escena | `scene` |
| `stop_all_clips` | Detiene todos los clips | Ninguno |
| `set_track_volume` | Ajusta el volumen de una pista | `track`, `volume` de 0 a 1 |
| `set_track_pan` | Ajusta el panorama | `track`, `pan` de -1 a 1 |
| `set_macro` | Ajusta una macro de rack | `track`, `macro` de 1 a 16, `value` de 0 a 1 |
| `create_midi_clip` | Crea un clip con notas MIDI | `track`, `clip`, `bar`, `beats`, `notes` |
| `create_audio_track` | Crea una pista de audio | `name`; `index` es opcional |
| `create_midi_track` | Crea una pista MIDI | `name`; `index` es opcional |
| `arm_track` | Arma o desarma una pista | `track`, `armed` |
| `set_device_parameter` | Ajusta un parámetro de dispositivo | `track`, `device`, `parameter`, `value` |
| `start_playback` / `stop_playback` | Controla el transporte | Ninguno |
| `set_time_signature` | Define el compás | `numerator`, `denominator` |
| `set_metronome` | Activa el metrónomo | `enabled` |
| `set_song_loop` | Configura el loop global | `start`, `length`, `enabled` |
| `create_scene` | Crea y nombra una sección | `name` e `index` opcionales |
| `duplicate_scene` / `delete_scene` | Gestiona escenas | `scene` |
| `duplicate_track` / `delete_track` | Gestiona pistas | `track` |
| `set_track_mute` / `set_track_solo` | Controla mezcla por pista | `track`, `muted` o `soloed` |
| `launch_clip` | Lanza un clip | `track`, `clip` |
| `stop_track_clips` | Detiene los clips de una pista | `track` |
| `set_clip_name` / `set_clip_color` | Organiza clips | `track`, `clip`, `name` o `color` |
| `set_clip_loop` | Define el loop de un clip | `track`, `clip`, `start`, `length`, `enabled` |

Ejemplo de clip MIDI:

```json
{
  "type": "create_midi_clip",
  "track": 1,
  "clip": 0,
  "bar": 1,
  "beats": 8,
  "notes": [
    {"pitch": 41, "start": 0.0, "duration": 0.5, "velocity": 105},
    {"pitch": 44, "start": 1.0, "duration": 0.5, "velocity": 96}
  ]
}
```

La especificación y más ejemplos están en [`docs/protocol.md`](docs/protocol.md).

## Darksco: compositor IA

Darksco convierte una intención musical en un `SongPlan` validable y después en
comandos del bridge. Puede trabajar como copiloto, productor de un track completo
o compositor autónomo por sesión. Consulta [`docs/darksco.md`](docs/darksco.md).

Primer track autónomo incluido:

```powershell
darksco-compile examples/darksco/first-autonomous-track.json --output examples/darksco/first-autonomous-track.jsonl
ableton-bridge-run examples/darksco/first-autonomous-track.jsonl --validate-only
```

Para una sesión autónoma explícita, inicia el bridge, deja el receptor cargado y
usa `--auto-approve`. Esta opción aprueba solamente los comandos del archivo
enviado y sigue respetando el token y la allowlist:

```powershell
$token = (Get-Content .\config.json | ConvertFrom-Json).token
ableton-bridge-run examples/darksco/first-autonomous-track.jsonl --token $token --auto-approve --delay 0.15
```

## Integración con una IA

El modelo o agente no necesita acceso directo a Ableton. Solo debe producir comandos compatibles y enviarlos al endpoint local.

Prompt básico recomendado:

```text
Genera comandos para Ableton Live.
Devuelve un objeto JSON por línea y no incluyas explicaciones.
Usa únicamente los comandos definidos en docs/protocol.md.
Las pistas y escenas comienzan en 0; las macros comienzan en 1.
```

Ejemplo de petición creativa:

```text
Crea una secuencia a 132 BPM. Añade una pista MIDI de bajo y genera
un patrón de dos compases. Abre gradualmente la macro 1 entre las
secciones. Devuelve JSONL solamente.
```

Antes de ejecutar comandos generados automáticamente en una sesión importante:

1. Revísalos visualmente.
2. Ejecútalos primero con `--dry-run`.
3. Guarda una copia del Live Set.
4. Envía solo comandos incluidos en el protocolo.

Consulta [`examples/commands/neon_basement_ritual.jsonl`](examples/commands/neon_basement_ritual.jsonl) para ver una secuencia de ejemplo.

## Runner JSONL

Valida una secuencia completa sin enviarla:

```bash
ableton-bridge-run examples/commands/neon_basement_ritual.jsonl --validate-only
```

Envíala con autenticación y una pausa entre comandos:

```bash
ableton-bridge-run examples/commands/neon_basement_ritual.jsonl \
  --token "change-this-token" --delay 0.25
```

## Autorización, aprobación e historial

Inicio recomendado:

```bash
python -m ableton_bridge.server \
  --token "change-this-token" \
  --allow set_tempo,launch_scene,set_track_volume,set_macro \
  --require-approval
```

- `--token` o `ABLETON_BRIDGE_TOKEN` protege los endpoints de escritura y el historial.
- `--allow` limita los tipos de comando aceptados durante la sesión.
- `--require-approval` coloca las órdenes en una cola antes de enviarlas.
- `http://127.0.0.1:8765` abre la interfaz de aprobación e historial.
- SQLite conserva payload, origen, timestamps, estado, resultado y errores.
- Max devuelve confirmaciones; el estado pasa a `acknowledged` o `error`.
- La UI permite solicitar `undo` para órdenes enviadas o confirmadas.

## Configuración del servidor

```bash
python -m ableton_bridge.server \
  --host 127.0.0.1 \
  --port 8765 \
  --udp-host 127.0.0.1 \
  --udp-port 9001 \
  --ack-port 9002 \
  --database .ableton-bridge/history.sqlite3
```

| Opción | Valor predeterminado | Descripción |
| --- | --- | --- |
| `--host` | `127.0.0.1` | Interfaz HTTP donde escucha el bridge |
| `--port` | `8765` | Puerto HTTP |
| `--udp-host` | `127.0.0.1` | Dirección del receptor Max for Live |
| `--udp-port` | `9001` | Puerto UDP del receptor |
| `--ack-host` | `127.0.0.1` | Interfaz para confirmaciones de Max |
| `--ack-port` | `9002` | Puerto UDP de confirmaciones |
| `--database` | `.ableton-bridge/history.sqlite3` | Historial SQLite |
| `--token` | Variable `ABLETON_BRIDGE_TOKEN` | Token local opcional |
| `--allow` | Todos | Allowlist separada por comas |
| `--require-approval` | Desactivado | Requiere aprobación desde la UI/API |
| `--dry-run` | Desactivado | Valida sin enviar UDP |

## API HTTP

### `GET /health`

Informa si el servidor está activo, el modo de ejecución, el destino UDP y el número de comandos aceptados.

### `POST /command`

Recibe un único objeto JSON. Si el comando es válido, responde con HTTP `202`. Si el JSON o sus valores no cumplen el protocolo, responde con HTTP `400` y una explicación.

La versión 0.2 incorpora autenticación local, cola de aprobación e historial persistente. No implementa TLS ni está diseñada como servicio público.

## Seguridad

- El servidor escucha únicamente en `127.0.0.1` de forma predeterminada.
- Los tipos de comando, campos obligatorios y rangos se validan antes del envío.
- Los campos desconocidos son rechazados.
- `--dry-run` permite verificar un flujo sin modificar Ableton.
- No expongas el puerto HTTP a Internet en esta versión.
- No cambies `--host` a `0.0.0.0` sin agregar autenticación, control de acceso y protección de red.

## Ejecutar las pruebas

El proyecto usa `unittest` de la biblioteca estándar y no necesita dependencias de prueba externas:

```bash
python -m unittest discover -s tests -v
```

## Estructura del repositorio

```text
ableton-ai-control-bridge/
├── ableton_bridge/
│   ├── server.py          # Servidor HTTP y estado del bridge
│   ├── commands.py        # Protocolo y validación
│   ├── transport.py       # Envío de JSON por UDP
│   └── cli.py             # Cliente de línea de comandos
├── docs/
│   ├── local-setup.md     # Configuración local resumida
│   └── protocol.md        # Referencia de comandos
├── examples/commands/     # Comandos JSON y secuencias JSONL
├── max-for-live/          # Patch fuente, JavaScript LiveAPI y guía de build
├── remote-scripts/        # Alternativa limitada mediante MIDI CC
├── tests/                 # Pruebas unitarias
└── pyproject.toml         # Metadatos e instalación del paquete
```

## Limitaciones conocidas

- El repositorio no contiene un `.amxd` guardado por Max; incluye el `.maxpat` editable y todos los mappings.
- El receptor debe validarse dentro de Ableton Live/Max for Live; CI no puede ejecutar la Live API.
- UDP no garantiza entrega; el ack confirma ejecución cuando llega, pero la versión actual todavía no marca timeout cuando falta.
- El runner envía JSONL línea por línea y no implementa rollback transaccional de una secuencia completa.
- El servidor está pensado para uso local y confiable, no como API pública.

## Próximos pasos sugeridos

- Abrir el source en Max for Live, ejecutar el checklist y publicar el `.amxd` congelado.
- Añadir reintentos y timeout explícito para confirmaciones que nunca llegan.
- Añadir rollback de secuencias JSONL y agrupación de comandos por sesión.
- Incorporar un transporte MIDI opcional para el subset de [`UserConfiguration.txt`](remote-scripts/UserConfiguration.txt).
- Empaquetar la UI como aplicación de escritorio local.

## Licencia

Este proyecto se distribuye bajo la licencia incluida en [`LICENSE`](LICENSE).
