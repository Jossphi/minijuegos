# 🎄 Zona Navideña — Minijuegos

Plataforma de minijuegos navideños. El primero es **Amigo Secreto**: un sorteo por equipos en el que
**nadie, ni siquiera el organizador, puede ver quién le tocó a quién**.

Stack: **Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + Postgres en Neon**.

## ✨ Funciones

- 🎮 **Hub de minijuegos** (Amigo Secreto activo; Trivia, Bingo y Ruleta de Retos marcados como "Próximamente").
- 👥 **Equipos**: cada equipo sortea por separado (p. ej. 2 equipos de 9 personas).
- 🔐 **Clave personal**: cada persona elige su nombre y crea una clave secreta.
- 🎲 **Sorteo automático** cuando se registra la última persona del equipo (o manual desde el panel).
- 🔗 **Modos de sorteo**: _Cadena_ (un solo círculo, sin regalos mutuos) o _Libre_.
- 🚫 **Exclusiones**: parejas que no pueden tocarse entre sí.
- 🎁 **Revelación animada**: caja de regalo, ruleta tipo tragamonedas y confeti.
- 📝 **Lista de deseos**: la ve solo quien te regala.
- 💰 Presupuesto, 📅 fecha con cuenta regresiva y mensaje del evento.
- 🛡️ Bloqueo tras 5 intentos fallidos de clave (10 min).
- 🧝 **Panel de admin** (`/admin`): crear eventos y equipos, añadir nombres en bloque, ver estados
  (Pendiente / Registrado / Ya lo vio), restablecer claves, repetir o anular sorteos y compartir por WhatsApp.

## 🔒 Cómo se garantiza el secreto

1. Al registrarse, de la clave de cada persona se deriva (con **scrypt**) un par de llaves **X25519**.
   En la base de datos solo se guarda la **llave pública**; la clave nunca se guarda.
2. Al sortear, el servidor calcula las parejas en memoria, cifra cada resultado con la llave pública
   de quien regala (**X25519 + HKDF + AES-256-GCM**) y descarta el resultado en claro.
3. La tabla `assignments` solo tiene `giver_id` + `ciphertext`. **No existe ninguna columna con el receptor.**
4. Para ver su amigo secreto, la persona escribe su clave → se regenera la llave privada → se descifra.

Así, ni el panel de admin ni quien tenga acceso a la base de datos puede leer los resultados.
Si alguien olvida su clave, el admin puede restablecerla, pero eso **anula y repite** el sorteo de su
equipo (es la única forma de mantener el secreto).

> La clave pide mínimo 6 caracteres. Cuanto más larga, más difícil es adivinarla por fuerza bruta.

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

Luego entra a `/admin`, crea el evento, añade los nombres de cada equipo y comparte el enlace
`/amigo-secreto/<evento>`.

## 🧪 Pruebas

```bash
DATABASE_URL=... npm run test:smoke
```

Simula 2 equipos de 9 personas: registro, sorteo automático, validez (nadie se toca a sí mismo, cada
persona recibe exactamente un regalo, solo dentro de su equipo, cadena única, exclusiones), que la BD no
contenga nombres en claro, bloqueo por intentos fallidos, restablecimiento y re-sorteo.

## 📁 Estructura

```
db/schema.sql                      Esquema de la base de datos
scripts/migrate.ts                 Aplica el esquema
scripts/smoke-test.ts              Prueba de extremo a extremo de la lógica
src/lib/crypto.ts                  Cifrado de resultados
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
