# dashboard-turismo

Dashboard de operaciones interno para una agencia de turismo en San Pedro de Atacama, Chile. Cubre ventas/cotizaciones, calendario, recepciones, transfers, agencias, proveedores, flujo de caja, comisiones, facturación, aprobaciones, alertas, analíticas, usuarios y roles.

> **Stack**: Next.js 16 (App Router) · React 19 · Prisma 7 · PostgreSQL · Better Auth · TanStack · shadcn/ui · Tailwind 4 · Zod 4

## Modos de ejecución

La aplicación corre en dos modos, seleccionados por la variable de entorno `DEMO_MODE`:

| Modo | `DEMO_MODE` | Base de datos | Comportamiento |
| --- | --- | --- | --- |
| **Producción** | ausente / `false` | PostgreSQL (Neon) vía `@prisma/adapter-pg` | Marca real, emails (Resend), uploads (Vercel Blob) y rate limiting activos. |
| **Demo** | `"true"` | PGlite (Postgres en proceso) cargado desde un snapshot bundleado | Marca ficticia, auto-login, emails y uploads mockeados, sin servicios externos. |

El flag es la única costura entre ambos modos: el mismo esquema Prisma (incluidos los campos `@db.Date`) y los mismos server actions corren sin cambios en los dos, porque PGlite ES Postgres real. El switch vive en `src/lib/prisma.ts`; `src/lib/demo.ts` expone el flag como `IS_DEMO`.

La demo pública es 100% autocontenida: no requiere infraestructura externa (sin Neon, sin tokens, sin servicios gestionados). Para desplegarla basta con definir `DEMO_MODE=true`, `NEXT_PUBLIC_BASE_URL`, `BETTER_AUTH_SECRET` y un `DATABASE_URL` dummy.

---

## 🧩 Módulo: Registro de Ventas

### 🔹 Bloque 1: Información General

| Campo             | Tipo de Dato | Formato / Validación                                              | Obligatorio          | Observaciones                                                       |
| ----------------- | ------------ | ----------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| Tipo de Registro  | Selección    | Opciones: “Venta” / “Cotización”                                  | ✅                   | Cotización puede transformarse en venta posteriormente              |
| Vendedor          | Automático   | Se obtiene desde el usuario autenticado                           | ✅                   | No editable, se guarda automáticamente                              |
| Canal de Venta    | Selección    | “Mayorista”, “Físico”, “Online”, “Agencia”                        | ✅                   | Determina la lógica de precios, flujo y permisos                    |
| Correo de Cliente | Texto        | Validación formato email                                          | ✅                   | En “Mayorista” se obtiene desde la ficha técnica; otros lo ingresan |
| Número de File    | Texto        | Validación según operador o prefijo. “Pendiente” si no disponible | ✅ (solo operadores) | Ejemplo: Ecatur comienza con “R”                                    |
| Comentarios       | Texto libre  | —                                                                 | Opcional             | Campo de observaciones                                              |

---

### 🔹 Bloque 2: Detalle de Evento / Tour

| Campo            | Tipo de Dato | Formato / Validación      | Obligatorio | Observaciones                                                   |
| ---------------- | ------------ | ------------------------- | ----------- | --------------------------------------------------------------- |
| Modo de Venta    | Selección    | “Regular” / “Privado”     | ✅          | Regular: precio fijo / Privado: precio variable según pasajeros |
| Fecha del Evento | Fecha        | No anterior al día actual | ✅          | Valor por defecto: fecha actual                                 |
| Tour / Evento    | Selección    | Lista según modo de venta | ✅          | Regular: mantenedor de tours / Privado: precios variables       |
| Comentarios      | Texto libre  | —                         | Opcional    | Observaciones adicionales                                       |

---

### 🔹 Bloque 3: Detalle de Pasajeros

| Campo              | Tipo de Dato  | Formato / Validación                           | Obligatorio | Observaciones                              |
| ------------------ | ------------- | ---------------------------------------------- | ----------- | ------------------------------------------ |
| Nombre             | Texto         | Letras y espacios                              | ✅          | Nombre completo del pasajero               |
| RUT / Pasaporte    | Texto         | Formato válido según tipo                      | ✅          | Validar estructura chilena o pasaporte     |
| Edad               | Número entero | 0–120                                          | ✅          | Debe ser mayor a 0                         |
| Nacionalidad       | Selección     | Lista desplegable de países                    | ✅          | —                                          |
| Alimentación       | Selección     | Normal / Vegetariana / Vegana / Celíaco / Otra | ✅          | —                                          |
| Teléfono           | Texto         | Formato chileno (+56 9 XXXX XXXX)              | ✅          | Validar longitud y prefijo                 |
| Hotel              | Texto         | —                                              | ✅          | Puede incluir nombre comercial o dirección |
| Correo electrónico | Texto         | Formato email válido                           | Opcional    | —                                          |

---

### 🔹 Bloque 4: Registro de Pago del Tour

| Campo                     | Tipo de Dato      | Formato / Validación                                     | Obligatorio | Observaciones                              |
| ------------------------- | ----------------- | -------------------------------------------------------- | ----------- | ------------------------------------------ |
| Devolución                | Booleano (switch) | Activado/Desactivado                                     | No          | Indica si el pago corresponde a devolución |
| Medio de Pago             | Selección         | Efectivo / Transferencia / Tarjeta / Link de Pago / Otro | ✅          | Puede requerir comprobante adicional       |
| Monto                     | Decimal           | Valor monetario (CLP)                                    | ✅          | Mayor que 0                                |
| Fecha Movimiento          | Fecha             | Calendario emergente                                     | ✅          | Fecha de realización del pago              |
| Comentarios               | Texto libre       | —                                                        | Opcional    | Observaciones adicionales                  |
| N° Documento / Referencia | Texto             | Código de transacción o comprobante                      | ✅          | Para conciliaciones bancarias              |

---

### 🔹 Bloque 5: Resumen Final

- Panel editable con opción de exportar PDF con o sin precio.
- Envío por correo (futuro: integración con WhatsApp API).

---

## ⚠️ Problemáticas Actuales

- Registro manual y propenso a errores.
- Errores en número de file (por operador).
- Dificultad con precios diferenciados.
- Falta de trazabilidad del flujo de ventas y cotizaciones.
- Procesos manuales para envío de información.
- Falta de control de cotizaciones vencidas.

---

## ✅ Expectativas del Cliente

- Automatización del registro y validaciones.
- Paneles de navegación y control.
- Exportación y envío automático de documentos.
- Integración futura con API de WhatsApp.
- Capacitación continua al personal interno.

---

## 🧱 Modelos Iniciales Identificados

### 1. `SaleRecord`

Registro principal de venta o cotización.

### 2. `EventDetail`

Detalle del evento o tour asociado.

### 3. `Passenger`

Listado de pasajeros vinculados a la venta.

### 4. `PaymentRecord`

Historial de pagos y devoluciones.

### 5. `Agency`

Datos de agencias mayoristas (sin usuarios asociados).

---

## 🗃️ Ejemplo de Datos Locales (Tours de Ejemplo)

Estos se usarán temporalmente hasta la creación del mantenedor de tours.

```json
[
  { "id": "tour-001", "name": "Valle de la Luna", "type": "Regular", "duration": "Medio día" },
  {
    "id": "tour-002",
    "name": "Lagunas Altiplánicas y Piedras Rojas",
    "type": "Privado",
    "duration": "Día completo"
  },
  { "id": "tour-003", "name": "Salar de Tara", "type": "Regular", "duration": "Día completo" }
]
```

---

## 🔮 Próximos Pasos

- Elaboración del esquema inicial de base de datos (Prisma ORM).
- Definición de reglas de validación y flujos de negocio.
- Revisión técnica con el cliente.
- Evaluar integración de conciliación bancaria futura.
- Diseñar prototipo de interfaz para módulo de ventas.

---

**Documento preparado por:** Anghelo Alva
**Versión:** 1.0 – Base técnica inicial para backend (Next.js + Prisma + Better Auth)
