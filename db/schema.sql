-- Esquema de la plataforma de minijuegos (módulo: Amigo Secreto)
-- Idempotente: se puede ejecutar varias veces.

create extension if not exists pgcrypto;

create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  budget        text,
  exchange_date date,
  message       text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  name        text not null,
  color       text not null default 'red',
  -- 'cycle' = una sola cadena (A→B→C→…→A), sin regalos mutuos
  -- 'free'  = aleatorio clásico (puede haber parejas que se regalan entre sí)
  draw_mode   text not null default 'cycle' check (draw_mode in ('cycle', 'free')),
  -- si es true, el sorteo se hace solo cuando se registra la última persona del equipo
  auto_draw   boolean not null default true,
  drawn_at    timestamptz,
  created_at  timestamptz not null default now(),
  unique (event_id, name)
);

create table if not exists participants (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references teams(id) on delete cascade,
  name             text not null,
  -- Se rellenan cuando la persona se registra con su clave secreta.
  -- No se guarda la clave: solo la sal del KDF y la llave pública X25519 derivada.
  kdf_salt         text,
  public_key       text,
  claimed_at       timestamptz,
  wishlist         text,
  revealed_at      timestamptz,
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  unique (team_id, name)
);

-- Parejas que no pueden tocarse entre sí (en ninguna dirección)
create table if not exists exclusions (
  team_id  uuid not null references teams(id) on delete cascade,
  a_id     uuid not null references participants(id) on delete cascade,
  b_id     uuid not null references participants(id) on delete cascade,
  primary key (a_id, b_id),
  check (a_id < b_id)
);

-- Resultado del sorteo: cifrado con la llave pública de quien regala.
-- Solo esa persona, con su clave, puede descifrarlo. Aquí NO hay columna "receiver_id".
create table if not exists assignments (
  giver_id    uuid primary key references participants(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  ciphertext  text not null,
  created_at  timestamptz not null default now()
);

-- v2: sorteo instantáneo con PIN de 4 dígitos (hash scrypt)
alter table participants add column if not exists pin_salt text;
alter table participants add column if not exists pin_hash text;

create index if not exists teams_event_idx on teams(event_id);
create index if not exists participants_team_idx on participants(team_id);
create index if not exists assignments_team_idx on assignments(team_id);
