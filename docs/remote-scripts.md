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

## Decisión técnica

No se incluye un Remote Script Python basado en módulos internos de Ableton. Aunque existen scripts de terceros, Ableton no publica una API estable completa para replicar mediante Python todas las operaciones del Live Object Model. Introducir dependencias sobre módulos internos reduciría la portabilidad entre versiones de Live.

La fase siguiente recomendada es añadir al bridge un transporte MIDI opcional que traduzca únicamente el subconjunto compatible con `UserConfiguration.txt`, manteniendo el transporte Max for Live para las funciones avanzadas.
