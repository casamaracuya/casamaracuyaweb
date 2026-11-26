# Guía para Edwar: aprobar los cambios de la base de datos con un botón

Desde ahora, cuando entra a `main` un cambio que toca Supabase (una migración nueva o una función
de correo), **GitHub te pide que lo apruebes**. Tocas **Approve** y GitHub hace el resto:

1. Corre en Supabase las migraciones que falten, en orden. Lleva la cuenta en la tabla
   `migraciones_aplicadas`, así que nunca repite una.
2. Corre las pruebas (pagos, solicitudes, portal). Se deshacen solas: no dejan nada guardado.
3. Publica las funciones de correo (`enviar-comprobante`, `enviar-acceso`).

Si algo falla, se detiene, no deja nada a medias y GitHub te manda un correo con el error.

Archivos: `.github/workflows/supabase.yml` y `scripts/supabase-aplicar.sh`.

---

## Configurarlo (una sola vez, unos 10 minutos)

Necesitas ser administrador del repositorio en GitHub y tener acceso al proyecto de Supabase de
la casa.

### 1. Crear el entorno «produccion» en GitHub

1. Repositorio `casamaracuya/casamaracuyaweb` → **Settings** → **Environments** → **New environment**.
2. Nombre: `produccion` → **Configure environment**.
3. Marca **Required reviewers** y agrégate tú (y a Daniel si quieres que él también pueda aprobar).
4. En **Deployment branches and tags** elige **Selected branches and tags** → **Add** → `main`.
5. **Save protection rules**.

### 2. Guardar las 3 llaves de Supabase en ese entorno

En la misma página de `produccion`, en **Environment secrets** → **Add environment secret**:

| Nombre | De dónde sale |
|---|---|
| `SUPABASE_DB_URL` | Supabase → el proyecto de la casa → botón **Connect** (arriba) → **Session pooler** → copia la dirección `postgresql://…` y cambia `[YOUR-PASSWORD]` por la contraseña de la base de datos. Tiene que ser la de **Session pooler** (GitHub no llega a la dirección directa). |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → tu foto (arriba a la derecha) → **Account preferences** → **Access Tokens** → **Generate new token**. Nómbralo `github-casa-maracuya`. |
| `SUPABASE_PROJECT_REF` | Supabase → el proyecto → **Project Settings** → **General** → **Project ID** (las letras de `xxxx.supabase.co`). |

> Si no recuerdas la contraseña de la base, se cambia en **Project Settings → Database → Reset
> database password**. Ojo: cualquier otra cosa que use la contraseña vieja deja de conectarse
> (la web y el panel no la usan; usan las llaves públicas).

### 3. Primera vez: correrlo a mano

1. Repositorio → **Actions** → **Supabase: aplicar cambios** → **Run workflow** → rama `main` → **Run workflow**.
2. Se queda esperando: toca **Review deployments** → marca `produccion` → **Approve and deploy**.
3. La primera vez da por hechas de la 0001 a la 0016 (ya estaban corridas) y corre de la 0017 en
   adelante. Si alguna ya la habías corrido a mano no pasa nada: todas se pueden volver a correr.
4. Al final tiene que decir, por ejemplo: `✓ registro_pago: PRUEBAS 0017: 24 pruebas, 0 fallas`.

---

## Desde ahí, cada vez

- Te llega un correo de GitHub: **«Deployment review»** (o lo ves en **Actions**).
- Abres, tocas **Review deployments** → **Approve and deploy**. Listo. Se puede hacer desde el celular.
- Si no quieres que se aplique todavía: **Reject**. No pasa nada en Supabase.

## Si algo falla

- GitHub te manda un correo. En **Actions** → el intento en rojo → **Aplicar en Supabase** se ve
  qué migración o qué prueba falló.
- La migración que falla no queda a medias (va en su propia transacción) y no se anota como hecha:
  cuando se arregle, el siguiente intento la vuelve a correr.

## Opcional: que los PR no salgan en rojo

El check «Workers Builds» de Cloudflare sale en rojo en los PR porque Cloudflare no compila las
ramas que no son `main`. En Cloudflare → Workers & Pages → `casamaracuyaweb` → **Settings** →
**Builds** → busca la opción de compilar ramas que no son de producción («non-production branch
builds») y actívala. No cambia lo que se publica en casa-maracuya.com.
