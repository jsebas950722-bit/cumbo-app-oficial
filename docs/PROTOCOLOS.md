# Protocolos para que Cumbo funcione al 100%

Auditoría completa a la fecha (agosto 2026). Se organiza en 6 bloques.
Cada ítem indica su estado real:

- ✅ **Ya existe** — construido y verificado
- ⚠️ **Parcial** — existe algo, pero no está completo
- ❌ **Falta** — no existe todavía

---

## 1. Seguridad técnica y acceso a datos

| Protocolo | Estado | Detalle |
|---|---|---|
| Row Level Security en todas las tablas | ✅ | Cada tabla tiene políticas por rol (cliente/caficultor/vendedor/logística/CEO) |
| Autenticación real | ✅ | Supabase Auth (correo/contraseña + Google OAuth) |
| Separación de datos sensibles | ✅ | Cuentas bancarias y cédula en `fincas_datos_pago`, tabla aparte con RLS propia — nunca expuestas en el Marketplace |
| Funciones de pago exigen sesión propia | ✅ (corregido hoy) | `verify_jwt=true` + verificación de que el pedido pertenezca a quien llama — antes cualquiera sin sesión podía generar un link de cobro |
| Rate limiting en Edge Functions | ❌ | Nada impide que alguien llame `crear-preferencia-pago` en bucle. Supabase tiene límites por proyecto, pero no hay límite por usuario/IP a nivel de código |
| CORS restringido a tu dominio | ⚠️ | Hoy `Access-Control-Allow-Origin: *` en todas las funciones — funciona, pero cualquier sitio podría invocarlas desde el navegador de un usuario logueado. Se restringe fácil cuando tengas el dominio final |
| Validación de inputs en Edge Functions | ⚠️ | Se valida que existan los campos obligatorios, pero no hay una librería de validación de esquemas (ej: Zod) — funciona, pero no es robusto ante datos malformados |
| Backups de la base de datos | ⚠️ | Supabase hace backups automáticos en planes pagos — confirmar qué plan tenés y su política de retención |
| Monitoreo de errores en producción | ❌ | No hay Sentry ni similar — hoy los errores solo se ven en la consola del navegador de quien los sufre, nadie se entera del lado de Cumbo |
| Analítica de uso | ❌ | No hay Plausible/PostHog/Google Analytics — no hay forma de saber cuánta gente usa cada pantalla |

---

## 2. Pagos y dinero

| Protocolo | Estado | Detalle |
|---|---|---|
| Cobro real (Mercado Pago + Wompi) | ✅ | Con webhooks que validan firma antes de marcar como pagado |
| Conciliación contable | ❌ | No hay proceso que compare lo que dicen Mercado Pago/Wompi contra lo que dice `pedidos.pago_confirmado` — si un webhook falla silenciosamente, nadie se entera |
| Facturación electrónica DIAN | ❌ | **Obligatoria en Colombia** según el calendario de la DIAN por tipo de contribuyente — sin esto, no podés facturar legalmente por encima del umbral que te asignen. Formato exigido: XML UBL 2.1 validado por la DIAN. Esto normalmente se resuelve con un proveedor tecnológico autorizado (ej: Alegra, Siigo, Factus), no construyéndolo desde cero |
| Comisión de Cumbo sobre ventas de vendedores (8%) | ⚠️ | Está documentada en el código/Constitución, pero no hay ningún proceso automático que cobre o descuente esa comisión — hoy es solo un número de referencia |

---

## 3. Cumplimiento legal (Colombia)

Esto es lo que más urgente encontré — no es código, es documentación legal
que la ley exige tener **publicada y accesible** antes de operar:

| Protocolo | Estado | Ley aplicable |
|---|---|---|
| Política de tratamiento de datos personales | ❌ | Ley 1581 de 2012 (Habeas Data). Obligatoria — la SIC puede multar hasta 2.000 SMLMV por no tenerla |
| Casilla de consentimiento explícito al registrarse | ❌ | Misma ley — hoy `Ingreso.jsx` crea la cuenta sin pedir consentimiento explícito de tratamiento de datos |
| Términos y condiciones de uso | ❌ | Ley 1480 de 2011 (Estatuto del Consumidor) |
| Aviso de derecho de retracto (5 días hábiles) | ❌ | Misma ley — el cliente tiene derecho a devolver su compra sin dar explicaciones dentro de los 5 días hábiles después de recibirla. Hoy el FAQ solo menciona devoluciones por producto dañado, no este derecho específico |
| Registro mercantil / Cámara de Comercio | ⚠️ | Ya se investigaron los códigos CIIU en una sesión anterior — confirmar que el registro ya esté hecho |
| Impuesto de Industria y Comercio (ICA) | ❌ | Tributo municipal sobre la actividad comercial, se declara ante la Secretaría de Hacienda del municipio donde opera Cumbo |

**Esto no lo puedo resolver yo solo con código** — la política de
privacidad y los términos y condiciones son documentos legales que
idealmente redacta o revisa un abogado, aunque puedo armarte un
borrador inicial si querés partir de algo.

---

## 4. Publicación en las tiendas de apps

| Protocolo | Estado | Detalle |
|---|---|---|
| Cuenta de Apple Developer | ⚠️ | Mencionado como necesario desde el inicio del proyecto — confirmar que ya la tengas |
| Cuenta de Google Play Console | ⚠️ | Mismo caso |
| Política de privacidad con URL pública | ❌ | Apple y Google la exigen como requisito de publicación, no es opcional — necesita estar en una URL real, no solo en este documento |
| Eliminación de cuenta desde la app | ❌ | Apple exige que si dejás crear cuenta, también dejés eliminarla desde la app — hoy no existe esa opción en Perfil |
| Ícono y capturas de pantalla para la ficha de la tienda | ❌ | Tenés el logo, pero no assets preparados en los tamaños que exige cada tienda |
| Notificaciones push | ❌ | No configuradas — opcional, pero común para avisar cambios de estado de pedido |

---

## 5. Calidad y pruebas

| Protocolo | Estado | Detalle |
|---|---|---|
| Compilación verificada | ✅ | Cada cambio se compiló y verificó sin errores antes de entregarse |
| Linter (ESLint) | ✅ | Configurado, encontró y corrigió 1 error real. Cubre `src/` (React) — las Edge Functions en `supabase/functions/` son Deno/TypeScript y quedaron fuera de este linter a propósito, necesitarían `deno lint` por separado |
| CI automático | ✅ | GitHub Actions corre lint + build en cada push |
| Pruebas automatizadas (unitarias/integración) | ❌ | No existe ni un solo test. Todo lo verificado hasta ahora fue manual (compilar y revisar) |
| Pruebas end-to-end (flujo completo de compra) | ❌ | Nadie probó el flujo completo con datos y credenciales reales todavía — sigue pendiente que lo hagas vos con tu propio Supabase conectado |

---

## 6. Operación y continuidad del negocio

| Protocolo | Estado | Detalle |
|---|---|---|
| Atención al cliente | ✅ | Chat flotante de WhatsApp (falta el número real, hoy es un placeholder) |
| Proceso de devoluciones/reembolsos | ⚠️ | Se menciona en el FAQ, pero no hay ningún flujo en la app que gestione una devolución real (reembolso vía Mercado Pago/Wompi, actualización de estado) |
| Plan de recuperación ante desastres | ❌ | Si Supabase tiene una caída, o si alguien borra datos por error, no hay un plan documentado de qué hacer |
| Documentación para nuevos desarrolladores | ✅ | El README ya documenta cada pieza construida y por qué |

---

## Prioridad sugerida (si tuviera que elegir por dónde seguir)

1. **Política de privacidad + consentimiento al registrarse** — es lo
   más rápido de resolver y lo que más expone a Cumbo legalmente si
   alguien pone una queja en la SIC.
2. **Derecho de retracto en el FAQ/checkout** — un párrafo, bajo riesgo,
   evita una sanción concreta y específica.
3. **Facturación electrónica DIAN** — más grande, probablemente se
   resuelve con un proveedor externo (Alegra/Siigo/Factus) en vez de
   construirlo a mano.
4. **Monitoreo de errores (Sentry)** — barato de agregar, te avisa si
   algo se rompe en producción antes de que un cliente se queje.
5. **Rate limiting + CORS restringido** — antes de tener tráfico real,
   no es urgente; antes de escalar, sí.
