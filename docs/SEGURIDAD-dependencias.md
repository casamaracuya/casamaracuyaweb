# Seguridad de las librerías (npm audit)

Revisión del 24 nov 2026. Se corre `npm audit --omit=dev` antes de cada entrega.

## Actualizadas
| Librería | Antes | Ahora | Por qué |
|---|---|---|---|
| react-router-dom | 6.26.2 | 6.30.6 | Alertas altas de redirección abierta (GHSA-2w69-qvjg-hvjx, GHSA-2j2x-hqr9-3h42). |
| jspdf | 2.5.2 | 4.2.1 | Alerta crítica (varias: inyección en PDF, DoS). El panel solo la usa para armar el PDF del presupuesto y de la carta con imágenes; se comprobó que el PDF sale igual (mismo tamaño, páginas y peso). |
| dompurify (dentro de jspdf) | 2.5.9 | 3.4.17 (fijada con `overrides`) | Alertas de XSS. Se fija en 3.4.17 y no en 3.5.0 porque la 3.5.0 salió hace dos días. |
| signature_pad | — | 5.1.4 (fijada) | Nueva (firma del portal). No se usa 5.1.5–5.1.7: salieron tres versiones en cuatro días. |

## Pendiente, a propósito
**react-router (moderada), GHSA-wrjc-x8rr-h8h6 y GHSA-337j-9hxr-rhxg.** Solo se arregla pasando a
react-router 7 (cambio grande). No nos alcanza:
- La redirección con barra invertida necesita que la web navegue a una dirección que escribe un
  usuario. Aquí todas las navegaciones van a direcciones fijas del propio sitio (`/admin/...`,
  `/en/`, `/mi-reserva` + la búsqueda actual).
- La inyección en `deserializeErrors()` es de los «data routers» con SSR; aquí no se usan
  (BrowserRouter / StaticRouter).

**Revisar de nuevo:** marzo 2027, o antes si sale una alerta que sí nos alcance. Pasar a
react-router 7 como cambio aparte, con su propia prueba del sitio y del panel.
