# Storefront React

Frontend público de `storefront.qodexia.site` construido con React, TypeScript y Vite.

## Stack

- React 19
- React Router 7
- Vite 8
- API Laravel en `https://ecommerce.qodexia.site/api/v1`

## Desarrollo local

```bash
npm install
npm run dev
```

Variables:

```bash
VITE_API_URL=https://ecommerce.qodexia.site/api/v1
```

## Build

```bash
npm run build
```

Salida estática:

```text
dist/
```

## Deploy actual

El sitio público `https://storefront.qodexia.site` se sirve con Nginx desde:

```text
/opt/storefront-react/dist
```

Deploy manual típico:

```bash
npm run build
rsync -avz --delete dist/ qodexia:/opt/storefront-react/dist/
ssh qodexia "sudo systemctl reload nginx"
```

Si el alias `qodexia` ya está configurado en SSH, ese flujo es suficiente.

## Rutas principales

- `/`
- `/productos`
- `/productos/:slug`
- `/login`
- `/register`
- `/carrito`
- `/checkout`
- `/perfil`
- `/perfil/wishlist`
- `/perfil/ordenes`
- `/perfil/direcciones`
- `/perfil/resenas`

## Validación rápida

Antes de desplegar:

```bash
npm run build
```
