# Guia Del Ambiente Paralelo Stage 2

Esta guia describe como crear y operar un ambiente paralelo para probar Stage 2
sin tocar la base productiva de Stage 1.

## Objetivo

El ambiente paralelo debe permitir probar identidad de jugador, perfil, QR,
invitaciones de tienda y futuros flujos de Stage 2 con datos aislados.

El esquema recomendado queda asi:

| Pieza | Produccion estable | Ambiente paralelo |
| --- | --- | --- |
| Rama Git | `main` | `develop` |
| Supabase | proyecto productivo | proyecto Stage 2 separado |
| App deploy | Vercel production | Vercel preview/staging desde `develop` |
| Datos | reales/piloto estable | datos de prueba controlados |
| Emails | dominio real | dominio/subdominio o modo de prueba |

No apuntes el deploy de `develop` al Supabase productivo.

## Reglas De Seguridad

- No ejecutes `supabase db reset` contra un proyecto remoto.
- No cargues `supabase/seeds/02_dev_users.sql` en produccion.
- No mezcles keys de Supabase prod con el ambiente Stage 2.
- No expongas `SUPABASE_SERVICE_ROLE_KEY` en codigo cliente ni variables
  `NEXT_PUBLIC_*`.
- `VORTEXHUB_QR_PEPPER` es server-only y debe ser distinto por ambiente.
- Cambiar `VORTEXHUB_QR_PEPPER` invalida la capacidad de reconstruir payloads
  QR existentes, asi que su rotacion debe ser planificada.
- Los banners de Storage se reconstruyen con script, no solo con SQL.

## 1. Crear La Rama De Integracion

La rama `develop` ya existe y fue creada desde Stage 2:

```bash
git switch develop
git pull --ff-only origin develop
```

Uso esperado:

- Feature branches de Stage 2 se integran hacia `develop`.
- El ambiente paralelo despliega desde `develop`.
- `main` queda para produccion estable.
- Cuando Stage 2 este validado, se prepara merge controlado de `develop` a
  `main`.

## 2. Crear El Proyecto Supabase Stage 2

En Supabase Dashboard:

1. Crea un proyecto nuevo, por ejemplo `vortexhub-stage2`.
2. Usa la misma region de produccion salvo que haya una razon para aislarlo mas.
3. Guarda estos valores:
   - Project ref.
   - Project URL.
   - Publishable key o anon key.
   - Service role key.
   - Database password.
4. Activa la Data API para el schema `public` si el proyecto no lo hace por
   defecto.

No reutilices el proyecto productivo ni sus keys.

## 3. Preparar Variables Locales Para Stage 2

Crea un archivo local no versionado, por ejemplo `.env.stage2`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<stage2-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<stage2-publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<stage2-service-role-key>
VORTEXHUB_APP_URL=https://<stage2-app-domain>
VORTEXHUB_QR_PEPPER=<stage2-random-server-secret>
INVITE_EMAIL_PROVIDER=resend
RESEND_API_KEY=<stage2-or-shared-resend-api-key>
RESEND_FROM_EMAIL="VortexHub Stage 2 <no-reply@auth.example.com>"
RESEND_REPLY_TO_EMAIL=<optional-support-inbox>
```

Genera el pepper con:

```bash
openssl rand -base64 48
```

Checklist de variables:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Stage 2.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: key publica del proyecto Stage 2.
- `SUPABASE_SERVICE_ROLE_KEY`: solo para scripts server-side/backoffice.
- `VORTEXHUB_APP_URL`: dominio real del deploy Stage 2.
- `VORTEXHUB_QR_PEPPER`: secreto estable del ambiente Stage 2.
- `INVITE_EMAIL_PROVIDER`: `resend` para ambiente remoto.
- `RESEND_*`: requerido si se enviaran invitaciones reales.

## 4. Linkear Supabase CLI Al Proyecto Stage 2

Desde la raiz del repo:

```bash
npx supabase login
npx supabase link --project-ref <stage2-project-ref>
```

El link queda en `supabase/.temp/` y no debe commitearse.

Verifica que el proyecto linkeado sea Stage 2:

```bash
npx supabase migration list --linked
```

Si trabajas seguido con prod y Stage 2, revisa el project ref antes de aplicar
migraciones. Este paso evita el accidente clasico de apuntar al proyecto
equivocado.

## 5. Aplicar Migraciones Y Seed Base

Para un proyecto Stage 2 nuevo, aplica migraciones y seed SQL base:

```bash
npx supabase db push --linked --include-seed --yes
```

Esto aplica:

- Todos los archivos en `supabase/migrations/`.
- `supabase/seed.sql`, configurado en `supabase/config.toml`.

`supabase/seed.sql` crea datos base como juegos, documento legal vigente,
banners de plataforma como metadata y buckets de Storage. No sube archivos WebP
a Storage.

Para futuros cambios de schema ya versionados:

```bash
npx supabase migration up --linked
```

Antes de aplicar, puedes revisar que migraciones estan pendientes:

```bash
npx supabase db push --linked --dry-run
npx supabase migration list --linked
```

No uses `npm run supabase:reset` para remoto. Ese comando es destructivo y esta
pensado para local.

## 6. Restaurar Banners De Plataforma En Storage

Los archivos fuente estan versionados en:

```text
public/Banners/optimized/platform
```

Despues de aplicar migraciones y seed SQL, sube los WebP al bucket Stage 2:

```bash
node scripts/upload-platform-banners.mjs --env-file .env.stage2
```

El script:

- Crea/verifica el bucket `platform-event-banners`.
- Sube los WebP con `upsert: true`.
- Vincula cada archivo con `platform_event_banners`.
- Es idempotente: se puede volver a ejecutar si falta algun asset.

No uses `npm run supabase:seed:local` para Stage 2 remoto porque tambien intenta
cargar usuarios locales con password conocida. Para Stage 2 remoto usa el script
de banners directo.

## 7. Configurar Auth En Supabase

En Supabase Dashboard, configura Auth para el proyecto Stage 2.

### URLs

Usa el dominio real del deploy Stage 2:

```text
Site URL: https://<stage2-app-domain>
```

Agrega redirect URLs:

```text
https://<stage2-app-domain>/auth/callback
https://<stage2-app-domain>/auth/onboarding
https://<stage2-app-domain>/auth/login
```

Si Vercel usa dominios preview adicionales, agregalos tambien o usa un dominio
estable para el ambiente `develop`.

### Templates

El repo contiene templates para local:

```text
supabase/templates/invite.html
supabase/templates/magic_link.html
```

Para remoto hay dos opciones:

1. Usar `INVITE_EMAIL_PROVIDER=resend`.
   - Recomendado para Stage 2.
   - El script `scripts/invite-store-owner.mjs` genera el link seguro con
     Supabase y envia el HTML por Resend.
2. Replicar los templates en Supabase Dashboard.
   - Util si quieres que Supabase envie directamente.
   - Debes mantenerlos sincronizados manualmente.

El flujo actual usa:

- Nuevo usuario de tienda: invite.
- Usuario existente: magic link hacia onboarding con `passwordMode=skip`.
- Callback de email: `/auth/callback`.
- Onboarding final: `/auth/onboarding`.

## 8. Configurar Vercel Para `develop`

Hay dos opciones validas.

### Opcion A: Proyecto Vercel Separado

Recomendado para aislar Stage 2.

1. Crea un proyecto nuevo en Vercel, por ejemplo `vortexhub-stage2`.
2. Conectalo al mismo repo GitHub.
3. Configura que despliegue desde la rama `develop`.
4. Agrega variables de ambiente Stage 2.
5. Configura dominio estable, por ejemplo:

```text
stage2.vortexhub.example
```

Ventaja: menos riesgo de mezclar variables productivas y preview.

### Opcion B: Preview De La Misma App Vercel

Aceptable si la configuracion de variables esta muy controlada.

1. Mantener production en `main`.
2. Usar branch deploy para `develop`.
3. Definir variables solo para el ambiente preview/development que use Stage 2.
4. Verificar que `develop` nunca lea variables de prod.

Si hay duda, usa proyecto Vercel separado.

## 9. Variables En Vercel Stage 2

Configura en Vercel las mismas variables de `.env.stage2`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<stage2-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<stage2-publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<stage2-service-role-key>
VORTEXHUB_APP_URL=https://<stage2-app-domain>
VORTEXHUB_QR_PEPPER=<stage2-random-server-secret>
INVITE_EMAIL_PROVIDER=resend
RESEND_API_KEY=<stage2-or-shared-resend-api-key>
RESEND_FROM_EMAIL="VortexHub Stage 2 <no-reply@auth.example.com>"
RESEND_REPLY_TO_EMAIL=<optional-support-inbox>
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` debe existir solo como server-side secret.
- Nunca la uses con prefijo `NEXT_PUBLIC_`.
- Si Vercel permite scopes por ambiente, limita estas variables al proyecto o
  ambiente Stage 2.
- `VORTEXHUB_APP_URL` debe coincidir con el dominio permitido en Supabase Auth.

## 10. Configurar Email Para Stage 2

Para pruebas simples se puede usar un dominio ya verificado de Resend, pero lo
ideal es un remitente que deje claro que no es produccion:

```text
VortexHub Stage 2 <no-reply@auth.example.com>
```

Checklist Resend:

1. Verificar dominio o subdominio.
2. Publicar DNS DKIM/SPF.
3. Crear API key con permiso de envio.
4. Guardar API key en Vercel Stage 2.
5. Definir `RESEND_FROM_EMAIL`.

Para probar una invitacion:

```bash
npm run onboard:store-owner -- --env-file .env.stage2 qa-owner@example.com
```

El comando detecta si el correo ya existe:

- Si no existe, envia invite.
- Si existe, envia magic link para continuar con la misma cuenta.

## 11. Verificaciones Post-Deploy

Despues del primer deploy de `develop`, verifica:

### App

```bash
curl https://<stage2-app-domain>/api/v1/public/games
curl "https://<stage2-app-domain>/api/v1/public/calendar?limit=10"
```

### Supabase

```bash
npx supabase migration list --linked
npx supabase db lint --linked --level warning
```

### Storage

Abre una URL publica de banner:

```text
https://<stage2-project-ref>.supabase.co/storage/v1/object/public/platform-event-banners/platform/default.webp
```

### Auth Y Jugador

1. Abrir `https://<stage2-app-domain>/auth/login`.
2. Entrar o crear una cuenta.
3. Ir a `/player/me`.
4. Crear perfil de jugador.
5. Ir a `/player/qr`.
6. Confirmar que el QR renderiza.
7. Probar rotacion de QR.

### Tienda

1. Invitar owner con `npm run onboard:store-owner -- --env-file .env.stage2`.
2. Abrir el email recibido.
3. Completar onboarding.
4. Crear o abrir tienda.
5. Confirmar que la cuenta puede seguir teniendo perfil de jugador.

## 12. Flujo Diario De Trabajo

Para integrar nuevas piezas de Stage 2:

```bash
git switch develop
git pull --ff-only origin develop
git switch -c feat/<nombre-del-cambio>
```

Al terminar:

```bash
npm run typecheck
npm run build
git push -u origin feat/<nombre-del-cambio>
```

Luego mergea la feature hacia `develop`. El deploy Stage 2 debe tomar `develop`
como fuente.

Si la feature incluye migraciones:

1. Revisar SQL localmente.
2. Mergear a `develop`.
3. Aplicar migraciones al Supabase Stage 2:

```bash
npx supabase migration up --linked
```

4. Verificar `npx supabase migration list --linked`.
5. Redeploy de Vercel si no se disparo automaticamente.

## 13. Que No Debe Hacerse

- No conectar `develop` a Supabase prod.
- No ejecutar `supabase db reset` contra Stage 2 remoto.
- No cargar usuarios dev locales en Stage 2 remoto salvo decision explicita y
  temporal.
- No reutilizar `VORTEXHUB_QR_PEPPER` de produccion.
- No rotar `VORTEXHUB_QR_PEPPER` sin plan.
- No enviar invitaciones Stage 2 desde un remitente que parezca produccion si
  los usuarios son testers.

## 14. Recuperacion Si El Ambiente Queda Incompleto

Si faltan banners:

```bash
node scripts/upload-platform-banners.mjs --env-file .env.stage2
```

Si faltan tablas o funciones:

```bash
npx supabase migration list --linked
npx supabase migration up --linked
```

Si faltan datos base como juegos o documento legal:

```bash
npx supabase db push --linked --include-seed --yes
```

Si Auth rechaza links:

1. Revisa Site URL.
2. Revisa Redirect URLs.
3. Revisa que `VORTEXHUB_APP_URL` coincida con el dominio Stage 2.
4. Reenvia la invitacion.

## 15. Checklist Final

- [ ] Rama `develop` existe y esta en GitHub.
- [ ] Proyecto Supabase Stage 2 creado.
- [ ] CLI linkeado al project ref Stage 2.
- [ ] Migraciones aplicadas.
- [ ] `supabase/seed.sql` aplicado.
- [ ] Banners subidos a Storage.
- [ ] Supabase Auth Site URL configurada.
- [ ] Redirect URLs configuradas.
- [ ] Vercel Stage 2 creado o branch deploy configurado.
- [ ] Variables de Vercel apuntan solo a Supabase Stage 2.
- [ ] `VORTEXHUB_QR_PEPPER` definido y guardado.
- [ ] Resend configurado o modo de email decidido.
- [ ] Login de jugador probado.
- [ ] Perfil de jugador probado.
- [ ] QR probado.
- [ ] Invitacion de tienda probada.
