/* Iconos del sitio: viewBox 24×24, área viva 20×20, trazo 1,5 uniforme, sin
   relleno, monocromos (el color lo pone el contenedor con `currentColor`). Sin
   banderas ni siluetas humanas. */

const TRAZOS = {
  poblacion:   '<circle cx="12" cy="8.5" r="4"/><circle cx="5" cy="15.5" r="3"/><circle cx="19" cy="15.5" r="3"/>',
  variacion:   '<path d="M3.5 4v16h17"/><path d="M7 15l4-4 3 2.5 5.5-5.5"/>',
  edad:        '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l4 2.5"/>',
  extranjero:  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 2.6 15.4 0 18-2.6-2.6-2.6-15.4 0-18z"/>',
  nacimiento:  '<path d="M12 21c3.5-4.5 6-7.7 6-10.5A6 6 0 006 10.5C6 13.3 8.5 16.5 12 21z"/><circle cx="12" cy="10.5" r="2.5"/>',
  territorio:  '<path d="M4 7l5-3 6 3 5-3v13l-5 3-6-3-5 3V7z"/><path d="M9 4v13M15 7v13"/>',
  relevo:      '<circle cx="7" cy="8" r="3"/><circle cx="17" cy="16" r="3"/><path d="M13.5 8h3.5a3.5 3.5 0 013.5 3.5"/><path d="M10.5 16H7a3.5 3.5 0 01-3.5-3.5"/>',
  dependencia: '<path d="M3.5 8h17"/><path d="M12 8v11M8 19h8"/><circle cx="6.5" cy="4.5" r="2.5"/><circle cx="17.5" cy="4.5" r="2.5"/>',

  /* Interfaz */
  inicio:      '<path d="M3.5 10.6L12 4l8.5 6.6V19a1 1 0 01-1 1h-15a1 1 0 01-1-1v-8.4z"/><path d="M9.5 20v-5.5h5V20"/>',
  desplegar:   '<path d="M5.5 9L12 15.5 18.5 9"/>',
  buscar:      '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
  descargar:   '<path d="M12 4v11M7.5 11L12 15.5 16.5 11"/><path d="M5 19h14"/>',
  enlace:      '<path d="M10 13.5a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.3 1.3"/><path d="M14 10.5a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.3-1.3"/>',
  presentar:   '<rect x="3.5" y="4.5" width="17" height="12" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
  cerrar:      '<path d="M6 6l12 12M18 6L6 18"/>',
};

/** El icono como cadena SVG; `aria-hidden` porque siempre acompaña a un texto. */
function icono(nombre, px = 24, clase = 'ico') {
  const d = TRAZOS[nombre];
  if (!d) return '';
  return `<svg class="${clase}" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none"`
       + ` stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`
       + ` aria-hidden="true" focusable="false">${d}</svg>`;
}
