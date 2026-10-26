-- ARCHI-TACT משרד (MISRAD): cloud sync in the shared CULTURA-GH project.
-- Open access, no sign-in. An office is identified by a private key (only its sha256 is stored).
-- Tables are closed to anon and authenticated; every read and write goes through msr_ functions.

create table if not exists public.msr_offices (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  data jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.msr_offices is 'MISRAD (ARCHI-TACT משרד): one row per office. data = the whole AppData document. Access via msr_ functions only, by private key.';

create table if not exists public.msr_portals (
  token text primary key,
  office_id uuid not null references public.msr_offices(id) on delete cascade,
  project_id text not null,
  kind text not null check (kind in ('client', 'contractor')),
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  unique (office_id, project_id, kind)
);
comment on table public.msr_portals is 'MISRAD: read-only snapshot per project for the client or the contractor, opened by token. Republished on every office save.';

create table if not exists public.msr_responses (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.msr_offices(id) on delete cascade,
  token text not null references public.msr_portals(token) on delete cascade,
  project_id text not null,
  stage_id text,
  kind text not null check (kind in ('approve', 'comment', 'report', 'attend')),
  name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
comment on table public.msr_responses is 'MISRAD: what a client or contractor sent from a portal (approval, comments, site report). Applied by the studio app on its next sync.';
create index if not exists msr_responses_office_open on public.msr_responses (office_id) where applied_at is null;
create index if not exists msr_responses_token on public.msr_responses (token, created_at);
create index if not exists msr_portals_office on public.msr_portals (office_id);

alter table public.msr_offices enable row level security;
alter table public.msr_portals enable row level security;
alter table public.msr_responses enable row level security;
revoke all on public.msr_offices, public.msr_portals, public.msr_responses from anon, authenticated;

create or replace function public.msr_hash(p_key text) returns text
language sql immutable set search_path = public, extensions
as $$ select encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex') $$;
revoke all on function public.msr_hash(text) from public, anon, authenticated;

create or replace function public.msr_office_id(p_key text) returns uuid
language plpgsql stable security definer set search_path = public, extensions
as $$
declare v uuid;
begin
  if p_key is null or length(p_key) < 20 then raise exception 'msr: invalid key' using errcode = '28000'; end if;
  select id into v from public.msr_offices where key_hash = public.msr_hash(p_key);
  if v is null then raise exception 'msr: unknown office' using errcode = '28000'; end if;
  return v;
end $$;
revoke all on function public.msr_office_id(text) from public, anon, authenticated;

-- Create an office from the device's current data. Returns the private key once.
create or replace function public.msr_office_create(p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_key text; v_id uuid;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 2000000 then
    raise exception 'msr: data must be an object under 2MB';
  end if;
  if (select count(*) from public.msr_offices where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'msr: too many new offices, try again later';
  end if;
  v_key := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.msr_offices (key_hash, data) values (public.msr_hash(v_key), p_data) returning id into v_id;
  return jsonb_build_object('key', v_key, 'version', 1);
end $$;

-- Read the office, with portal responses not yet applied.
create or replace function public.msr_office_get(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions
as $$
declare v_id uuid := public.msr_office_id(p_key); r jsonb;
begin
  select jsonb_build_object(
    'data', o.data, 'version', o.version, 'updated_at', o.updated_at,
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'project_id', x.project_id, 'stage_id', x.stage_id, 'kind', x.kind, 'name', x.name, 'note', x.note, 'created_at', x.created_at) order by x.created_at)
      from public.msr_responses x where x.office_id = o.id and x.applied_at is null), '[]'::jsonb)
  ) into r from public.msr_offices o where o.id = v_id;
  return r;
end $$;

-- Save the whole document if nobody saved since p_base_version. Republishes the portal snapshots
-- given in p_portals ([{project_id, kind, snapshot}]) and marks applied responses (p_applied uuid[]).
create or replace function public.msr_office_save(p_key text, p_data jsonb, p_base_version integer, p_portals jsonb default '[]'::jsonb, p_applied uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_id uuid := public.msr_office_id(p_key); v_cur integer; v_new integer; p jsonb;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 2000000 then
    raise exception 'msr: data must be an object under 2MB';
  end if;
  select version into v_cur from public.msr_offices where id = v_id for update;
  if v_cur <> p_base_version then
    return jsonb_build_object('ok', false, 'conflict', true, 'version', v_cur);
  end if;
  update public.msr_offices set data = p_data, version = version + 1, updated_at = now() where id = v_id returning version into v_new;
  for p in select * from jsonb_array_elements(coalesce(p_portals, '[]'::jsonb)) loop
    update public.msr_portals set snapshot = p->'snapshot', updated_at = now()
      where office_id = v_id and project_id = p->>'project_id' and kind = p->>'kind';
  end loop;
  if array_length(p_applied, 1) > 0 then
    update public.msr_responses set applied_at = now() where office_id = v_id and id = any(p_applied) and applied_at is null;
  end if;
  return jsonb_build_object('ok', true, 'version', v_new);
end $$;

-- Create (or keep) the portal for a project and set its snapshot. The token stays stable.
create or replace function public.msr_portal_publish(p_key text, p_project_id text, p_kind text, p_snapshot jsonb)
returns text language plpgsql security definer set search_path = public, extensions
as $$
declare v_id uuid := public.msr_office_id(p_key); v_token text;
begin
  if p_kind not in ('client', 'contractor') then raise exception 'msr: bad kind'; end if;
  if octet_length(p_snapshot::text) > 300000 then raise exception 'msr: snapshot too large'; end if;
  select token into v_token from public.msr_portals where office_id = v_id and project_id = p_project_id and kind = p_kind;
  if v_token is null then
    v_token := translate(encode(extensions.gen_random_bytes(15), 'base64'), '+/=', '-_');
    insert into public.msr_portals (token, office_id, project_id, kind, snapshot) values (v_token, v_id, p_project_id, p_kind, p_snapshot);
  else
    update public.msr_portals set snapshot = p_snapshot, updated_at = now() where token = v_token;
  end if;
  return v_token;
end $$;

-- The portal page: snapshot plus what was already sent from it.
create or replace function public.msr_portal_get(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions
as $$
declare r jsonb;
begin
  select jsonb_build_object('kind', p.kind, 'snapshot', p.snapshot, 'updated_at', p.updated_at,
    'sent', coalesce((select jsonb_agg(jsonb_build_object('stage_id', x.stage_id, 'kind', x.kind, 'name', x.name, 'note', x.note, 'created_at', x.created_at, 'applied', x.applied_at is not null) order by x.created_at)
      from public.msr_responses x where x.token = p.token), '[]'::jsonb))
  into r from public.msr_portals p where p.token = p_token;
  if r is null then raise exception 'msr: unknown portal' using errcode = '28000'; end if;
  return r;
end $$;

-- A client approves or comments on a stage; a contractor reports or confirms a site visit.
create or replace function public.msr_portal_respond(p_token text, p_stage_id text, p_kind text, p_name text, p_note text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare p public.msr_portals%rowtype; v_state text;
begin
  select * into p from public.msr_portals where token = p_token;
  if p.token is null then raise exception 'msr: unknown portal' using errcode = '28000'; end if;
  if (p.kind = 'client' and p_kind not in ('approve', 'comment')) or (p.kind = 'contractor' and p_kind not in ('report', 'attend')) then
    raise exception 'msr: action not allowed here';
  end if;
  if length(coalesce(p_name, '')) > 120 or length(coalesce(p_note, '')) > 4000 then raise exception 'msr: text too long'; end if;
  if (select count(*) from public.msr_responses where token = p_token and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'msr: too many messages, try again later';
  end if;
  if p_kind in ('approve', 'comment') then
    select s->>'state' into v_state from jsonb_array_elements(p.snapshot->'stages') s where s->>'id' = p_stage_id;
    if v_state is distinct from 'submitted' then raise exception 'msr: stage is not waiting for approval'; end if;
    if exists (select 1 from public.msr_responses where token = p_token and stage_id = p_stage_id and kind in ('approve', 'comment') and applied_at is null) then
      raise exception 'msr: already sent, waiting for the studio';
    end if;
  end if;
  if p_kind = 'comment' and length(trim(coalesce(p_note, ''))) = 0 then raise exception 'msr: comment is empty'; end if;
  if p_kind = 'report' and length(trim(coalesce(p_note, ''))) = 0 then raise exception 'msr: report is empty'; end if;
  insert into public.msr_responses (office_id, token, project_id, stage_id, kind, name, note)
    values (p.office_id, p_token, p.project_id, p_stage_id, p_kind, trim(coalesce(p_name, '')), trim(coalesce(p_note, '')));
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.msr_office_create(jsonb), public.msr_office_get(text), public.msr_office_save(text, jsonb, integer, jsonb, uuid[]),
  public.msr_portal_publish(text, text, text, jsonb), public.msr_portal_get(text), public.msr_portal_respond(text, text, text, text, text) from public;
grant execute on function public.msr_office_create(jsonb), public.msr_office_get(text), public.msr_office_save(text, jsonb, integer, jsonb, uuid[]),
  public.msr_portal_publish(text, text, text, jsonb), public.msr_portal_get(text), public.msr_portal_respond(text, text, text, text, text) to anon, authenticated;
