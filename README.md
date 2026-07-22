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

**MVP / versión 0.1.0.**

| Componente | Estado |
| --- | --- |
| Servidor HTTP en Python | Funcional |
| Validación de comandos | Funcional |
| Transporte UDP | Funcional |
| CLI para enviar comandos | Funcional |
| Modo de simulación (`--dry-run`) | Funcional |
| Pruebas unitarias | Incluidas |
| Receptor Max for Live | Especificado en una guía de construcción |
| Dispositivo `.amxd` listo para instalar | Pendiente |

> El bridge Python se puede ejecutar y probar ahora. Para que los comandos modifiquen Ableton, todavía es necesario construir y guardar `AI Control Bridge Receiver.amxd` en Ableton/Max siguiendo [`max-for-live/device-build-guide.md`](max-for-live/device-build-guide.md).

## Requisitos

- Python 3.10 o superior.
- Ableton Live con Max for Live para la integración real.
- No requiere VSTs de terceros.
- Todo funciona localmente; no necesita una API key para ejecutar el bridge.

## Instalación rápida

### macOS o Linux

```bash
git clone https://github.com/traviscomber/ableton-ai-control-bridge.git
cd ableton-ai-control-bridge
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```

### Windows PowerShell

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
python -m ableton_bridge.server
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

El modo `dry-run` valida y contabiliza comandos, pero no los envía por UDP. Es la forma recomendada de probar integraciones de IA antes de permitir que controlen una sesión real.

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

1. Abre Ableton Live y Max for Live.
2. Crea un nuevo Max MIDI Effect.
3. Configura un receptor UDP en el puerto `9001`.
4. Deserializa el JSON y enruta cada valor de `type`.
5. Conecta cada comando con su destino correspondiente en la Live API.
6. Guarda el dispositivo como `AI Control Bridge Receiver.amxd`.
7. Colócalo en una pista de la sesión y deja el bridge Python ejecutándose.

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
ableton-bridge-send '{"type":"set_tempo","bpm":132}'
```

También puedes utilizar directamente el módulo Python:

```bash
python -m ableton_bridge.cli '{"type":"set_macro","track":1,"macro":1,"value":0.8}'
```

### Desde un archivo JSON

```bash
ableton-bridge-send examples/commands/create_bass_clip.json
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

## Configuración del servidor

```bash
python -m ableton_bridge.server \
  --host 127.0.0.1 \
  --port 8765 \
  --udp-host 127.0.0.1 \
  --udp-port 9001
```

| Opción | Valor predeterminado | Descripción |
| --- | --- | --- |
| `--host` | `127.0.0.1` | Interfaz HTTP donde escucha el bridge |
| `--port` | `8765` | Puerto HTTP |
| `--udp-host` | `127.0.0.1` | Dirección del receptor Max for Live |
| `--udp-port` | `9001` | Puerto UDP del receptor |
| `--dry-run` | Desactivado | Valida sin enviar UDP |

## API HTTP

### `GET /health`

Informa si el servidor está activo, el modo de ejecución, el destino UDP y el número de comandos aceptados.

### `POST /command`

Recibe un único objeto JSON. Si el comando es válido, responde con HTTP `202`. Si el JSON o sus valores no cumplen el protocolo, responde con HTTP `400` y una explicación.

El MVP no implementa autenticación, CORS, TLS, colas persistentes ni historial de comandos.

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
├── max-for-live/          # Guía del receptor y rutas Live API
├── tests/                 # Pruebas unitarias
└── pyproject.toml         # Metadatos e instalación del paquete
```

## Limitaciones conocidas

- El repositorio todavía no contiene un `.amxd` compilado/listo para instalar.
- La guía de Max for Live prioriza primero tempo, escenas, stop, volumen y macros; los comandos avanzados requieren completar sus mappings en Max.
- Cada petición HTTP acepta un comando; una secuencia JSONL debe enviarse línea por línea.
- UDP no confirma recepción ni ejecución dentro de Ableton.
- El estado del bridge vive en memoria y se reinicia al cerrar el servidor.
- El servidor está pensado para uso local y confiable, no como API pública.

## Próximos pasos sugeridos

- Publicar `AI Control Bridge Receiver.amxd` listo para instalar.
- Completar el mapping Max for Live de todos los comandos declarados.
- Añadir confirmaciones Ableton → bridge y manejo de errores de ejecución.
- Crear un runner nativo para archivos JSONL.
- Incorporar autorización local y listas de comandos permitidos por sesión.
- Añadir logs, historial, undo y una interfaz visual de aprobación.
- Investigar soporte mediante Ableton Remote Scripts como segunda vía de integración.

## Licencia

Este proyecto se distribuye bajo la licencia incluida en [`LICENSE`](LICENSE).

