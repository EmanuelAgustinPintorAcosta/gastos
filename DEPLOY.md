# Hogar — Paso a paso a producción (Supabase + Vercel)

La app ya tiene login (Guada / Ema), sync en la nube y privacidad de gastos personales.

## Qué queda compartido vs privado

| Tipo | ¿Quién lo ve? | ¿Quién lo carga? |
|------|---------------|------------------|
| Ingresos | Los dos | Cada uno el suyo |
| Gastos de casa | Los dos | Cualquiera (indica quién pagó) |
| Gastos personales | Solo el dueño | Solo a tu nombre |

Contraseña inicial sugerida al crear usuarios: `123456` (después se cambia desde la app). La sesión queda guardada en el dispositivo.

---

## 1. Crear el proyecto en Supabase

1. Entrá a [https://supabase.com](https://supabase.com) y creá un proyecto.
2. Anotá la **región** (ej. South America).
3. Cuando esté listo: **Project Settings → API**
   - Copiá **Project URL**
   - Copiá **anon public** key

## 2. Crear los dos usuarios

1. Ir a **Authentication → Users → Add user → Create new user**
2. Crear **Guada**
   - Email: `guada@hogar.app` (o el que pongas en `js/config.js`)
   - Password: `123456`
   - Marcar **Auto Confirm User**
3. Crear **Ema**
   - Email: `ema@hogar.app`
   - Password: `123456`
   - Auto Confirm User
4. En cada usuario, copiá el **User UID** (UUID).

Opcional recomendado: **Authentication → Providers → Email**
- Desactivar “Confirm email” si está activo (para que ande con emails inventados tipo `@hogar.app`).

## 3. Correr el SQL

1. **SQL Editor → New query**
2. Pegá y ejecutá todo el contenido de `supabase/schema.sql`
3. Nueva query: abrí `supabase/seed-profiles.sql`
4. Reemplazá:
   - `PEGAR-UUID-DE-GUADA` → UID de Guada
   - `PEGAR-UUID-DE-EMA` → UID de Ema
5. Ejecutá

## 4. Activar Realtime (para sync en vivo)

1. **Database → Publications** (o **Realtime**)
2. Asegurate de que la tabla `transactions` esté en la publication `supabase_realtime`
3. Si el SQL del schema falló en esa línea porque ya existía, no pasa nada: verificá en el panel.

## 5. Configurar la app

Editá `js/config.js`:

```js
window.HOGAR_CONFIG = {
  supabaseUrl: "https://XXXX.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  users: {
    guadalupe: { email: "guada@hogar.app", name: "Guadalupe", short: "Guada" },
    emanuel: { email: "ema@hogar.app", name: "Emanuel", short: "Ema" },
  },
};
```

Los emails de `config.js` tienen que ser **exactamente** los mismos que creaste en Auth.

## 6. Probar en local

1. Abrí `index.html` con un server local (Live Server / `npx serve`).
2. Entrá como Guada con `123456`.
3. Cargá un gasto personal → en otra ventana / celular entrá como Ema: **no** debería ver ese personal.
4. Cargá un gasto de casa → Ema sí lo ve.

## 7. Subir a Vercel

1. Subí el repo a GitHub (o usá Vercel CLI).
2. En [https://vercel.com](https://vercel.com) → **Add New Project** → importá el repo.
3. Framework preset: **Other** (sitio estático).
4. Root directory: la carpeta del proyecto (`gastos`).
5. Build command: vacío. Output: vacío (o `.`).
6. Deploy.

## Variables de entorno en Vercel

**No hacen falta.** La URL y la anon key van en `js/config.js` (ya desplegado).
La seguridad real está en las políticas RLS de Supabase, no en esconder la anon key.

Si la web se queda en “Cargando Hogar…”, redeployá después de un fix de arranque y forzá recarga (Ctrl+F5).


## 8. Después del deploy

1. Abrí la URL de Vercel en los dos celulares.
2. Entrar cada uno con su usuario y `123456`.
3. Cambiar la contraseña: ícono de persona → **Cambiar contraseña**.
4. Listo: lo que carguen de casa/ingresos aparece en los dos; lo personal no.

---

## Problemas frecuentes

| Error | Qué revisar |
|-------|-------------|
| “Falta configurar js/config.js” | URL / anon key sin pegar |
| “Contraseña incorrecta o usuario no creado” | Emails distintos entre Auth y config.js, o password mal |
| “Falta el perfil en la tabla profiles” | No corriste `seed-profiles.sql` con los UUID bien |
| No sync en vivo | Realtime / publication de `transactions` |
| Personal se ve del otro | RLS no aplicada: volvé a correr `schema.sql` |

## Seguridad (resumen)

- La **anon key** no es secreta; protege la data el **Row Level Security**.
- Los personales solo se leen si `person = mi slug`.
- Casa e ingresos: lectura/escritura para usuarios autenticados del hogar.
