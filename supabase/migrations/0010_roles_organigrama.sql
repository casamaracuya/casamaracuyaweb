-- =====================================================================
--  Casa Maracuyá · 0010: roles nuevos del organigrama (parte 1 de 2)
--
--  Postgres no deja usar un valor nuevo de un tipo en la misma ejecución en que
--  se crea. Por eso esto va solo: córrelo primero y DESPUÉS corre 0011.
--
--  Roles nuevos:
--    operaciones · Gerente de Operaciones, Logística y Operatividad Técnica (Robert)
--    servicio    · Líder de Servicio, Protocolo y Atención en Sala (Odely)
--    calidad     · Supervisora de Calidad, Apoyo de Servicio y Auditora Interna (Yanely)
--  Áreas nuevas para las tareas: las mismas tres y «direccion» (CEO & Founder).
--
--  «recepcion» queda en la base de datos para no dejar sin acceso a quien ya lo
--  tenga, pero el panel ya no lo ofrece: sus funciones pasan a Dirección,
--  Operaciones y Servicio.
--
--  Cómo correrlo: Supabase > SQL Editor > New query > pega todo > Run.
-- =====================================================================
alter type rol_equipo add value if not exists 'operaciones';
alter type rol_equipo add value if not exists 'servicio';
alter type rol_equipo add value if not exists 'calidad';

alter type area_tarea add value if not exists 'operaciones';
alter type area_tarea add value if not exists 'servicio';
alter type area_tarea add value if not exists 'calidad';
alter type area_tarea add value if not exists 'direccion';
