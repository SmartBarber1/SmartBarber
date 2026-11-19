# SmartBarber — Contexto general del proyecto

> **Última actualización:** 2026-11-17. Análisis de `Front/`, `SmartBarber/` y `pasarela_pagos/` contra el código y el historial de git.
> Documentos relacionados (en esta misma carpeta):
> - `REQUISITOS_SMARTBARBER.md`: matriz de requisitos (RF, RNF, RN) con el estado de cada uno. Proviene de `documento 2.xlsx`.
> - `docs/manual/`: manual de usuario (`MANUAL_USUARIO_SMARTBARBER.md` y su versión `.docx`) y manual del módulo de estadísticas (`MANUAL_ESTADISTICAS.md`), con capturas.

## 0. Estado de los repositorios (importante)

| Repositorio | Remoto | `origin/main` | Copia local |
|---|---|---|---|
| Backend `SmartBarber/` | `camilo-val/SmartBarber` | `cb6594f` · 12-nov · "Se activa la suscripcion automatica" | Rama `feature/jimmy` (`2b62256`): contiene todo `main` + días no laborables. **Tiene cambios sin commit**: bloqueo de barberos y estadísticas (ver sección 10). |
| Front `Front/SmartBarber/` (la app está en `SmartBarber-main/`) | `JhonCP953/SmartBarber` (los PR vienen de `SmartBarber1/SmartBarber`, que tiene el mismo `main`) | `51951db` · 12-nov · "Merge PR #14 fix/ws-subscription" | Rama `feature/jimmy` (`fd3df74`): contiene todo `main` + días no laborables. **Tiene cambios sin commit** (sección 10) y `environment.ts` apuntando a `localhost:8080`. |
| Pasarela `pasarela_pagos/` | `camilo-val/pasarela_pagos` | `2d206f0` · 12-nov · "logs para identificar uso de thread sleep" | Rama `main`, al día y sin cambios. |

- **Ramas activas que no chocan con `feature/jimmy`** (verificado el 16-nov):
  - Front: `origin/jhon` (14-nov), con los historiales de barbero y barbería y la creación de servicios. Toca `reservation-history-barber.*`, `reservation.service.ts` y `reservation.model.ts`: cualquier trabajo nuevo en esos archivos debe coordinarse con esa rama.
  - Back: `origin/despliegue` (historia sin base común con `main`) y `origin/feature/subscrition`.
- **Para ponerse al día** en cada repo, estando en la rama propia: `git fetch origin && git merge origin/main`. Usar merge y no rebase, porque las ramas ya están publicadas.
- **Base de datos:** el backend local usa el mismo PostgreSQL de Render que producción (`DB_URL`). Cualquier script SQL afecta a producción: deben ser aditivos e idempotentes. Los scripts viven en `SmartBarber/src/main/resources/db/`.

## 1. Qué es

Plataforma SaaS para barberías. Una barbería se registra, paga una **suscripción** (planes del catálogo) y con ella gestiona empleados (barberos), servicios, horarios, días no laborables, reservas y una **cola virtual** en tiempo real. Los clientes reservan servicios o se unen a la cola de un barbero, y luego dejan reseñas. El administrador consulta un **panel de estadísticas** (ingresos, ocupación, demanda, cola) y gestiona el acceso de su equipo.

## 2. Componentes y despliegue

| Carpeta | Qué es | Stack | Puerto / URL |
|---|---|---|---|
| `Front/SmartBarber/SmartBarber-main` | SPA web | Angular 18.2 (standalone, rutas *lazy*), Firebase Auth 12, RxJS | dev 4200 → API `https://smartbarber-lwn3.onrender.com` y WS `wss://smartbarber-lwn3.onrender.com` (`environment.apiUrl` y `wsUrl`) |
| `SmartBarber/` | Backend principal | Spring Boot 4.0.8, Java 21, WebFlux, Security WebFlux, R2DBC + PostgreSQL, Firebase Admin, MapStruct, Mail (Gmail SMTP), WebSocket, Jackson 3 (`tools.jackson`) | `${PORT:8080}`; desplegado en Render |
| `pasarela_pagos/payment-service` | Pasarela de pagos simulada: recibe pagos, los guarda y notifica el resultado | Spring Boot 4.1.1, WebFlux, MongoDB reactivo, Redis/Valkey reactivo | 8081 · `Dockerfile` |
| `pasarela_pagos/authorization-payment` | Autorizador simulado (hace las veces de "banco") | Spring Boot 4.1.1, WebFlux, Redis/Valkey, actuator | 8082 · `Dockerfile` |
| `firebase/` | Credencial *service account* de Firebase Admin. El backend ya no la usa (la recibe por variable de entorno), pero sigue siendo un secreto: no compartir ni versionar. | — | — |

Todos los backend usan arquitectura **Clean/Hexagonal**:
- `domain`: modelos, enums, excepciones y puertos.
- `application`: casos de uso, *commands* y *mappers*.
- `infrastructure`: *entrypoints* (RouterFunction/handlers, WebSocket, scheduler) y *driven adapters* (postgres, mongo, redis, firebase, email, websocket).

El enrutamiento se hace con `RouterFunction`, no con `@RestController`. Las constantes de rutas están en `HandlerConstant`.

**Despliegue.** Backend y pasarela tienen `Dockerfile` de dos etapas (Gradle construye con `bootJar`, JRE 21 ejecuta). No hay Docker Compose.

**Variables de entorno**

| Servicio | Variables |
|---|---|
| SmartBarber | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `PAYMENT_KEY` (UUID con el que SmartBarber se identifica ante la pasarela), `PAYMENT_SERVICE_URL` (por defecto `http://localhost:8081`), `FIREBASE_CREDENTIALS` (JSON completo de la *service account*), `PORT`. `payment.timeout = ${PAYMENT_TIMEOUT:30}` s. |
| payment-service | `MONGO_URI`, `REDIS_URI` |
| authorization-payment | `REDIS_URI`, `PAYMENT_SERVICE_URL` |

## 3. Roles, autenticación y seguridad

- **Roles** del backend (`RoleType`): `ADMIN` (id 1), `BARBER` (2) y `CUSTOMER` (3). En el front, `CUSTOMER` se mapea a `'CLIENT'` (`auth-session.mapper.ts`).
- **Flujo:** login con Firebase en el front → el interceptor agrega `Authorization: Bearer <idToken>` → `POST /auth/verify`.
- **`JwtFilter`** valida el token **en cada petición** con `AuthenticationUC.authorizationSession`, que rechaza a los usuarios que no están `ACTIVE` (error `AT_002`). Por eso un bloqueo aplica desde la siguiente petición del usuario. El principal autenticado lleva el `User`, el `Employee` (y su `barberiaId`) o el `Customer`; se lee con `CurrentAuthenticationPort`.
  - Rutas que no validan sesión: `/auth/**` y, solo para `POST`, `/barber-service/onboarding` y `/customer-service/onboarding` (`isSelfOnboarding`).
  - Los WebSocket (`/ws/virtual-queue`, `/ws/notifications`, `/ws/payment`) reciben el token en el parámetro `?token=`, porque el navegador no permite la cabecera `Authorization`. `/ws/notifications` solo admite CUSTOMER.
  - El filtro tiene logs de depuración por petición (`[REQUEST]`, `[JWT]`) que conviene retirar.
- **`/auth/verify`** devuelve `AuthorizationRsDto { role, userId, employeeId, customerId, barbershop{ id, name, location, phone, companyName, subscription{status} } }`.
- **Modelo:** `User` (firebaseId, roleId, status `ACTIVE`/`BLOCKED`/`PENDING`) se relaciona 1 a 1 con `Customer` o con `Employee`; cada `Employee` pertenece a una `Barbershop`.
- **Registro (*onboarding*):** `/public/customer-service/onboarding` para clientes y `/public/barber-service/onboarding` para la barbería junto con su administrador. En el front: `/auth/register` y `/auth/register-admin`.
- **`SecurityConfig`:**
  - Públicas: `POST` de los dos *onboarding* y `/auth/verify`.
  - Cola: `POST /api/v1/queue/join` exige CUSTOMER; `POST /api/v1/queue/*/open|close|next|complete` exigen BARBER; `GET /api/v1/queue/**` admite los tres roles.
  - Solo ADMIN: `POST`/`DELETE /non-working-day-service`, `GET /employee-service/team`, `PATCH /employee-service/block-employee/*` y `/unblock-employee/*`, `GET /statistics-service/**`.
  - `GET /user-service/**` solo admite BARBER.
  - **Todo lo demás exige sesión, pero no rol.** CORS `*` sin credenciales; CSRF desactivado.
- **Patrón para operaciones por barbería** (usado en días no laborables, equipo y estadísticas): la barbería se toma de la sesión con `BarbershopAdminResolver.currentAdmin(error)`, nunca de la URL ni del cuerpo. El resto de módulos todavía recibe IDs sin verificar la pertenencia (sin aislamiento *multi-tenant*).

## 4. Funcionalidades (módulos del backend)

| Módulo | Capacidades | Endpoints base |
|---|---|---|
| Barbería | Crear (valida nombre, documento y razón social únicos), *onboarding*, buscar (nombre, razón social, documento, id, todas) y actualizar | `/barber-service`, `/public/barber-service` |
| Empleado | Crear, *onboarding*, listar por barbería (público para clientes), buscar y actualizar (incluye `specialty`). **Equipo con estado de cuenta, bloquear y desbloquear** (solo ADMIN, sección 10) | `/employee-service`, `/public/employee-service` |
| Cliente | Crear (único por documento y UID), *onboarding*, buscar, actualizar y `PATCH /block-customer/{id}` (sin motivo ni desbloqueo) | `/customer-service`, `/public/customer-service` |
| Usuario / Rol | CRUD básico. `UserRqDto` solo recibe `roleId` | `/user-service`, `/role-service` |
| Servicios | CRUD y listado por barbería; precio, precio especial, oferta y duración | `/services-service` |
| Horarios | Por empleado (no por día de la semana): inicio y fin, almuerzo, vacaciones (sí/no) | `/schedule-service` |
| Días no laborables | Por barbería, con motivo. `GET /barbershop/{id}?from&to` (con sesión), `POST` y `DELETE` (ADMIN). Las reservas y la cola se rechazan esos días (`ND_006`) | `/non-working-day-service` |
| Reservas | Crear (valida choques del barbero y del cliente; la duración es la suma de los servicios; envía correo), consultar (id, empleado, cliente, barbería), confirmar (`PENDING → CONFIRMED`) y cancelar (con correo). Tipos `SERVICE_RESERVATION` y `VIRTUAL_QUEUE`. Estados `PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, WAITING, NO_SHOW`; iniciar, completar y no asistió existen en el dominio, pero solo se usan desde la cola | `/reservation-service` |
| Cola virtual | Abrir y cerrar (con bloqueo de fila), unirse, llamar al siguiente, completar el turno, ver el resumen y consultar el estado (sección 6) | REST `/api/v1/queue/...` + WS `/ws/virtual-queue`, `/ws/notifications` |
| Reseñas | Calificación (1 a 5) y comentario obligatorio por reserva; una reseña por reserva | `/reservation-review-service` |
| Notificaciones | Por reserva o cliente; guarda canal, evento, estado, reintentos y error (correo SMTP) | `/notification-service` |
| Estadísticas | Tablero del administrador (sección 10) | `/statistics-service/dashboard` |
| Suscripciones (catálogo) | Planes: nombre, descripción, precio y descuento | `/subscription-service` |
| Suscripción de barbería | Crear, renovar, consultar la actual y el historial; renovación automática y expiración **activas** (`@EnableScheduling`; `RenewAutomaticSubscription` cada 3 min y `SubscriptionExpirationScheduler`) | `/subscription-barbershop-service` + WS `/ws/payment?orderId=` |
| Transacciones | `SUBSCRIPTION_TRANSACTION` (implementada); `BOOKING_TRANSACTION` (el modelo existe, pero no hay flujo) | interno |

**Consultas de reservas.** `GET /reservation-service/customer|employee|barber/{id}` devuelven la reserva básica (sin nombre del cliente ni servicios) y responden 409 `RES_002` cuando no hay reservas. Solo `GET /reservation-service/{id}` devuelve `ReservationResponse` con el cliente y los servicios.

**Errores.** `GlobalHandlerError` responde `{ data: { reason, code, message, date } }`. Las de negocio dan 409; las de solicitud o validación, 400; las internas, 500; y las técnicas, 503. Los prefijos de código están en uso (`AT, BA, BP, BQ, CT, EY, ND, RES, RL, RW, SB, SC, SH, SR, ST, TS, US, AN`): **`ST_` es de los planes de suscripción** y `AN_` de estadísticas. El front traduce los códigos en `core/errors/error-messages.catalog.ts`.

## 5. Flujo de pago de suscripción (de extremo a extremo)

```
Front (ADMIN)                SmartBarber :8080                 payment-service :8081         Valkey/Redis            authorization-payment :8082
 POST /subscription-barbershop-service/create {barberId, subscriptionId, duration, automaticRenew, type=CREATE}
   ──────────────────────────► valida que no haya ACTIVE/PENDING
                               guarda SubscriptionBarbershop(PENDING)
                               guarda Transaction(PENDING, orderId=UUID nuevo, COP)
                               envía {amount,currency,description,orderId}
                               por WS cliente persistente ───────► /ws/payment?userId=PAYMENT_KEY
   ◄── 201 {..., orderId}                                          Payment.create (PENDING) → Mongo `payment`
 abre WS /ws/payment?orderId=…                                     RPUSH "payment.process.request" ──► lista
   (SmartBarber espera hasta                                                                         ◄── consume la lista
    payment.timeout vía ResponseManager)                                                                 estado aleatorio APPROVED/REJECTED
                                                                   ◄── PUT /webhook/{orderId} {status, description}
                                                                   actualiza Mongo y notifica por WS al userId
                               ◄────────────────────────────────── mensaje {status, orderId}
                               GatewayResponseHandler: actualiza Transaction y
                               SubscriptionBarbershop (ACTIVE → fija start/expiration = now + duration días;
                               si ya hay una ACTIVE, queda APPROVED para cuando expire)
 ◄── WS {type:"SUBSCRIPTION_PROCESS", data: SubscriptionBarbershop}
```

**Estados**
- `SubscriptionBarberStatus`: `ACTIVE, APPROVED, PENDING, DECLINED, NOT_SUBSCRIPTION, EXPIRED`. No existen `REFUNDED` ni `CANCELED`; `mapStatus` lleva `REJECTED/REFUNDED/CANCELED` de la transacción a `DECLINED`.
- `TransactionStatus`: `PENDING, APPROVED, REJECTED, CANCELED, REFUNDED`.
- `PaymentStatus` de la pasarela: `PENDING, APPROVED, REJECTED, CANCELED, FAILED`.

**Renovar:** `PUT /subscription-barbershop-service/renew` (type=RENEW) crea una nueva suscripción PENDING con su transacción. **Expirar** (scheduler): pasa la ACTIVE a EXPIRED y la APPROVED a ACTIVE.

**Conexión con la pasarela:** la URL sale de `PAYMENT_SERVICE_URL` y `ConnectionManager` reconecta con `Retry`. La pasarela también reconecta con Redis cuando Render suspende el servicio. Ya no hay `Thread.sleep` en el pago.

## 6. Cola virtual

| Acción | Endpoint | Lógica |
|---|---|---|
| Abrir | `POST /api/v1/queue/{employeeId}/open` (BARBER) | Crea la fila `cola_barbero` si no existe, la bloquea (`FOR UPDATE`) y pone `aceptando_clientes = true`. Rechaza si ya está abierta. Publica `QUEUE_OPENED` en `/ws/notifications`. |
| Cerrar | `POST /{employeeId}/close` (BARBER) | Pone `aceptando_clientes = false` y publica `QUEUE_CLOSED`. |
| Unirse | `POST /api/v1/queue/join` (CUSTOMER) | Valida cliente, barbero, barbería y servicios; que la cola esté abierta; que el barbero pertenezca a la barbería; que los servicios estén activos y sean de la barbería; que no sea un día no laborable; y, con `QueueAvailabilityService`, que el turno termine antes de la próxima reserva programada. Crea la reserva `VIRTUAL_QUEUE/WAITING` y publica `QUEUE_ADD_CUSTOMER`. **El `customerId` se toma del cuerpo, no de la sesión.** |
| Siguiente | `POST /{employeeId}/next` (BARBER) | Rechaza si ya hay un turno en atención; si no, pasa a `IN_PROGRESS` el primer `WAITING` por orden de llegada y registra `fecha_inicio_real`. |
| Completar | `POST /{employeeId}/complete` (BARBER) | Pasa a `COMPLETED` el turno en atención y publica `QUEUE_COMPLETED_CURRENT_TURN`. |
| Resumen | `GET /{employeeId}` | `QueueSnapshot { employeeId, acceptingClients, currentTurn, waitingTurns[{reservationId, customer, position, estimatedWaitMinutes, durationMinutes, status}] }`. **Incluye documento, celular y correo del cliente.** |
| Estado | `GET /{employeeId}/status` | Devuelve la fila de `cola_barbero`. |
| Tiempo real | WS `/ws/virtual-queue?employeeId=&token=` | Envía el resumen inicial (`QUEUE_SNAPSHOT`) y los eventos posteriores de ese barbero. |
| Avisos | WS `/ws/notifications?token=` (CUSTOMER) | Canal global que envía `QUEUE_OPENED/CLOSED` de todas las barberías a todas las conexiones. |

La espera estimada suma el tiempo restante del turno en curso y las duraciones de los turnos anteriores. Las sesiones WebSocket viven en memoria (no permite varias instancias).

**Datos de tiempo de las reservas** (los usan las estadísticas): en una reserva agendada, `fecha_inicio_real`/`fecha_fin_real` son el horario reservado; en un turno de cola, `fecha_ingreso_cola` es la llegada y `fecha_inicio_real` el inicio de la atención.

## 7. Frontend — estructura

**Rutas públicas** (`PublicLayout`): landing `/`; `/barberShop` (configuración, políticas de cancelación, canales de contacto y CRUD de servicios, con *guard* de rol); `/subscription` y sus páginas; `/reservar`, `/virtual-queue` y `/auth/login|register|register-admin`.

**`/panel`** (con *guard* de autenticación y de suscripción):
- Todos los roles: `home` y `profile`.
- ADMIN: `barbershop` (incluye días no laborables), `horarios`, `users` (equipo con bloqueo), `reservations-history`, `services`, `subscription` (estado, renovación, historial) y `statistics`.
- CLIENT: `reservas`, `reservation-history`, `virtual-queue-available` (unirse a una cola) y `virtual-queue-tracking`.
- BARBER: `virtual-queue`.
- Menú en `panel-navigation.service.ts`. Están como *Próximamente*: «Notificaciones» (cliente), «Mi agenda» y «Clientes» (barbero). «Historial Clientes y Barberos» (ADMIN) figura como disponible, pero apunta a `/panel/clients-barbers/history`, ruta que no existe.

**Organización.** Las *features* siguen `domain / application / infrastructure / pages|components`. `core/auth` tiene los *guards* (`auth`, `role`), el interceptor del token y los servicios de sesión (`SessionService`: `getBarbershopId()`, `getBarberId()`, `getClientId()`…). `core/errors` tiene `toApiError` y el catálogo de mensajes.

**Pruebas.** Hay archivos `.spec.ts`, pero **no hay runner configurado** (ni Karma ni Jest). La verificación se hace con `ng build`.

**Pantallas conectadas al backend:** registro y login, perfil (`/customer-service`, `/employee-service`), reservas, historiales (cliente, barbero, barbería), cola virtual (barbero y cliente, con WebSocket), suscripción (planes, compra, renovación, estado, historial, WebSocket de pago), servicios, horarios, días no laborables, equipo con bloqueo y estadísticas.

**Pantallas que esperan al backend:** cambiar plan y cancelar suscripción (responden «el backend no tiene la operación»), historial de pagos, políticas de cancelación y canales de contacto.

**Código sin uso:** `barber-shop-api.service.ts` conserva métodos que llaman a `/barber-service/festivos/...` (inexistente); la pantalla de festivos ya usa `NonWorkingDayRepository`.

## 8. Requisitos

La matriz completa está en `REQUISITOS_SMARTBARBER.md` (actualizada al 17-nov).

**Síntesis de los requerimientos del producto**

*Funcionales*
1. Registro e inicio de sesión con Firebase y roles ADMIN, BARBER y CUSTOMER, con control de estado del usuario.
2. *Onboarding* de la barbería (con su administrador) y de los clientes.
3. Gestión de barbería, empleados (con bloqueo), servicios (precio, oferta, duración), horarios y días no laborables.
4. Reservas de servicio con confirmación y cancelación y estados del ciclo de vida.
5. Cola virtual en tiempo real por barbero (abrir, cerrar, unirse, siguiente, completar), con prioridad para las reservas programadas.
6. Control de asistencia y penalizaciones por inasistencia (en el documento de grado; no implementado).
7. Reseñas de reservas y notificaciones a clientes por correo (FCM en el documento; no implementado).
8. Suscripción obligatoria de la barbería: catálogo de planes, compra, renovación manual o automática, expiración e historial; el estado se expone en la sesión.
9. Pago asíncrono a través de la pasarela, con confirmación en tiempo real (WebSocket) e idempotencia por `orderId`.
10. Panel de estadísticas para el administrador: ingresos operacionales, ocupación, demanda, inasistencias y cola.

*No funcionales*
- Programación reactiva de extremo a extremo y arquitectura hexagonal.
- Microservicios de pago desacoplados por WebSocket, cola Redis y webhook.
- Persistencia: PostgreSQL para el negocio, MongoDB para los pagos y Redis/Valkey para la cola de autorización.
- Despliegue con contenedores (Render).

## 9. Observaciones técnicas (deuda y riesgos)

**Seguridad y datos personales (prioridad alta)**
- **No hay aislamiento por barbería (*multi-tenant*)** fuera de días no laborables, equipo y estadísticas: los demás endpoints reciben IDs y no verifican la pertenencia (OWASP API1, BOLA). Cualquier usuario autenticado puede, por ejemplo, cancelar o confirmar cualquier reserva o calificar una reserva ajena.
- La mayoría de rutas exige sesión pero no rol (un cliente podría confirmar reservas).
- La cola expone documento, correo y celular de los clientes en espera; `/ws/notifications` difunde eventos de todas las barberías.
- Webhook `PUT /webhook/{orderId}` de payment-service sin autenticación; CORS `*`.
- Logs de depuración por petición en `JwtFilter` y en la pasarela.
- La credencial de Firebase Admin sigue en `firebase/`, dentro de OneDrive, aunque ya no la usa el código.

**Pagos y suscripción**
- `ResponseManager`: el `pending.remove` del caso de espera vencida sigue comentado (posible fuga de memoria).
- `authorization-payment` elige el estado al azar (es una simulación).
- `Transaction.createSubscriptionTransaction` asigna `amount = precio - descuento` y `subtotal = precio`, al revés que `createReservationTransaction`.
- No hay endpoints para cancelar suscripción, cambiar plan ni listar pagos.

**Reservas**
- Faltan en la API iniciar, finalizar, no asistió y reprogramar para reservas agendadas: **sin finalizar, esas reservas nunca quedan `COMPLETED` y no suman ingresos en las estadísticas**.
- La reserva programada no valida servicios activos ni el horario laboral, no guarda el precio del momento y permite cancelar reservas `IN_PROGRESS`.
- La validación de choques no tiene restricción en la base de datos (riesgo de concurrencia).
- El pago de reservas (`BOOKING_TRANSACTION`) no está implementado.

**Calidad**
- Pruebas del backend: las unitarias de días no laborables, `JwtFilter`, acceso del equipo, estadísticas y contrato JSON (34 en `feature/jimmy`). El resto del código no tiene pruebas.
- No hay OpenAPI/Swagger ni Docker Compose.
- Hay `System.out.println` de depuración y código comentado.

## 10. Trabajo en curso en `feature/jimmy` (sin commit al 17-nov)

**Bloqueo y desbloqueo de barberos (RF-16, RN-48)**
- Back:
  - `EmployeeAccessUC` reemplaza a `BlockEmployeeUC`.
  - Endpoints, solo ADMIN, con la barbería tomada de la sesión: `GET /employee-service/team` (equipo con `status`, `role`, `blockReason`, `blockedAt`), `PATCH /employee-service/block-employee/{id}` con `{ "reason" }` obligatorio (5 a 200 caracteres) y `PATCH /employee-service/unblock-employee/{id}`.
  - Reglas: no puede bloquearse a sí mismo (`EY_003`), solo se bloquean cuentas BARBER (`EY_004`), un barbero de otra barbería responde `CT_004` y el motivo inválido responde `EY_005`. Bloquear a alguien ya bloqueado no hace nada.
  - El cambio de estado y su registro en `bloqueo_usuario` se guardan en una transacción.
- Front:
  - `employee-list` muestra el estado y el motivo, y tiene el botón Bloquear/Desbloquear con confirmación y motivo en la misma fila (`GetTeamUseCase`, `ChangeEmployeeAccessUseCase`).
  - Se eliminó el código muerto de `user-management` (`block-user.use-case`, que llamaba a `/user-service` con estado `'Bloqueado'`).

**Estadísticas (RF-67, RF-68, RF-70)**
- Back:
  - `GET /statistics-service/dashboard?from&to` (ADMIN; sin fechas usa el mes en curso; máximo 366 días; error `AN_001`/`AN_002`).
  - Piezas: `StatisticsAdapter` (dos consultas SQL con `DatabaseClient`), `GetStatisticsDashboardUC` y `StatisticsCalculator` (lógica pura y probada).
  - Reglas de cálculo:
    - Solo los servicios `COMPLETED` (sin servicios `CANCEL`) generan ingreso.
    - La ocupación es minutos atendidos sobre la jornada menos el almuerzo y los días no laborables.
    - Las reservas efectivas se calculan sobre las agendadas cerradas.
    - Se agrupa por fecha y hora de Colombia y se compara con el periodo anterior de igual duración.
  - El ingreso usa el precio vigente del servicio (de oferta si aplica), porque la reserva no guarda el precio cobrado.
- Front: `StatisticsApiRepository` y `statistics-api.mapper.ts` reemplazan al mock. Los textos de los KPI salen de `statistics-kpis.ts`, compartido con el mock que se conserva para demostraciones.

**SQL pendiente de ejecutar en la base (antes de desplegar este backend)**
- `SmartBarber/src/main/resources/db/bloqueo_usuario.sql` (**obligatorio**): tabla `bloqueo_usuario` con el historial de bloqueos e índice `(user_id, fecha DESC)`. Sin ella fallan el listado del equipo y el bloqueo.
- `SmartBarber/src/main/resources/db/estadisticas_indices.sql` (opcional): índices para las consultas del tablero.
- Ya ejecutado antes: `dia_no_laborable.sql`.

**Para pasar a Render:** ejecutar el SQL, probar en local, restaurar `apiUrl` y `wsUrl` de Render en `environment.ts` (están en el comentario del archivo), hacer commit y push de `feature/jimmy` en ambos repos y abrir los PR.

## 11. Pendiente del front con el backend actual

| Función | Endpoint existente | Nota |
|---|---|---|
| Cancelar reserva (cliente y admin) | `PATCH /reservation-service/{id}/cancel` | Mostrar en `PENDING`/`CONFIRMED` futuras; manejar `RES_009`. |
| Confirmar reserva (barbero y admin) | `PATCH /reservation-service/{id}/confirm` | Solo `PENDING`; manejar `RES_012`. |
| Calificar reserva (cliente) | `POST/PUT /reservation-review-service/...`, `GET .../reserva/{id}` | `RW_004` significa «sin reseña». Comentario obligatorio. |
| Mi agenda (barbero) | `GET /reservation-service/employee/{id}` | Conviene que el back devuelva el cliente y los servicios, o filtrar por fecha, para no hacer una llamada por cita. |
| Notificaciones (cliente) | `GET /notification-service/cliente/{id}` | El menú está como *Próximamente*. |
| Clientes (barbero y admin) | `GET /customer-service/name|document|id` | El menú está como *Próximamente*. |
| Editar barbero (admin) | `PUT /employee-service/actualizar-empleado/{id}` | — |
| Recuperar y cambiar contraseña | Solo Firebase | No depende del back. |

Las acciones de reservas tocan los mismos archivos que `origin/jhon`: coordinar antes o ubicarlas en un caso de uso y un componente propios.
