# Protocolos para que Cumbo funcione al 100%

Auditoría completa a la fecha (agosto 2026), actualizada tras la ronda
de correcciones. Se organiza en 6 bloques. Cada ítem indica su estado
real:

- ✅ **Ya existe** — construido y verificado
- ⚠️ **Parcial** — existe algo, pero no está completo
- ❌ **Falta** — necesita algo que solo tú puedes hacer (cuenta externa, decisión de negocio, revisión legal)

---

## 1. Seguridad técnica y acceso a datos

| Protocolo | Estado | Detalle |
|---|---|---|
| Row Level Security en todas las tablas | ✅ | Cada tabla tiene políticas por rol |
| Autenticación real | ✅ | Supabase Auth (correo/contraseña + Google OAuth) |
| Separación de datos sensibles | ✅ | Cuentas bancarias y cédula en tabla aparte con RLS propia |
| Funciones de pago exigen sesión propia | ✅ | `verify_jwt=true` + verificación de dueño del pedido |
| Rate limiting en Edge Functions | ✅ | Máx. 8 pedidos/minuto por usuario en las funciones de pago — corrigido en esta ronda |
| CORS restringido a tu dominio | ✅ (configurable) | Ya no es `'*'` fijo — usa `FRONTEND_URL`. **Falta que tú** configures esa variable con tu dominio real cuando lo tengas |
| Eliminación de cuenta real | ✅ | Edge Function que borra de verdad, anonimizando pedidos (no borrándolos) para cumplir retención contable |
| Validación de inputs en Edge Functions | ⚠️ | Se valida que existan los campos obligatorios, sin librería de esquemas (ej: Zod) — funciona, no es exhaustivo |
| Backups de la base de datos | ❌ | **Depende de tu plan de Supabase** — confirmar cuál tenés y su política de retención |
| Monitoreo de errores en producción | ✅ (opcional) | Sentry integrado — no hace nada hasta que configures `VITE_SENTRY_DSN` (cuenta gratuita en sentry.io) |
| Analítica de uso | ❌ | Sigue sin resolver — necesita elegir una herramienta (Plausible/PostHog/GA) y una decisión tuya de cuál |

---

## 2. Pagos y dinero

| Protocolo | Estado | Detalle |
|---|---|---|
| Cobro real (Mercado Pago + Wompi) | ✅ | Con webhooks que validan firma |
| Conciliación contable | ❌ | Sigue sin un proceso que compare lo que dicen las pasarelas contra `pedidos.pago_confirmado` |
| Facturación electrónica DIAN | ❌ | **No lo puedo resolver con código de la app** — necesita un proveedor tecnológico externo (Alegra, Siigo, Factus) y una decisión de negocio de con cuál trabajar |
| Comisión de Cumbo sobre ventas (8%) | ⚠️ | Documentada, pero sigue sin cobro automático |

---

## 3. Cumplimiento legal (Colombia)

| Protocolo | Estado | Detalle |
|---|---|---|
| Política de tratamiento de datos personales | ✅ (borrador) | `/privacidad` — **necesita revisión de un abogado antes de considerarse definitiva**, pero ya no está vacía |
| Casilla de consentimiento explícito al registrarse | ✅ | Obligatoria, con fecha registrada en `usuarios.consentimiento_datos_en` |
| Términos y condiciones de uso | ✅ (borrador) | `/terminos` — mismo aviso que la política de privacidad |
| Aviso de derecho de retracto (5 días hábiles) | ✅ | Incluido en los Términos y Condiciones, sección 4 |
| Registro mercantil / Cámara de Comercio | ❌ | **Trámite tuyo**, fuera del alcance del código |
| Impuesto de Industria y Comercio (ICA) | ❌ | **Trámite tuyo** ante la Secretaría de Hacienda municipal |

---

## 4. Publicación en las tiendas de apps

| Protocolo | Estado | Detalle |
|---|---|---|
| Cuenta de Apple Developer | ❌ | **Solo tú puedes crearla** (requiere pago y verificación de identidad/empresa) |
| Cuenta de Google Play Console | ❌ | **Solo tú puedes crearla** |
| Política de privacidad con URL pública | ✅ | Ya existe en `/privacidad` — cuando despliegues la app, esa URL queda pública automáticamente |
| Eliminación de cuenta desde la app | ✅ | Implementada en esta ronda — Apple lo exige y ya está |
| Ícono y capturas de pantalla para la ficha de la tienda | ❌ | Trabajo de diseño, no de código — puedo ayudarte cuando llegues a ese punto |
| Notificaciones push | ❌ | No configuradas — opcional |

---

## 5. Calidad y pruebas

| Protocolo | Estado | Detalle |
|---|---|---|
| Compilación verificada | ✅ | Cada cambio se compiló antes de entregarse |
| Linter (ESLint) | ✅ | Sin errores |
| CI automático | ✅ | Lint + tests + build en cada push |
| Pruebas automatizadas | ✅ | 12 pruebas reales sobre la lógica de tarifas/precios — es un comienzo, no cobertura completa |
| Pruebas end-to-end (flujo completo de compra) | ❌ | **Sigue pendiente que tú lo prueques** con tus propias credenciales reales de Supabase/Mercado Pago/Wompi — nadie puede probar esto sin esas credenciales |

---

## 6. Operación y continuidad del negocio

| Protocolo | Estado | Detalle |
|---|---|---|
| Atención al cliente | ✅ | Chat flotante de WhatsApp (**falta que pongas el número real**) |
| Proceso de devoluciones/reembolsos | ⚠️ | El derecho de retracto ya está documentado en los Términos, pero todavía no hay un flujo en la app que gestione una devolución de punta a punta (solicitud → aprobación → reembolso real vía la pasarela) |
| Plan de recuperación ante desastres | ❌ | Sigue sin documentar — depende de qué plan de Supabase tengas |
| Documentación para nuevos desarrolladores | ✅ | README + este documento |

---

## Lo que quedó pendiente y por qué no lo resolví yo

Estos ítems necesitan algo que solo tú puedes dar — una cuenta, un
trámite, una decisión de negocio, o la revisión de un profesional:

1. **Revisión legal** de los borradores de Política de Privacidad y
   Términos — son un punto de partida sólido y específico de Cumbo,
   pero un abogado debería confirmarlos antes de que sean definitivos.
2. **Facturación electrónica DIAN** — requiere elegir un proveedor
   externo (Alegra, Siigo, Factus) y probablemente ya tener el registro
   mercantil resuelto.
3. **Cuentas de Apple Developer y Google Play Console** — pagos y
   verificación de identidad que nadie más puede hacer por ti.
4. **Número real de WhatsApp** de atención al cliente.
5. **Confirmar tu plan de Supabase** y su política real de backups.
6. **Proceso de devoluciones de punta a punta** — es construible, pero
   es una pieza grande aparte; decime si querés que sigamos por ahí.
