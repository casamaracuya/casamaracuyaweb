#!/usr/bin/env bash
# =====================================================================
#  Casa Maracuyá · aplica en Supabase las migraciones que falten y corre las pruebas.
#  Lo corre GitHub (.github/workflows/supabase.yml) DESPUÉS de que Edwar aprueba.
#  También se puede correr a mano:  SUPABASE_DB_URL='postgresql://…' bash scripts/supabase-aplicar.sh
#
#  · Lleva la cuenta en la tabla migraciones_aplicadas: una migración nunca se corre dos veces.
#  · La primera vez da por hechas de la 0001 a la BASE (ya estaban corridas a mano cuando se
#    armó esto). Las siguientes se pueden volver a correr sin romper nada, así que si alguna
#    ya se había corrido a mano, correrla otra vez no hace daño.
#  · Cada migración va en su propia transacción: si falla, no queda nada a medias y se detiene.
#  · Al final corre las pruebas (todas se deshacen solas). Si una dice «fallas» distinto de 0,
#    termina con error para que GitHub avise.
# =====================================================================
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL (la conexión a la base de datos)}"
BASE="${MIGRACIONES_BASE:-0016}"          # hasta aquí ya estaba corrido a mano
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1)

# ---------- 1. La tabla que lleva la cuenta ----------
"${PSQL[@]}" <<SQL
create table if not exists public.migraciones_aplicadas (
  archivo  text primary key,
  aplicada timestamptz not null default now(),
  huella   text not null default ''          -- sha256 del archivo cuando se aplicó
);
alter table public.migraciones_aplicadas enable row level security;
revoke all on public.migraciones_aplicadas from anon, authenticated;
SQL

hechas=$("${PSQL[@]}" -At -c "select count(*) from public.migraciones_aplicadas")
if [ "$hechas" = "0" ]; then
  echo "Primera vez: doy por hechas las migraciones hasta la $BASE."
  for f in "$DIR"/supabase/migrations/[0-9]*.sql; do
    n=$(basename "$f"); [[ "${n%%_*}" > "$BASE" ]] && continue
    "${PSQL[@]}" -c "insert into public.migraciones_aplicadas (archivo, huella) values ('$n', 'base') on conflict do nothing"
  done
fi

# ---------- 2. Las que faltan, en orden ----------
aplicadas=0
for f in $(ls "$DIR"/supabase/migrations/[0-9]*.sql | sort); do
  n=$(basename "$f")
  ya=$("${PSQL[@]}" -At -c "select count(*) from public.migraciones_aplicadas where archivo = '$n'")
  [ "$ya" != "0" ] && continue
  h=$(sha256sum "$f" | cut -c1-64)
  echo "→ Aplicando $n"
  "${PSQL[@]}" --single-transaction -f "$f" \
    -c "insert into public.migraciones_aplicadas (archivo, huella) values ('$n', '$h')"
  echo "  ✓ $n"
  aplicadas=$((aplicadas + 1))
done
echo "Migraciones aplicadas ahora: $aplicadas"

# ---------- 3. Pruebas (se deshacen solas; terminan siempre con un mensaje «PRUEBAS …») ----------
fallo=0
# prueba:migración que necesita
for par in registro_pago:0017 solicitudes:0019 portal_huesped:0020; do
  t=${par%%:*}; m=${par##*:}
  f="$DIR/supabase/tests/$t.sql"
  [ -f "$f" ] || continue
  hay=$("${PSQL[@]}" -At -c "select count(*) from public.migraciones_aplicadas where archivo like '${m}\_%'")
  [ "$hay" = "0" ] && { echo "· $t: se salta (la $m todavía no está)"; continue; }
  out=$(psql "$SUPABASE_DB_URL" -X -q -f "$f" 2>&1 || true)
  linea=$(printf '%s\n' "$out" | grep -oE 'PRUEBAS [0-9]+: [0-9]+ pruebas, [0-9]+ fallas' | head -1 || true)
  if [ -z "$linea" ]; then
    echo "✗ $t: no terminó bien"; printf '%s\n' "$out" | grep -E 'ERROR' | head -5; fallo=1
  elif [[ "$linea" =~ ,\ 0\ fallas ]]; then
    echo "✓ $t: $linea"
  else
    echo "✗ $t: $linea"; printf '%s\n' "$out" | grep -E '^FALLA' | head -20; fallo=1
  fi
done
exit $fallo
