<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/jzszdznzzl/lyra/main/assets/logo-dark.svg">
  <img alt="lyra" src="https://raw.githubusercontent.com/jzszdznzzl/lyra/main/assets/logo-light.svg" width="300">
</picture>

**Tu biblioteca de YT Music, en un reproductor que hace lo que YT Music no hace.**
<br>
Una PWA autoalojada con crossfade, ecualizador, letras sincronizadas, descargas sin conexión y control de la reproducción entre tus dispositivos al estilo de Spotify Connect.

![bun](https://img.shields.io/badge/bun-%E2%89%A51.4-000000?logo=bun&logoColor=white)
![elysia](https://img.shields.io/badge/elysia-1.4-8b5cf6)
![react](https://img.shields.io/badge/react-19-149eca?logo=react&logoColor=white)
![typescript](https://img.shields.io/badge/typescript-7-3178c6?logo=typescript&logoColor=white)
![zod](https://img.shields.io/badge/zod-4-3e67b1?logo=zod&logoColor=white)
![pwa](https://img.shields.io/badge/PWA-instalable-5a0fc8?logo=pwa&logoColor=white)

[English](./README.md) · **Español**

</div>

---

> [!WARNING]
> **Lyra es un proyecto personal no oficial.** No está afiliado, respaldado ni soportado por Google, YouTube ni YouTube Music. Se comunica con la API interna y no documentada de YT Music igual que la app web oficial, así que **puede dejar de funcionar en cualquier momento**, sin aviso, cada vez que Google cambie esa API. Usarlo puede ir en contra de los Términos de Servicio de YouTube, y lo usas bajo tu propia responsabilidad. Lyra no aloja, comparte ni vende ningún contenido: solo reproduce lo que tu propia cuenta ya puede ver.

## ¿Por qué lyra?

YT Music tiene un catálogo enorme, pero el reproductor es básico. Lyra inicia sesión con tu cuenta de Google y conserva tu biblioteca, tus "me gusta" y tus playlists, y agrega lo que falta:

|                                                  | YT Music (web)      | **lyra**                                                            |
| ------------------------------------------------ | ------------------- | ------------------------------------------------------------------- |
| Crossfade y fundido de entrada/salida            | ❌                  | ✅                                                                  |
| Ecualizador                                      | ❌                  | ✅ 10 bandas, presets y personalizado                               |
| Letras sincronizadas                             | algunas canciones   | ✅ de [LRCLIB](https://lrclib.net), con las de YT Music de respaldo |
| Descargas sin conexión en el navegador           | solo la app Premium | ✅ PWA instalable                                                   |
| Controlar la reproducción desde otro dispositivo | ❌                  | ✅ al estilo de Spotify Connect                                     |
| Enlaces para compartir                           | enlaces de YouTube  | ✅ enlaces de lyra con título y portada en la vista previa          |

## Funciones

- 🎵 **Todo el catálogo.** Búsqueda, inicio, explorar, álbumes, artistas, playlists y videos musicales.
- 📚 **Tu biblioteca.** Canciones que te gustan, crear y editar playlists, y una cola que puedes reordenar.
- 🎚️ **Mejor sonido.** Fundido de entrada/salida, crossfade, ecualizador de 10 bandas con presets y calidad de audio hasta la máxima disponible.
- 🎤 **Letras.** Letras sincronizadas de LRCLIB que siguen la canción, las letras simples de YT Music cuando no hay, y una vista inmersiva a pantalla completa.
- 📡 **Connect.** Mira dónde está sonando la música, pásala a este dispositivo con "escuchar aquí", cambia el volumen a distancia y comparte una sola cola entre dispositivos.
- 📥 **Sin conexión.** Descarga canciones en el navegador y escúchalas sin internet.
- 🔐 **Cuentas.** Verificación por correo, sesiones, passkeys y avatares. Las cookies de Google se guardan cifradas con AES-256-GCM.
- 🌍 **Inglés y español**, temas oscuro y claro, y controles multimedia en la pantalla de bloqueo.

## Cómo funciona

```
apps/server/      Bun + Elysia: API, cliente de YT Music (youtubei.js), streaming y el hub WebSocket de Connect
apps/web/         PWA con React 19 + Vite
packages/shared/  Tipos, objetos de dominio y esquemas zod compartidos
e2e/              Pruebas de Playwright
```

- **Vincular Google.** Elige entre un **navegador remoto** (el servidor abre Chromium, lo transmite a tu página y guarda la sesión cuando entras a `music.youtube.com`) o **pegar la cabecera `Cookie`** desde las DevTools de tu navegador. Las cookies se comprueban con una petición real antes de guardarlas.
- **Streaming.** El servidor obtiene el audio de cada canción y lo reenvía, así el navegador lo reproduce como cualquier otro archivo y el ecualizador y el crossfade funcionan sobre él.
- **Almacenamiento.** Un solo archivo SQLite (`bun:sqlite` + Drizzle) en `DATA_DIR`; las migraciones se ejecutan al arrancar.

## Primeros pasos

Requisitos:

- **Bun ≥ 1.4** y **pnpm ≥ 12**
- Una cuenta de Google con YT Music
- Un servidor SMTP para los correos de verificación, o `MAIL_TRANSPORT=log` para mostrarlos en la consola

```bash
pnpm install
cp .env.example .env
openssl rand -base64 32   # pégalo en SECRET_KEY
pnpm dev
```

El servidor escucha en `PORT` (39422) y la app web en `http://localhost:44790`. Crea una cuenta y luego vincula Google desde tu perfil.

Cómo ejecutarlo en producción (Chromium para el navegador remoto, archivo de entorno, proxy inverso, gestor de procesos) está en [CONTRIBUTING.md](./CONTRIBUTING.md#running-in-production) (en inglés).

## Scripts

| Comando          | Qué hace                                         |
| ---------------- | ------------------------------------------------ |
| `pnpm dev`       | Arranca el servidor y la app web                 |
| `pnpm build`     | Compila el servidor (tsdown) y la app web (Vite) |
| `pnpm lint`      | Ejecuta oxlint                                   |
| `pnpm typecheck` | Comprueba los tipos con tsc                      |
| `pnpm test`      | Ejecuta las pruebas unitarias                    |
| `pnpm test:e2e`  | Ejecuta las pruebas de Playwright                |

## Contribuir

La instalación, los scripts y el flujo de trabajo están en [CONTRIBUTING.md](./CONTRIBUTING.md). Las reglas de código, tanto para personas como para asistentes de IA, están en [AGENTS.md](./AGENTS.md).

## Contacto

me@jzszdznzzl.dev
