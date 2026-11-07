# 🎄 Zona Navideña — Minijuegos

Plataforma de minijuegos navideños. El primero es **Amigo Secreto**: un sorteo por equipos en el que
**nadie, ni siquiera el organizador, puede ver quién le tocó a quién**.

Stack: **Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + Postgres en Neon**.

## ✨ Cómo funciona el Amigo Secreto

**Participantes (3 pasos):**
1. Abren el enlace y escriben su nombre (autocompletado, sin elegir equipo).
2. Crean un **PIN de 6 números**.
3. Pulsan **🎲 ¡Sortear!** → regalo, ruleta y confeti: ven a su amigo secreto al instante.

Con su nombre + PIN pueden volver a verlo cuando quieran. Opcionalmente dejan una lista de deseos que solo ve quien les regala.

**Organizador (`/admin`):**
- Crea el evento (presupuesto, fecha con cuenta regresiva, mensaje) y los equipos.
- Pega los nombres de cada equipo (uno por línea).
- Ve el contador **"X de N ya tienen amigo secreto"** y el estado de cada persona, nunca a quién le tocó.
- 🔑 Restablecer PIN (a la persona le sale el mismo amigo), 🔓 desbloquear, 🔄 reiniciar el sorteo de un equipo y 🧹 **limpiar todos los sorteos** del evento (la lista de participantes se mantiene).
- Opciones por equipo: modo **Cadena** (un solo círculo, sin regalos mutuos) o **Libre**, y **exclusiones** (parejas que no pueden tocarse).

## 🔒 Privacidad

- El sorteo de cada equipo se genera completo cuando sortea la primera persona (así nunca hay callejones sin salida).
- Cada resultado se guarda cifrado con **AES-256-GCM**, con una llave derivada de `DRAW_SECRET` + el id de quien regala.
  La tabla `assignments` no tiene ninguna columna con el receptor.
- El PIN se guarda solo como hash **scrypt**. 5 intentos fallidos bloquean 10 minutos.
- El panel de admin no tiene ninguna forma de ver los resultados.

> `DRAW_SECRET` no debe cambiarse una vez empezado el sorteo: los resultados ya guardados dejarían de poder leerse.

## 🚀 Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y rellena los valores
npm run db:migrate           # crea las tablas (idempotente)
npm run dev
```

Variables de entorno:

| Variable         | Descripción                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`   | Cadena de conexión de Neon (la _pooled_).                          |
| `ADMIN_PASSWORD` | Contraseña para entrar a `/admin`.                                 |
| `SESSION_SECRET` | Secreto aleatorio largo para la sesión del admin (`openssl rand -base64 32`). |
| `DRAW_SECRET`    | Secreto aleatorio largo para cifrar los resultados (`openssl rand -base64 32`). |

Luego entra a `/admin`, crea el evento, añade los nombres de cada equipo y comparte el enlace
`/amigo-secreto/<evento>`.

## 🧪 Pruebas

```bash
DATABASE_URL=... npm run test:smoke
```

Simula 2 equipos de 9 personas sorteando al instante y comprueba: nadie se toca a sí mismo, cada persona
recibe exactamente un regalo, solo dentro de su equipo, cadena única, exclusiones, que la BD no contenga
nombres en claro, bloqueo por PIN incorrecto, restablecer PIN (mismo amigo) y reinicio de equipo.

## 📁 Estructura

```
db/schema.sql                      Esquema de la base de datos
scripts/migrate.ts                 Aplica el esquema
scripts/smoke-test.ts              Prueba de extremo a extremo de la lógica
src/lib/crypto.ts                  Cifrado de resultados y hash del PIN
src/lib/draw.ts                    Algoritmo de sorteo
src/lib/secret-santa.ts            Lógica del juego y del panel de admin
src/app/page.tsx                   Hub de minijuegos
src/app/amigo-secreto/[slug]       Página del juego
src/app/admin                      Panel del organizador
src/components/secret-santa        Flujo del juego, regalo y ruleta
src/components/admin               Componentes del panel
```

## ➕ Añadir otro minijuego

Crea su carpeta en `src/app/<juego>/`, sus tablas en `db/schema.sql` y actívalo en el arreglo `GAMES`
de `src/app/page.tsx`.
