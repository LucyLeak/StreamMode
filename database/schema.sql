create extension if not exists pgcrypto;

create table if not exists streamers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null,
  stream_key text not null unique,
  obs_overlay_token text not null default encode(gen_random_bytes(18), 'hex'),
  active_scene_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scenes (
  id uuid primary key default gen_random_uuid(),
  streamer_id uuid not null references streamers(id) on delete cascade,
  name text not null,
  width integer not null default 1920,
  height integer not null default 1080,
  background text not null default '#0b0b0c',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  streamer_id uuid not null references streamers(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('text', 'image', 'frame', 'audio', 'video', 'gif', 'group')),
  mime_type text,
  storage_url text,
  thumbnail_url text,
  size_bytes bigint,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by text not null default 'moderator',
  created_at timestamptz not null default now()
);

create table if not exists layers (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  parent_id uuid references layers(id) on delete set null,
  asset_id uuid references assets(id) on delete set null,
  kind text not null check (kind in ('text', 'image', 'frame', 'audio', 'video', 'gif', 'group')),
  name text not null,
  order_index integer not null default 0,
  visible boolean not null default true,
  locked boolean not null default false,
  x numeric(10, 2) not null default 0,
  y numeric(10, 2) not null default 0,
  width numeric(10, 2) not null default 320,
  height numeric(10, 2) not null default 180,
  rotation numeric(8, 2) not null default 0,
  opacity numeric(5, 2) not null default 100,
  fill text not null default '#f6dae0',
  content text,
  blend_mode text not null default 'normal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists streamers_stream_key_idx on streamers(stream_key);
create index if not exists scenes_streamer_id_idx on scenes(streamer_id);
create index if not exists assets_streamer_id_idx on assets(streamer_id);
create index if not exists layers_scene_id_order_idx on layers(scene_id, order_index);

insert into streamers (name, handle, stream_key)
values ('Streamer 1', 'nome do streamer', 'streamer-1')
on conflict (stream_key) do nothing;

with selected_streamer as (
  select id from streamers where stream_key = 'streamer-1' limit 1
), inserted_scene as (
  insert into scenes (streamer_id, name, status)
  select id, 'Pagina 1', 'live' from selected_streamer
  where not exists (
    select 1
    from scenes
    where streamer_id = (select id from selected_streamer)
  )
  returning id
), selected_scene as (
  select id from inserted_scene
  union
  select scenes.id
  from scenes
  join selected_streamer on scenes.streamer_id = selected_streamer.id
  order by id
  limit 1
)
update streamers
set active_scene_id = (select id from selected_scene), updated_at = now()
where stream_key = 'streamer-1' and active_scene_id is null;

with selected_scene as (
  select active_scene_id as id from streamers where stream_key = 'streamer-1'
)
insert into layers (scene_id, kind, name, order_index, x, y, width, height, fill, content)
select id, 'text', 'Texto 1', 1, 160, 120, 420, 80, '#f6dae0', '[titulo da live]' from selected_scene
where not exists (
  select 1 from layers where scene_id = (select id from selected_scene)
);

with selected_scene as (
  select active_scene_id as id from streamers where stream_key = 'streamer-1'
)
insert into layers (scene_id, kind, name, order_index, x, y, width, height, fill, content)
select id, 'text', 'Texto 2', 2, 160, 220, 360, 70, '#f6dae0', '@[nome do streamer]' from selected_scene
where (
  select count(*) from layers where scene_id = (select id from selected_scene)
) < 2;

with selected_scene as (
  select active_scene_id as id from streamers where stream_key = 'streamer-1'
)
insert into layers (scene_id, kind, name, order_index, x, y, width, height, fill, content)
select id, 'frame', 'Frame 1', 3, 700, 190, 500, 280, '#9a4059', '' from selected_scene
where (
  select count(*) from layers where scene_id = (select id from selected_scene)
) < 3;
