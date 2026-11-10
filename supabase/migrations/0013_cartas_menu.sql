-- =====================================================================
--  Casa Maracuyá · 0013: cartas de menú (Cocina)
--
--  Los menús impresos que se ponen en la mesa (desayunos, almuerzos, cenas…).
--  Van rotando: Cocina guarda varios, edita el que toque y lo descarga en PDF
--  desde Cocina › Menú. El contenido (secciones y platos) va en `datos` como JSON.
--
--  Lo ve todo el equipo; lo editan Cocina, Operaciones y Dirección.
--  Correr después de 0012. Se puede volver a correr.
-- =====================================================================

create table if not exists cartas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null default 'Menú',
  datos       jsonb not null default '{}'::jsonb,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  por         uuid default auth.uid() references perfiles(id) on delete set null
);
alter table cartas enable row level security;

drop policy if exists "equipo lee cartas" on cartas;
drop policy if exists "cocina escribe cartas" on cartas;
create policy "equipo lee cartas" on cartas for select using (es_equipo());
create policy "cocina escribe cartas" on cartas for all
  using (tiene_algun_rol('{direccion,cocina,operaciones}'))
  with check (tiene_algun_rol('{direccion,cocina,operaciones}'));

create or replace function cartas_actualizado() returns trigger language plpgsql as $$
begin new.actualizado := now(); new.por := auth.uid(); return new; end $$;
drop trigger if exists cartas_actualizado on cartas;
create trigger cartas_actualizado before update on cartas for each row execute function cartas_actualizado();
