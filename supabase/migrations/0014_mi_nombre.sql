-- =====================================================================
--  Casa Maracuyá · 0014: cada persona escribe su propio nombre
--
--  Al aceptar la invitación, la persona crea su contraseña y escribe su nombre
--  (antes quedaba con la parte del correo antes de la @). También lo puede
--  corregir después en Perfil. Solo cambia su nombre: los roles los sigue
--  asignando Dirección.
--
--  Correr después de 0013. Se puede volver a correr.
-- =====================================================================

create or replace function fijar_mi_nombre(p_nombre text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := left(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), 80);
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if length(n) < 2 then raise exception 'Escribe tu nombre'; end if;
  update perfiles set nombre = n where id = auth.uid();
end $$;
revoke execute on function fijar_mi_nombre(text) from public, anon;
grant execute on function fijar_mi_nombre(text) to authenticated;
