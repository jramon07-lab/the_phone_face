# Presentación común del CRM — pruebas, 20 de septiembre de 2026

Base remota: `45149c642c39c12cda00bc6372a7ba09933298d7`, rama `test/estable-clon-20260919-v2`.

## Alcance

`assets/crm-unified.css` se carga en los dos puntos de entrada. En escritorio unifica superficies, campos, tablas, botones, tablero, ficha de contacto, oportunidad, agenda, WhatsApp, ofertas y módulos de administración. En móvil conserva la geometría y paleta existente y alinea los acentos azules. No cambia manejadores ni reglas de negocio; no modifica datos ni automatizaciones.

El despliegue es exclusivamente preview. No equivale a un rediseño estructural terminado de cada módulo.

## Verificación

- Sintaxis: 178 archivos JavaScript válidos y comprobación modular superada.
- Regresión: 144/145 inicialmente; el único fallo fue la sintaxis de la expresión regular en `system-status-google-conflicts.cjs`, anterior al cambio de estilo. Se corrigió el escape duplicado conservando las cinco aserciones y esa prueba pasó al repetirse. Las 145 comprobaciones han pasado en conjunto.
- `git diff --check`: sin errores.
- Revisión visual autenticada de TODOS los módulos: **pendiente**. El navegador muestra inicio de sesión. No se atribuyen resultados de datos ficticios a una cuenta real.
- Pendientes manuales: apertura/edición/cancelación y scroll de fichas; tablero/lista/filtros; agenda/formularios; conversaciones/multimedia; ofertas/plantillas; etiquetas/importación; configuración/usuarios/permisos; móvil.
- No se envían mensajes ni se realizan operaciones con datos reales para validar este cambio.

## Paso a estable

Comparar con el HEAD estable vigente e incorporar solo los cambios aprobados. No promover toda la rama de pruebas sin revisar sus diferencias. Mantener identificados el commit previo y la versión a revertir. No autorizado ni realizado en esta entrega.

## Revisión autenticada posterior

Se abrió una sesión que la interfaz identifica como Ramón/Administrador. Todas las comprobaciones fueron de lectura, apertura y cancelación; no se guardaron cambios en clientes ni se enviaron mensajes.

- Inicio: filtro Seguimientos, selector Todas (17/17) y apertura de analítica.
- Contactos: carga de 1282 registros, búsqueda, apertura y las seis pestañas de ficha; formulario de alta y cancelación.
- Ventas: tablero/lista, formulario nuevo y existente, cierre de mes y pestaña de ofertas pendientes; cancelación sin pasar ventas a Ganado.
- Agenda: carga, apertura del formulario de tarea y cancelación.
- Ofertas: apertura de configurador, opciones de operador y cancelación sin envío.
- Navegación: Avisos, Buscador, Importar Excel, WhatsApp, Plantillas, Programados, Etiquetas, Configuración, Automatizaciones, Usuarios, Sistema y Papelera. No equivale a ejecutar todas sus acciones.
- Correo muestra Microsoft 365 no conectado; no se validó envío/recepción.
- Detectado y corregido: Inicio quedaba antiguo si el inicio de sesión tardaba más de 60 segundos. Sustituido el sondeo con caducidad por observación del estado visible de la aplicación. Regresión nueva `dashboard-delayed-login.cjs` pasa.
- Ajustados márgenes de páginas y menú desplazable tras inspección visual: estilos heredados de WhatsApp anulaban el padding de main.
- Siguen pendientes: operaciones de escritura controladas, integraciones externas de extremo a extremo, revisión en móvil físico. No se certifica todo el CRM.
