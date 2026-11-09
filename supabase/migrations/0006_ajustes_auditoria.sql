-- Ajustes que salieron de la auditoría de permisos (supabase/tests/auditoria_rls.sql).

-- 1. Las promociones pausadas ya no se ven desde fuera: el público solo ve las activas;
--    el equipo las sigue viendo todas en el panel.
drop policy if exists "todos leen promociones" on promociones;
create policy "publico ve promociones activas" on promociones for select using (activa or es_equipo());

-- 2. Las funciones del panel solo las puede llamar alguien con sesión iniciada.
--    Postgres deja por defecto que cualquiera (también el visitante anónimo) las ejecute;
--    las funciones ya revisan el rol por dentro, esto cierra la puerta también por fuera.
revoke execute on function liberar_vencidas() from public, anon;
revoke execute on function cambiar_estado(uuid, estado_reserva) from public, anon;
revoke execute on function registrar_pago(uuid, numeric, text) from public, anon;
revoke execute on function siguiente_estado_habitacion(text) from public, anon;
grant execute on function liberar_vencidas(), cambiar_estado(uuid, estado_reserva),
  registrar_pago(uuid, numeric, text), siguiente_estado_habitacion(text) to authenticated;
