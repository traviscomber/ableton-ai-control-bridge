# Ableton Remote Scripts: segunda vía de integración

## Resultado de la investigación

Ableton soporta oficialmente dos rutas relacionadas:

1. **User Remote Scripts** mediante `UserConfiguration.txt`, adecuados para transporte, mixer y control de dispositivos con mensajes MIDI CC.
2. **Remote Scripts de terceros** instalados en la carpeta `Remote Scripts` de la User Library. Desde Live 11 deben usar Python 3.

Fuentes oficiales:

- [Crear una superficie de control propia](https://help.ableton.com/hc/es/articles/206240184-Creaci%C3%B3n-de-su-propio-script-de-superficie-de-control)
- [Instalar Remote Scripts de terceros](https://help.ableton.com/hc/en-us/articles/209072009-Installing-third-party-remote-scripts)
- [Configurar superficies de control](https://help.ableton.com/hc/en-us/articles/209774285-Using-Control-Surfaces)

## Recomendación

Mantener **Max for Live + Live API como integración principal**. Expone el Live Object Model y permite crear pistas, clips y notas, además de editar parámetros. Cycling '74 documenta oficialmente el acceso mediante `live.path`, `live.object`, `live.observer` y `LiveAPI` para JavaScript.

Usar **User Remote Scripts + MIDI virtual como modo alternativo limitado** cuando Max for Live no esté disponible. Esta ruta sirve para:

- Play, stop, record, loop, rewind y fast-forward.
- Volumen y armado de un conjunto fijo de pistas.
- Ocho controles de parámetros del dispositivo seleccionado.

No ofrece, mediante el formato público `UserConfiguration.txt`, equivalencia completa para crear pistas, clips, notas MIDI o buscar dispositivos por nombre.

## Prototipo incluido

[`remote-scripts/UserConfiguration.txt`](../remote-scripts/UserConfiguration.txt) contiene una plantilla de CCs para un puerto MIDI virtual llamado `Ableton AI Bridge`.

Para probarla:

1. Crea un puerto MIDI virtual con el nombre `Ableton AI Bridge`.
2. Copia la carpeta de configuración dentro de `Preferences/Ableton/Live x.x.x/User Remote Scripts`.
3. Reinicia Live.
4. En Preferences → Link, Tempo & MIDI, selecciona la nueva Control Surface y asigna el puerto virtual como input/output.
5. Envía los CC definidos en la plantilla desde una futura implementación MIDI del bridge.

## Carga experimental de dispositivos nativos en Live 11

La v0.6 incorpora `remote-scripts/AbletonAIControlBridge` como segunda vía
experimental. Escucha OSC solamente en `127.0.0.1:9003` y acepta
`load_native_device`. El bridge envía el resto de los comandos a Max en 9001 y
recibe ACK de ambos motores en 9002.

Esta vía usa el Browser interno del Remote Script porque el Live Object Model
público no expone una función para insertar Operator, Analog, EQ Eight,
Compressor u otros dispositivos. Por eso está fijada a Live 11 y debe fallar de
forma explícita cuando un dispositivo no existe o cambia de nombre.

El instalador copia el script a:

```text
Documentos\Ableton\User Library\Remote Scripts\AbletonAIControlBridge
```

Después de instalar:

1. Reinicia Live.
2. Abre Preferences → Link, Tempo & MIDI.
3. Selecciona `AbletonAIControlBridge` como Control Surface.
4. Deja sus puertos MIDI en `None`; el transporte es UDP local.
5. Reinicia `START BRIDGE.cmd`.

La plantilla
`examples/darksco/native-production-chain-live11.jsonl` carga instrumentos,
efectos, retornos y sends sobre el primer track autónomo de Darksco.
