-- Para que el panel se actualice solo cuando otra persona del equipo cambia algo.
-- Correr después de 0001_esquema.sql (Supabase > SQL Editor).
alter publication supabase_realtime add table reservas, tareas, habitaciones, exteriores, bloqueos, pagos, gastos, compras, menus, huespedes;
