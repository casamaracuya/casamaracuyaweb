-- =====================================================================
--  Casa Maracuyá · 0016: tarifas con precio base y persona adicional
--  Se puede volver a correr (deja estos precios aunque se hayan cambiado en el panel).
--
--  Cada plan tiene precio weekend (noches de jueves a domingo) y midweek (lunes a
--  miércoles). El precio base cubre hasta 6 personas; desde la 7.ª se suma la
--  persona adicional, hasta 12. En temporada alta todas las noches van a weekend.
--  Después se cambian desde el panel, en Tarifas.
-- =====================================================================

insert into tarifas (clave, monto) values
  ('esencial-finde', 720), ('esencial-finde-extra', 80),
  ('esencial-semana', 520), ('esencial-semana-extra', 60),
  ('plena-finde', 920), ('plena-finde-extra', 120),
  ('plena-semana', 680), ('plena-semana-extra', 100)
on conflict (clave) do update set monto = excluded.monto;
