# MACROS REPEATER

=-=-=-=-=-=-=-=-= | [DE](./DE.md) | [EN](../README.md) | ES | [FR](./FR.md) | [RU](./RU.md) | [中文](./ZH.md) | [عربي](./AR.md) | =-=-=-=-=-=-=-=-=

## INSTALACIÓN

### Tiendas

Las versiones para tiendas aún no están publicadas.

### Modo de desarrollo

Carga el directorio completo [`extension`](../extension) como una extensión descomprimida.

## DESCRIPCIÓN

Macros Repeater graba clics en una página web y los repite posteriormente.

Crea una macro, configura cómo debe ejecutarse e iníciala desde la ventana de la extensión o con un atajo de teclado. Las macros pueden usar coordenadas grabadas o elementos de la página.

## FUNCIONES PRINCIPALES

- Grabar secuencias de clics en páginas web
- Ejecutar macros en modo Posición o Elemento
- Ejecución visible o invisible
- Repetir una macro completa hasta 999 veces
- Cuatro velocidades de ejecución
- Definir una macro predeterminada e iniciarla con un atajo
- Editar, eliminar y ordenar las macros guardadas
- Temas claro y oscuro

## PRIVACIDAD

- No se recopilan datos
- Sin seguimiento
- Sin solicitudes de red
- Las macros y los ajustes se guardan localmente en el navegador

## IDIOMAS DE LA INTERFAZ

- Inglés
- Ruso
- Español
- Francés
- Alemán
- Chino simplificado
- Árabe

## USO

### Crear una macro

1. Abre la ventana de la extensión
2. Inicia la creación de una macro
3. Haz clic en los puntos o elementos necesarios de la página
4. Vuelve a hacer clic en el icono de la extensión
5. Asigna un nombre, configura la macro y guárdala

### Ejecutar una macro

1. Abre la ventana de la extensión
2. Inicia la macro necesaria
3. La extensión repite los clics grabados e informa del resultado

Un clic del usuario o `Esc` detiene la ejecución. La macro predeterminada también puede iniciarse con `Ctrl+Shift+X` → `M` o, en Mac, `Cmd+Shift+X` → `M`.

Consulta [todas las rutas de usuario](../SPEC/user-path.md) para obtener más información.

## LIMITACIONES

- Las extensiones no funcionan en páginas del sistema del navegador ni en sitios web protegidos
- El modo Elemento requiere que los elementos grabados sigan disponibles en la página
- El modo Posición requiere que el contenido correspondiente permanezca en las coordenadas grabadas
- Los cambios en un sitio web pueden impedir que una macro antigua se complete
- La extensión solo graba y repite clics
- Los clics simulados pueden ser detectados por los sitios web incluso en modo Stealth — los eventos generados por el navegador no tienen el indicador `isTrusted: true` que llevan las interacciones reales del usuario; los sitios que comprueban `event.isTrusted` detectarán la automatización independientemente de cómo se envíe el clic

## LICENCIA

[Licencia MIT](../LICENSE)
