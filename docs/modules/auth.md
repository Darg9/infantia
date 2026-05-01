# Módulo: Autenticación y Gestión de Identidad

**Versión:** ✅ v0.18.0-stable
**Última actualización:** 1 de mayo de 2026

Este módulo centraliza toda la lógica de autenticación multi-proveedor de HabitaPlan, la sincronización de identidades y el cumplimiento legal de términos obligatorios.

---

## 🏗️ Arquitectura General

### Fuente de Verdad Única

- **Supabase Auth** es el emisor único de identidad (JWT). Su `user.id` es la clave primaria de toda decisión de identidad.
- **Prisma (`public.users`)** actúa como un espejo de negocio (Lazy Sync) — se hidrata en cada login exitoso. **No es la fuente de identidad.**
- **Account Linking nativo de Supabase**: configuración obligatoria en el dashboard → `Authentication > Sign In / Providers > Email > "Link identities to a single user based on email"`.

### Proveedores Activos

| Proveedor | Estado | Notas |
|---|---|---|
| Google | ✅ Activo | Requiere credenciales Google Cloud OAuth 2.0 |
| Email + Contraseña | ✅ Activo | Fallback tradicional |
| Magic Link (email OTP) | ✅ Activo | Método primario de email desde v0.16.1 |
| Teléfono (SMS OTP) | 🔜 Feature flag | `NEXT_PUBLIC_ENABLE_PHONE_OTP=true` para activar |
| Facebook | ❌ Oculto | Desactivado temporalmente por UX y revisión |
| Apple | ❌ Oculto | Desactivado temporalmente por revisión |

---

## 🔄 Flujo Unificado de Autenticación

```
[Google / Magic Link / Email+Pass / OTP]
         ↓
[Supabase Auth → session establecida]
         ↓
[/auth/callback → exchangeCodeForSession(code)]
         ↓
[getOrCreateDbUser(user) → Prisma upsert]
         ↓
[¿termsAcceptedAt === null?]
  ├── SÍ → /auth/terminos?next=<ruta original>
  │         [Usuario acepta] → Server Action → updatedAt
  └── NO → redirect a ruta original (default: /)
```

---

## 📁 Archivos Clave

| Archivo | Responsabilidad |
|---|---|
| `src/lib/auth.ts` | `getOrCreateDbUser()` — Lazy Sync Prisma |
| `src/app/auth/callback/route.ts` | Portero central. Único punto de entrada post-auth |
| `src/app/auth/terminos/page.tsx` | Pantalla obligatoria de aceptación legal |
| `src/app/login/page.tsx` | UI de login multi-proveedor |
| `src/app/registro/page.tsx` | UI de registro multi-proveedor |

---

## 🗄️ Modelo de Usuario (Prisma)

```prisma
model User {
  id                String    @id @default(uuid())
  supabaseAuthId    String    @unique @map("supabase_auth_id")
  email             String?             // NO unique: Opcional — usuarios OTP pueden no tener email
  phone             String?             // NO unique: Para futura activación de SMS OTP
  name              String
  role              UserRole  @default(PARENT)
  termsAcceptedAt   DateTime?           // Auditoría legal. null = no ha aceptado
  provider          String    @default("email")  // Informativo/analítica
  avatarUrl         String?
  // ... resto de campos
}
```

### Reglas críticas de integridad
- `supabaseAuthId` es la **única clave de lookup** — nunca usar `email` como clave.
- `email` es opcional para soportar usuarios OTP (solo teléfono).
- `termsAcceptedAt` se establece en `getServerTimestamp()` al aceptar — nunca en el frontend.
- `provider` se actualiza en cada login para reflejar el último método usado (analítica).

---

## 🔐 `getOrCreateDbUser()` — Lazy Sync

```typescript
// src/lib/auth.ts
export async function getOrCreateDbUser(authUser: User) {
  const name = authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0] ?? 'Usuario'
  const provider = authUser.app_metadata?.provider ?? 'email'

  try {
    return await prisma.user.upsert({
      where: { supabaseAuthId: authUser.id },
      create: { supabaseAuthId: authUser.id, email: authUser.email ?? null, phone: authUser.phone ?? null, provider, name, role: 'PARENT' },
      update: {
        provider,
        ...(authUser.email ? { email: authUser.email } : {}),
        ...(authUser.phone ? { phone: authUser.phone } : {}),
      },
    })
  } catch (err: any) {
    if (err.code === 'P2002') {
      const existing = await prisma.user.findUnique({ where: { supabaseAuthId: authUser.id } })
      if (existing) return existing
    }
    throw err
  }
}
```

### Cuándo se llama
- Exclusivamente en `src/app/auth/callback/route.ts` tras cada login exitoso.
- **Nunca** llamar desde el cliente.

---

## 📱 Magic Link (Método Primario de Email)

Implementado vía `supabase.auth.signInWithOtp({ email })`.

### Flujo UX en `/login`
1. Usuario escribe su correo-e
2. Click en **"Enviarme enlace de acceso"**
3. Estado: check verde + "Enlace enviado" con mensaje + hint de carpeta Spam
4. Cooldown de 60s antes de permitir reenvío
5. "Cambiar correo" → vuelve al input (email persistido)
6. Al llegar al inbox → clic en enlace → Supabase autentica → `/auth/callback`

### Contraseña como fallback
- Disponible vía "¿Tienes contraseña? Inicia sesión" (progressive disclosure)
- No visible por defecto

---

## 📋 Pantalla de Términos (`/auth/terminos`)

- **Obligatoria** para todos los usuarios nuevos (SSO, Magic Link, Email, OTP)
- El callback detecta `termsAcceptedAt === null` y redirige aquí
- La aceptación se guarda vía **Server Action** (no API Route) para evitar race conditions
- La ruta original del usuario se preserva en el parámetro `?next=` a través de todo el flujo

---

## 🌐 URL Configuration (Supabase Dashboard)

| Campo | Valor |
|---|---|
| Site URL | `https://www.habitaplan.com` |
| Redirect URLs | `https://www.habitaplan.com/auth/callback` |
| | `https://www.habitaplan.com/**` |
| | `https://infantia-activities.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` |

---

## 🚩 Feature Flags de Auth

| Flag | Variable de entorno | Default | Efecto |
|---|---|---|---|
| OTP Teléfono | `NEXT_PUBLIC_ENABLE_PHONE_OTP` | `false` | Muestra/oculta botón de Teléfono en login y registro |

---

## 📊 Métricas Recomendadas a Trackear

- `% login por método` (Google / Magic Link / Password)
- `drop-off en flujo OTP` (enviado vs verificado)
- `tasa de aceptación de términos` (nuevo → acepta)
- `tiempo promedio a primer login exitoso`

---

## ⚠️ Reglas de Operación

1. **Nunca** usar `email` como clave de búsqueda de usuario — siempre `supabaseAuthId`.
2. **Nunca** crear usuarios manualmente en Prisma sin pasar por `getOrCreateDbUser`.
3. **Nunca** marcar `termsAcceptedAt` desde el cliente — solo Server Action.
4. Para activar un nuevo proveedor OAuth: configurar en Supabase Dashboard **antes** de mostrar el botón en UI.
5. El Account Linking nativo de Supabase debe estar **siempre activo** — sin esto se crean cuentas duplicadas.
