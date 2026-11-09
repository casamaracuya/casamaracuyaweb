-- =====================================================================
--  Registro de errores de la web y del panel.
--
--  Cuando algo falla en el navegador de alguien (la web pública o el panel),
--  la página lo anota aquí. Para verlos:
--    Supabase > Table Editor > errores   (o en el SQL Editor:)
--    select creado, origen, veces, mensaje, pagina from errores order by creado desc limit 50;
--
--  · El mismo error en la misma página dentro de una hora se cuenta en «veces»,
--    en vez de repetirse fila por fila.
--  · Máximo 300 errores nuevos por hora, para que nadie pueda llenar la tabla.
--  · Solo Dirección puede leerlos y borrarlos.
--
--  Cómo correrlo: Supabase > SQL Editor > New query > pega todo > Run.
-- =====================================================================

create table if not exists errores (
  id         bigserial primary key,
  creado     timestamptz not null default now(),
  ultimo     timestamptz not null default now(),
  veces      int not null default 1,
  origen     text not null default 'web',      -- 'web' (página pública) o 'panel'
  mensaje    text not null,
  detalle    text not null default '',          -- dónde ocurrió (stack)
  pagina     text not null default '',
  navegador  text not null default '',
  usuario    uuid                               -- quién estaba en el panel, si había sesión
);
create index if not exists errores_creado on errores (creado desc);
alter table errores enable row level security;
revoke all on errores from anon, authenticated;
grant select, delete on errores to authenticated;

drop policy if exists "direccion ve errores" on errores;
create policy "direccion ve errores" on errores for select using (tiene_rol('direccion'));
drop policy if exists "direccion borra errores" on errores;
create policy "direccion borra errores" on errores for delete using (tiene_rol('direccion'));

-- La única forma de escribir en la tabla: esta función, con límites.
create or replace function registrar_error(
  p_origen text, p_mensaje text, p_detalle text default '', p_pagina text default '', p_navegador text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  m text := left(coalesce(nullif(trim(p_mensaje), ''), 'Error sin mensaje'), 500);
  pg text := left(coalesce(p_pagina, ''), 300);
  existente bigint;
begin
  select id into existente from errores
   where mensaje = m and pagina = pg and ultimo > now() - interval '1 hour'
   order by ultimo desc limit 1;
  if existente is not null then
    update errores set veces = veces + 1, ultimo = now() where id = existente;
    return;
  end if;
  if (select count(*) from errores where creado > now() - interval '1 hour') >= 300 then return; end if;
  insert into errores (origen, mensaje, detalle, pagina, navegador, usuario)
  values (case when p_origen = 'panel' then 'panel' else 'web' end, m, left(coalesce(p_detalle, ''), 4000), pg,
          left(coalesce(p_navegador, ''), 300), auth.uid());
end $$;
revoke execute on function registrar_error(text, text, text, text, text) from public;
grant execute on function registrar_error(text, text, text, text, text) to anon, authenticated;
