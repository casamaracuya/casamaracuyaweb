-- Dale el rol de Dirección a la primera persona (la dueña) después de invitarla en
-- Supabase > Authentication > Users > Invite user. Cambia el correo y corre esto una vez.
-- Desde ahí, ella asigna los roles del resto del equipo en el panel (Más > Equipo).
update perfiles set roles = '{direccion}', nombre = 'Nombre de la dueña'
where id = (select id from auth.users where email = 'correo-de-la-duena@ejemplo.com');
