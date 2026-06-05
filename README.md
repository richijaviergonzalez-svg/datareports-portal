# DataReports — Intelligence Platform

Portal de Business Intelligence para **Manufactura de Pilar S.A.**

Desarrollado con React + Vite, integrado con Power BI Embedded, Azure Active Directory y Netlify Functions.

## Tecnologías

- React 18 + Vite
- MSAL.js (autenticación Azure AD)
- Power BI JavaScript SDK (embed de reportes)
- Netlify (hosting, previews y funciones serverless)

## Flujo de despliegue con ahorro de créditos

Este portal está en producción interna, por lo que los cambios deben agruparse y validarse antes de consumir builds de Netlify.

- Trabajar mejoras grandes en ramas `next/*`.
- Validar localmente con `npm.cmd run build` antes de abrir preview.
- Evitar pushes innecesarios a ramas conectadas a Netlify.
- Usar commits con `[skip netlify]` si se necesita respaldar trabajo remoto sin disparar deploy.
- Abrir un único Deploy Preview cuando el paquete esté listo para validación funcional.
- Mergear a `main` solo después de validar el preview, para consumir una sola publicación productiva.
