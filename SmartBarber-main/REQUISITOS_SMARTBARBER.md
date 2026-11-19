# SmartBarber — Especificación de Requisitos y Estado de Implementación

| Campo | Valor |
|---|---|
| Proyecto | SmartBarber — Plataforma SaaS de gestión para barberías |
| Documento | Especificación de requisitos funcionales, no funcionales y reglas de negocio con su estado actual |
| Fuente de requisitos | `documento 2.xlsx` (hojas RF, RNF y RN) |
| Fuente del estado | Revisión del código: `Front/SmartBarber/SmartBarber-main`, `SmartBarber/` y `pasarela_pagos/` (ver `CONTEXTO_PROYECTO_SMARTBARBER.md`) |
| Fecha de corte | 17-11-2026 |
| Versión | 1.2 (actualiza los estados con los cambios de noviembre; ver `CONTEXTO_PROYECTO_SMARTBARBER.md`) |

---

## 1. Introducción

### 1.1 Propósito
Este documento recoge los requisitos de SmartBarber tal como están en la matriz del equipo (`documento 2.xlsx`) y, para cada uno, indica **qué tanto está implementado hoy**, con la evidencia encontrada en el código. Sirve como línea base para planear los siguientes sprints y para presentar el avance del proyecto.

### 1.2 Alcance del sistema
SmartBarber permite que una barbería se registre, pague una suscripción y, mientras esté vigente, gestione sus barberos, servicios, horarios, reservas y una cola virtual en tiempo real. Los clientes pueden reservar servicios o unirse a la cola de un barbero. Más adelante se incorporarán analítica e inteligencia artificial (predicción de cancelaciones, duración y demanda).

### 1.3 Componentes evaluados

| Componente | Tecnología |
|---|---|
| Frontend web | Angular 18, Firebase Authentication |
| Backend principal | Spring Boot 4 (WebFlux reactivo), PostgreSQL (R2DBC), WebSocket, correo SMTP |
| Pasarela de pagos (simulada) | `payment-service` (MongoDB + Redis/Valkey) y `authorization-payment` (autorizador simulado) |

### 1.4 Actores

| Actor | Rol en el sistema | Descripción |
|---|---|---|
| Administrador | `ADMIN` | Dueño o administrador principal de la barbería. Gestiona la suscripción, la configuración, los servicios, los barberos y los usuarios. |
| Barbero | `BARBER` | Empleado de la barbería. Atiende reservas y maneja su cola virtual. |
| Cliente | `CUSTOMER` (en el front se muestra como `CLIENT`) | Persona que reserva servicios o se une a la cola. |
| Pasarela de pagos | Sistema externo | Autoriza los cobros de las suscripciones. |
| Servicio de IA | Sistema externo (futuro) | Genera predicciones informativas. |

### 1.5 Convenciones de estado

| Estado | Significado |
|---|---|
| ✅ **Implementado** | La funcionalidad existe de punta a punta (backend y, si aplica, frontend) y cumple la descripción. |
| 🟡 **Parcial** | Existe una parte (solo backend, solo frontend, sin validaciones exigidas o con limitaciones). |
| ⛔ **Pendiente** | No hay implementación, o solo hay una maqueta con datos simulados. |
| 🔍 **No verificable** | Requiere medición, despliegue o pruebas fuera del código para confirmarse. |
| ⚪ **Fuera de alcance** | Se mantiene registrado, pero no forma parte de la versión actual del proyecto. |

Prioridades: **Alta**, **Media** y **Baja**, según el Excel.

### 1.6 Trazabilidad e identificadores
Los identificadores se conservan iguales a los de la matriz original para no perder la trazabilidad. Los números que no aparecen (RF-40, RNF-03, RNF-15, RNF-27, RN-27, RN-28, RN-32 y RN-39) corresponden a requisitos **retirados** de la matriz y no se reutilizan. Los requisitos nuevos se numeran a continuación del último ID de cada tipo (RF-77 en adelante, RNF-41 y RN-41 en adelante).

---

## 2. Resumen ejecutivo del estado

| Tipo | Total | ✅ Implementado | 🟡 Parcial | ⛔ Pendiente | 🔍 No verificable | ⚪ Fuera de alcance |
|---|---|---|---|---|---|---|
| Requisitos funcionales (RF) | 89 | 32 | 34 | 20 | 0 | 3 |
| Requisitos no funcionales (RNF) | 38 | 14 | 14 | 4 | 4 | 2 |
| Reglas de negocio (RN) | 47 | 16 | 8 | 19 | 0 | 4 |

**Lectura general**
- **Más avanzado:** suscripciones con pago asíncrono y renovación automática, autenticación con Firebase y bloqueo de usuarios inactivos, gestión de barbería, barberos (con bloqueo y motivo), clientes, servicios y días no laborables, creación de reservas con validación de choques, cola virtual en tiempo real de punta a punta y tablero de estadísticas con datos reales.
- **Avance intermedio:** ciclo de vida de las reservas (los estados existen en el dominio, pero solo se exponen *confirmar* y *cancelar*, y el front aún no los usa), notificaciones (solo correo al cliente), reseñas (backend sin vista) y configuración de la barbería (políticas y canales sin backend).
- **Sin iniciar:** penalizaciones por inasistencia, recuperación y cambio de contraseña, notificaciones push (FCM), cancelación de suscripción, cambio de plan e historial de pagos, auditoría general, Docker Compose y OpenAPI.
- **Fuera del alcance del PMV:** las funciones predictivas con IA y el inventario, en coherencia con la sección 1.4 del documento de grado.
- **Riesgos de seguridad:** todas las rutas exigen sesión, pero la mayoría no valida el rol ni que el recurso pertenezca a la barbería del usuario (RN-34, RNF-04, RNF-07). Las excepciones son días no laborables, equipo y estadísticas.
- **Pendiente de publicar:** bloqueo de barberos (RF-16, RN-48) y estadísticas (RF-67, RF-68, RF-70) están en la rama `feature/jimmy`, sin commit, y requieren ejecutar `bloqueo_usuario.sql`.

---

## 3. Requisitos funcionales

### 3.1 Suscripciones y pagos

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-01 | Registrar barbería | Registrar una nueva barbería seleccionando un plan de suscripción. | Alta | 🟡 Parcial | Existe el onboarding de la barbería (`/public/barber-service/onboarding`) y la compra del plan (`/subscription-barbershop-service/create`), pero son dos pasos separados, no un solo flujo. |
| RF-02 | Activar suscripción | Activar automáticamente la barbería cuando el pago es aprobado. | Alta | ✅ Implementado | `GatewayResponseHandler` actualiza la transacción y deja la suscripción en `ACTIVE`, con fechas de inicio y vencimiento. El front recibe el resultado por `/ws/payment`. La pasarela es simulada. |
| RF-03 | Renovar suscripción | Renovar el plan antes o después del vencimiento. | Alta | ✅ Implementado | Renovación manual (`PUT /renew`): si ya hay un plan activo, el nuevo queda `APPROVED`. El paso de `APPROVED` a `ACTIVE` lo hace el scheduler de expiración, activo desde el 12-nov (`@EnableScheduling`). |
| RF-04 | Cambiar plan | Cambiar entre los planes disponibles. | Alta | 🟡 Parcial | El front tiene la página `change-plan`. El backend no tiene un endpoint dedicado ni recalcula vigencia o beneficios; solo puede usarse la renovación con otro `subscriptionId`. |
| RF-05 | Cancelar suscripción | Cancelar la suscripción conservando el historial. | Alta | ⛔ Pendiente | La página `cancel-subscription` usa datos simulados. No hay caso de uso ni endpoint, y el estado `CANCELED` ya no existe en `SubscriptionBarberStatus` (solo `ACTIVE`, `APPROVED`, `PENDING`, `DECLINED`, `NOT_SUBSCRIPTION`, `EXPIRED`). |
| RF-06 | Consultar historial de pagos | Mostrar los pagos realizados por la barbería. | Media | ⛔ Pendiente | La página `payment-history` usa datos simulados. No hay endpoint que liste transacciones ni paginación. |
| RF-07 | Consultar estado de la suscripción | Mostrar plan actual, vencimiento y beneficios. | Alta | ✅ Implementado | `GET /subscription-barbershop-service/actual-subscription/{barberId}` y el estado incluido en `/auth/verify`. Páginas `subscription-status` y `subscription-dashboard`. |
| RF-77 | Administrar catálogo de planes | Crear y consultar los planes de suscripción (nombre, descripción, precio y descuento). | Alta | ✅ Implementado | `/subscription-service` (`create-subscription`, `all`, `id/{id}`). |
| RF-80 | Renovación automática | Permitir que el administrador active la renovación automática de su plan, de modo que el sistema genere el cobro antes del vencimiento. | Media | ✅ Implementado | `automaticRenew` y `RenewAutomaticSubscription` con `@Scheduled` activo (cada 3 minutos). |

### 3.2 Autenticación y usuarios

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-08 | Registro de administrador | Registrar al administrador principal durante la suscripción. | Alta | ✅ Implementado | El onboarding crea la barbería y su empleado administrador; la cuenta se crea en Firebase. Ruta `/auth/register-admin`. |
| RF-09 | Registro de barbero | Registrar barberos asociados a la barbería. | Alta | ✅ Implementado | `/public/employee-service/crear-empleado` y `/onboarding`, con validación de documento y usuario duplicados. Componente `employee-register`. |
| RF-10 | Registro de cliente | Registro manual por el administrador o autorregistro. | Alta | 🟡 Parcial | El autorregistro funciona (`/public/customer-service/onboarding`). La unicidad se valida por **documento** y UID de Firebase, no por correo ni teléfono como exige el requisito. No se encontró el registro manual desde el administrador. |
| RF-11 | Inicio de sesión | Autenticar a los usuarios con Firebase Authentication y obtener del backend su rol y contexto (barbería, empleado o cliente). | Alta | ✅ Implementado | Login con Firebase, luego `POST /auth/verify`, que valida el ID token y devuelve rol y contexto. Guards por rol en el front. |
| RF-12 | Recuperación de contraseña | Restablecer la contraseña por correo. | Alta | ⛔ Pendiente | El front no usa `sendPasswordResetEmail` y no hay vista de recuperación. |
| RF-13 | Cambio de contraseña | Cambiar la contraseña desde el perfil. | Media | ⛔ Pendiente | No hay reautenticación ni actualización de contraseña. |
| RF-14 | Actualizar perfil | Modificar la información personal. | Alta | ✅ Implementado | El front usa `/customer-service/update-customer/{id}` para clientes y los endpoints de empleado para barberos y administradores. |
| RF-15 | Consultar perfil | Ver la información del usuario autenticado. | Alta | ✅ Implementado | `/customer-service/id/{id}` para clientes y `/employee-service/id/{id}` para empleados. |
| RF-16 | Bloquear usuario | Bloquear temporalmente a un usuario indicando el motivo. | Alta | ✅ Implementado (barberos) | El administrador bloquea y desbloquea a los barberos de su barbería desde «Barberos y usuarios» (`PATCH /employee-service/block-employee/{id}` y `/unblock-employee/{id}`, rol ADMIN). El motivo es obligatorio y queda en `bloqueo_usuario`. No puede bloquearse a sí mismo ni a otro administrador. El bloqueo de clientes sigue en RF-47. |
| RF-17 | Cerrar sesión | Terminar la sesión en el cliente, eliminar los datos de sesión locales y revocar los tokens de actualización del usuario en Firebase. | Alta | 🟡 Parcial | El front tiene `signOut` y `logout.service`. Falta revocar los tokens (`revokeRefreshTokens` de Firebase Admin); hasta entonces el ID token sigue siendo válido hasta que expira (1 h). |
| RF-90 | Administrar roles | Permitir crear, consultar y actualizar los roles del sistema (administrador, barbero y cliente). | Baja | ✅ Implementado | `/role-service` (`create-role`, `id/{id}`, `update-role/{id}`). Es una función de configuración de la plataforma, sin vista en el front. |

### 3.3 Barbería y configuración

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-18 | Consultar información de la barbería | Mostrar la información general. | Alta | ✅ Implementado | `GET /barber-service/id/{id}` y búsquedas por nombre, razón social y documento. |
| RF-88 | Consultar barberías disponibles | Mostrar al cliente el listado de barberías registradas para elegir dónde reservar. | Alta | ✅ Implementado | `GET /barber-service/find-all`; el flujo de reserva del front lo usa para seleccionar la barbería. |
| RF-19 | Actualizar información de la barbería | Modificar nombre, dirección, teléfono, logo y descripción. | Alta | 🟡 Parcial | `PUT /barber-service/update-barber/{id}` cubre los datos básicos. **No hay carga de logo ni de imágenes.** |
| RF-20 | Configurar horarios de atención | Definir apertura y cierre por día. | Alta | 🟡 Parcial | El horario existe **por empleado** (inicio, fin y almuerzo), pero no por día de la semana ni a nivel de barbería. |
| RF-21 | Configurar días no laborables | Registrar festivos, vacaciones y cierres. | Media | ✅ Implementado | Módulo `/non-working-day-service` por barbería (consultar con sesión; crear y eliminar solo ADMIN), con motivo y sin duplicados. Las reservas y la cola se rechazan esos días (`ND_006`). Front: «Mi barbería > Días no laborables». Rama `feature/jimmy`. Las vacaciones por barbero siguen siendo el campo `vacation` del horario. |
| RF-22 | Configurar políticas de reserva | Tiempo mínimo de cancelación, anticipación y duración máxima. | Alta | ⛔ Pendiente | La vista `cancellation-policies` captura horas mínimas de cancelación, si se permite reprogramar, el límite de horas para reprogramar y un porcentaje de penalización, pero no guarda nada: no hay modelo ni endpoint. |
| RF-23 | Configurar métodos de contacto | Redes sociales, correo y canales. | Baja | ⛔ Pendiente | La vista `contact-channels` existe sin conexión al backend. |
| RF-24 | Consultar configuración | Consultar toda la configuración vigente. | Alta | ⛔ Pendiente | No hay una entidad ni consulta de configuración unificada. |
| RF-25 | Actualizar configuración | Modificar la configuración general. | Alta | 🟡 Parcial | Solo se pueden actualizar los datos básicos de la barbería (RF-19). |

### 3.4 Servicios

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-26 | Registrar servicio | Crear servicios. | Alta | ✅ Implementado | `POST /services-service/crear-servicio`; vista `CRUD-Servicios`. |
| RF-27 | Modificar servicio | Actualizar un servicio. | Alta | ✅ Implementado | `PUT /services-service/actualizar-service/{id}`. |
| RF-28 | Eliminar servicio | Desactivar sin perder historial. | Alta | 🟡 Parcial | Solo se logra poniendo `status=false` al actualizar. No hay una operación de eliminación lógica. |
| RF-29 | Consultar servicios | Mostrar el catálogo. | Alta | 🟡 Parcial | `GET /services-service/barberia/{id}`, **sin paginación**. |
| RF-30 | Administrar categorías | CRUD de categorías de servicios. | Media | ⛔ Pendiente | No existe el modelo de categoría. |
| RF-31 | Asignar duración | Duración estimada por servicio. | Alta | ✅ Implementado | Campo `duration`, que se usa para calcular la duración de la reserva. |
| RF-32 | Asignar precio | Precio vigente del servicio. | Alta | ✅ Implementado | Campos `price`, `special_price` y `offert`. |
| RF-33 | Activar/inactivar servicio | Habilitar o deshabilitar temporalmente. | Alta | ✅ Implementado | Campo `status` editable. |

### 3.5 Barberos

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-34 | Consultar barberos | Listar los barberos registrados. | Alta | 🟡 Parcial | `GET /public/employee-service/barbershop/{id}`, **sin paginación**. |
| RF-35 | Actualizar barbero | Modificar su información. | Alta | ✅ Implementado | `PUT /employee-service/actualizar-empleado/{id}`. |
| RF-36 | Asignar especialidades | Especialidades del barbero (relación muchos a muchos). | Alta | 🟡 Parcial | `specialty` es un solo texto; no hay relación muchos a muchos. |
| RF-37 | Configurar horario laboral | Disponibilidad del barbero. | Alta | ✅ Implementado | `/schedule-service` por empleado (inicio, fin, almuerzo y vacaciones). |
| RF-38 | Cambiar estado del barbero | Activar o suspender temporalmente. | Alta | ⛔ Pendiente | El empleado no tiene un campo de estado propio. |
| RF-39 | Consultar agenda del barbero | Mostrar al barbero sus reservas asignadas. | Alta | 🟡 Parcial | `GET /reservation-service/employee/{id}` devuelve las reservas, pero no hay vista de calendario. |
| RF-41 | Eliminar barbero | Desactivar manteniendo el historial. | Media | ⛔ Pendiente | No hay eliminación lógica. |

### 3.6 Clientes

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-42 | Consultar cliente | Mostrar el perfil del cliente. | Alta | 🟡 Parcial | Búsqueda por id, nombre y documento, **sin paginación**. |
| RF-43 | Actualizar cliente | Modificar su información. | Alta | ✅ Implementado | `PUT /customer-service/update-customer/{id}`. |
| RF-44 | Consultar historial | Historial de reservas del cliente. | Alta | 🟡 Parcial | `GET /reservation-service/customer/{id}`, sin filtros por fecha ni estado. |
| RF-45 | Consultar próximas reservas | Reservas futuras del cliente. | Alta | 🟡 Parcial | Mismo endpoint; no hay filtro por estado ni por fecha futura. |
| RF-46 | Eliminar cliente | Desactivar manteniendo el historial. | Baja | ⛔ Pendiente | No implementado. |
| RF-47 | Bloquear cliente | Restringir temporalmente el acceso. | Media | 🟡 Parcial | Igual que RF-16: el front lo permite, pero el backend no recibe el estado y no lo aplica al iniciar sesión. |

### 3.7 Reservas y agenda

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-48 | Reserva con barbero específico | Reservar con el barbero elegido. | Alta | ✅ Implementado | `POST /reservation-service/create` valida que el barbero y el cliente no tengan otra reserva en ese rango. Componente `appointment`. |
| RF-49 | Reserva automática | Asignar automáticamente un barbero disponible. | Alta | ⛔ Pendiente | No existe un algoritmo de asignación. |
| RF-50 | Reserva por administrador | Registrar reservas desde recepción. | Alta | 🟡 Parcial | El endpoint acepta cualquier `customerId`, pero no hay un flujo de recepción ni la opción de crear al cliente en el mismo paso. |
| RF-51 | Reprogramar reserva | Cambiar fecha y hora. | Alta | ⛔ Pendiente | `Reservation.actualizar()` existe en el dominio, pero no está expuesto en ningún endpoint. |
| RF-52 | Cancelar reserva (cliente) | Cancelar antes del límite establecido. | Alta | 🟡 Parcial | `PATCH /{id}/cancel` funciona y envía un correo, pero **no valida ningún límite de tiempo**. |
| RF-53 | Cancelar reserva (administrador) | Cancelar indicando el motivo. | Alta | 🟡 Parcial | Usa el mismo endpoint; **no guarda el motivo**. |
| RF-54 | Confirmar asistencia | Registrar la llegada del cliente. | Alta | 🟡 Parcial | `PATCH /{id}/confirm` confirma la reserva (PENDING → CONFIRMED), pero no registra la llegada. |
| RF-55 | Iniciar servicio | Marcar el inicio de la atención. | Alta | 🟡 Parcial | `marcarEnProgreso()` existe en el dominio; solo se usa en la cola (`/queue/{id}/next`). |
| RF-56 | Finalizar servicio | Registrar la finalización. | Alta | 🟡 Parcial | `completar()` existe; solo se expone para la cola (`/queue/{id}/complete`). |
| RF-57 | Consultar agenda de la barbería | Mostrar al administrador la agenda de todos los barberos en vista diaria, semanal y mensual. | Alta | 🟡 Parcial | Hay consultas por barbero y por barbería, pero no un calendario interactivo. |
| RF-58 | Historial de reservas | Consultar con filtros y paginación. | Alta | 🟡 Parcial | Consultas sin filtros ni paginación. |
| RF-59 | Gestionar estados de la reserva | Administrar el ciclo de vida de la reserva según la máquina de estados de RN-14: Pendiente, En espera (cola), Confirmada, En proceso, Finalizada, Cancelada y No asistió. | Alta | 🟡 Parcial | El dominio tiene todos los estados y transiciones (`PENDING, WAITING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW`). La API solo expone confirmar y cancelar. |
| RF-81 | Reserva de varios servicios | Permitir incluir varios servicios en una misma reserva; la duración total es la suma de las duraciones. | Media | ✅ Implementado | `ReservationCommand.reservationServiceId` es una lista; se crea un `ServiceReservation` por servicio. |

### 3.7.1 Asistencia y penalizaciones

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-82 | Registrar inasistencia | Marcar como "No asistió" una reserva confirmada cuando el cliente no se presenta dentro del tiempo de tolerancia configurado por la barbería. | Alta | 🟡 Parcial | `Reservation.marcarNoShow()` existe en el dominio; no hay endpoint ni tiempo de tolerancia. |
| RF-83 | Configurar política de penalización | Permitir al administrador definir el número máximo de inasistencias, el periodo de conteo y la duración de la restricción. | Alta | ⛔ Pendiente | No existe el modelo de política. |
| RF-84 | Aplicar penalización automática | Restringir automáticamente al cliente cuando alcance el umbral de inasistencias configurado. | Alta | ⛔ Pendiente | No implementado. |
| RF-85 | Consultar inasistencias y penalizaciones | Mostrar al administrador y al cliente las inasistencias registradas y las restricciones vigentes. | Media | ⛔ Pendiente | No implementado. |

### 3.8 Cola virtual

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-60 | Unirse a la cola virtual | Entrar en la cola de espera. | Alta | 🟡 Parcial | Back: `POST /api/v1/queue/join` (CUSTOMER) valida la cola abierta, el barbero, los servicios activos, los días no laborables y la reserva siguiente (RN-18). Front: vista «Cola virtual» del cliente (`virtual-queue-available`). Falta tomar el `customerId` de la sesión y no del cuerpo. |
| RF-61 | Consultar posición | Posición y tiempo estimado de espera. | Alta | ✅ Implementado | `QueueSnapshot` con `position` y `estimatedWaitMinutes` por `/ws/virtual-queue` (token en `?token=`); el front lo muestra en `virtual-queue-tracking`. |
| RF-62 | Asignación automática | Asignar al siguiente cliente cuando el barbero quede libre. | Alta | 🟡 Parcial | La asignación la dispara el barbero de forma manual (`/next`), que además impide tomar un nuevo turno si ya hay uno en atención; no ocurre sola. |
| RF-63 | Cancelar turno | Salir de la cola. | Alta | ⛔ Pendiente | No hay endpoint para salir de la cola. |
| RF-64 | Gestionar la cola | Reordenar automáticamente a los clientes en espera. | Alta | ✅ Implementado | Atención por orden de llegada; los eventos `QUEUE_ADD_CUSTOMER`, `QUEUE_NEXT_CUSTOMER` y `QUEUE_COMPLETED_CURRENT_TURN` llegan al front por WebSocket. |
| RF-78 | Abrir y cerrar la cola | Permitir al barbero abrir y cerrar su cola virtual; con la cola cerrada no se aceptan nuevos clientes. | Alta | ✅ Implementado | `POST /api/v1/queue/{employeeId}/open` y `/close` (rol BARBER), con bloqueo de fila; vista del barbero en el front. |
| RF-86 | Consultar estado de la cola | Permitir consultar si la cola de un barbero está abierta y aceptando clientes. | Media | ✅ Implementado | `GET /api/v1/queue/{employeeId}/status`; el front lo consume. |
| RF-87 | Notificar apertura y cierre de colas | Informar en tiempo real a los clientes conectados cuando un barbero abre o cierra su cola. | Media | 🟡 Parcial | El back publica `QUEUE_OPENED` y `QUEUE_CLOSED` por `/ws/notifications` (solo CUSTOMER) y el front consume el canal, pero los eventos van a todas las sesiones sin filtrar por barbería. |

### 3.9 Reseñas

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-79 | Calificar reserva | Permitir al cliente calificar y comentar una reserva atendida, y consultar y editar su reseña. | Media | 🟡 Parcial | El backend está completo (`/reservation-review-service`); no se encontró la vista en el front. |

### 3.10 Analítica e inteligencia artificial

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-65 | Predicción de cancelación | Probabilidad de cancelación con IA. | Alta | ⚪ Fuera de alcance | Trabajo futuro: requiere datos históricos suficientes (alcance del PMV). |
| RF-66 | Estimación de duración | Duración estimada con datos históricos. | Alta | ⚪ Fuera de alcance | Trabajo futuro. En el PMV la duración es la suma de las duraciones de los servicios (RN-11). |
| RF-67 | Dashboard de ingresos | Ingresos, reservas y ocupación. | Alta | ✅ Implementado | `GET /statistics-service/dashboard?from&to` (ADMIN). Ingresos por día, mes, servicio y barbero, solo de servicios finalizados; ocupación = minutos atendidos / jornada (sin días no laborables). Compara con el periodo anterior. El precio es el vigente del servicio, porque la reserva no guarda el precio cobrado. |
| RF-68 | Dashboard de cola virtual | Métricas de la cola. | Media | ✅ Implementado | Turnos atendidos, espera promedio y por hora de ingreso, espacios liberados (cancelaciones e inasistencias) y espacios recuperados con turnos de cola. |
| RF-69 | Predicción de demanda | Demanda por franja horaria. | Media | ⚪ Fuera de alcance | Trabajo futuro. |
| RF-70 | Indicadores de desempeño | Servicios más pedidos y comportamiento de los clientes. | Alta | ✅ Implementado | Servicios más pedidos, rendimiento por barbero (clientes, servicios, ingresos, calificación, duración), mapa de demanda por día y hora y reservas efectivas, canceladas e inasistencias. |

### 3.11 Notificaciones

| ID | Requisito | Descripción | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RF-71 | Notificar creación de reserva | Avisar al cliente y al barbero. | Alta | 🟡 Parcial | Se envía un **correo solo al cliente** y la notificación queda registrada (`RESERVATION_CREATED`). No se avisa al barbero ni se usa FCM. |
| RF-72 | Notificar modificaciones | Cambios de fecha, hora o estado. | Alta | 🟡 Parcial | Correo al confirmar o cancelar; no hay aviso por reprogramación (la función no existe). |
| RF-73 | Enviar recordatorios | Recordar antes de la cita. | Baja | ⛔ Pendiente | El campo `scheduledDate` existe, pero no hay tarea programada. |
| RF-74 | Notificar vencimiento de suscripción | Avisar al administrador de que se acerca el vencimiento. | Alta | ⛔ Pendiente | No implementado. |
| RF-75 | Preferencias de notificación | El usuario elige qué avisos recibir. | Media | ⛔ Pendiente | No implementado. |
| RF-76 | Notificar cancelación | Avisar al cliente o al barbero. | Alta | 🟡 Parcial | Correo solo al cliente. |
| RF-89 | Consultar historial de notificaciones | Permitir consultar las notificaciones enviadas a un cliente o asociadas a una reserva, con su estado y número de reintentos. | Baja | 🟡 Parcial | `GET /notification-service/cliente/{customerId}` y `/reserva/{reservationId}`; cada notificación guarda canal, estado, reintentos y error. No hay vista en el front. |

---

## 4. Requisitos no funcionales

| ID | Categoría | Requisito | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RNF-01 | Arquitectura | Clean Architecture y DDD | Alta | ✅ Implementado | Capas `domain / application / infrastructure` con puertos y adaptadores en los tres backend y en las features del front. |
| RNF-02 | Arquitectura | API REST con JSON | Alta | ✅ Implementado | `RouterFunction` con JSON, más WebSocket para el tiempo real. |
| RNF-04 | Arquitectura | Multi-tenant | Alta | 🟡 Parcial | Los datos se relacionan por `barberiaId`, pero los endpoints **no verifican que el recurso pertenezca al tenant** del usuario. |
| RNF-05 | Arquitectura | Docker / Docker Compose | Alta | 🟡 Parcial | Hay `Dockerfile` del backend y de los dos servicios de la pasarela. Falta Docker Compose (y el front). |
| RNF-06 | Seguridad | Firebase Authentication | Alta | ✅ Implementado | Front con Firebase SDK; backend con Firebase Admin. |
| RNF-07 | Seguridad | Autorización por roles | Alta | 🟡 Parcial | El front tiene guards por rol. El back exige sesión en todo y restringe por rol la cola, `/user-service`, días no laborables, equipo y estadísticas; el resto no valida el rol. |
| RNF-08 | Seguridad | Gestión de sesiones con token de Firebase: cada petición protegida debe enviar el ID token de Firebase (`Authorization: Bearer`), que el backend valida antes de resolver rol y contexto | Alta | ✅ Implementado | `JwtFilter` valida el token con Firebase Admin y asigna `ROLE_ADMIN`, `ROLE_BARBER` o `ROLE_CUSTOMER`. La dependencia `java-jwt` no se usa y puede retirarse. |
| RNF-09 | Seguridad | HTTPS/TLS | Alta | 🔍 No verificable | Prioridad elevada de Baja a Alta: la plataforma transmite datos personales (Ley 1581 de 2012, principio de seguridad). Depende del despliegue; hoy se usan `http://` y `ws://localhost:8081` fijos en el código. |
| RNF-10 | Seguridad | No almacenar contraseñas | Alta | ✅ Implementado | Las credenciales las gestiona Firebase. |
| RNF-11 | Seguridad | Validación en cliente y servidor | Alta | 🟡 Parcial | Bean Validation en los DTO y formularios en Angular; no todas las entradas se validan (por ejemplo, el servicio activo al reservar). |
| RNF-12 | Seguridad | Protección contra SQLi, XSS, CSRF y acceso indebido a objetos (OWASP API Top 10) | Alta | 🟡 Parcial | R2DBC usa consultas parametrizadas y Angular escapa el HTML. Riesgos: CORS `*`, webhook de la pasarela sin autenticación y endpoints que no verifican la pertenencia del recurso (BOLA). |
| RNF-13 | Rendimiento | Consultas < 500 ms | Alta | 🔍 No verificable | No hay mediciones. Ya no hay `Thread.sleep` en el pago. Las estadísticas leen con dos consultas por petición y tienen índices opcionales (`estadisticas_indices.sql`). |
| RNF-14 | Rendimiento | Concurrencia sin inconsistencias | Alta | 🟡 Parcial | Se valida el solapamiento dentro de una transacción, pero sin bloqueo ni restricción en la base, lo que permite condiciones de carrera. La cola sí usa `findByEmployeeIdForUpdate`. |
| RNF-16 | Rendimiento | Escalabilidad | Baja | 🟡 Parcial | El stack reactivo ayuda, pero las sesiones WebSocket guardadas en memoria impiden escalar horizontalmente. |
| RNF-17 | Disponibilidad | 99.5 % mensual | Alta | 🔍 No verificable | Depende de la infraestructura de despliegue. |
| RNF-18 | Disponibilidad | Recuperación ante fallos | Alta | 🟡 Parcial | El cliente WebSocket hacia la pasarela reconecta con `Retry` y la pasarela reconecta con Redis. Queda el `pending.remove` comentado en `ResponseManager` (espera vencida). |
| RNF-19 | Disponibilidad | Copias de seguridad | Alta | 🔍 No verificable | No hay evidencia en el repositorio. |
| RNF-20 | Persistencia | PostgreSQL como base del negocio | Alta | ✅ Implementado | SmartBarber usa PostgreSQL. La pasarela usa MongoDB, pero como sistema externo. |
| RNF-21 | Persistencia | Integridad transaccional | Alta | ✅ Implementado | `TransactionalOperator` en la creación de suscripciones, reservas y la cola. |
| RNF-22 | Persistencia | Eliminación lógica | Alta | 🟡 Parcial | Hay campos de estado (servicio, usuario), pero no una estrategia uniforme. |
| RNF-23 | Comunicación | Notificaciones push (FCM) | Alta | ⛔ Pendiente | Solo hay correo SMTP. |
| RNF-24 | Comunicación | WebSocket en la cola virtual | Alta | ✅ Implementado | `/ws/virtual-queue` con `QueueBroadcastService`. |
| RNF-25 | Usabilidad | Diseño adaptable (responsive) | Alta | 🟡 Parcial | No se verificó de forma integral en este análisis; hay que probarlo en distintos dispositivos. |
| RNF-26 | Usabilidad | Compatibilidad de navegadores | Media | 🟡 Parcial | Angular 18 es compatible con los navegadores modernos; faltan pruebas cruzadas. |
| RNF-28 | Calidad | SOLID y Clean Code | Alta | 🟡 Parcial | La estructura es buena, pero hay `System.out.println` de depuración, código comentado y un `sleep` bloqueante. |
| RNF-29 | Calidad | OpenAPI (Swagger) | Alta | ⛔ Pendiente | No está la dependencia `springdoc`. |
| RNF-30 | Calidad | Git con estrategia de ramas | Alta | ✅ Implementado | El historial del backend muestra ramas `feature/*` y pull requests. |
| RNF-31 | Calidad | Pruebas unitarias | Alta | 🟡 Parcial | 34 pruebas unitarias en `feature/jimmy` (días no laborables, `JwtFilter`, acceso del equipo, estadísticas y contrato JSON). El resto del backend no tiene pruebas y el front no tiene runner configurado. |
| RNF-32 | Calidad | Pruebas de integración | Baja | ⛔ Pendiente | La única prueba de integración de `payment-service` no coincide con la firma actual de `ProcessPaymentCommand`. |
| RNF-33 | Monitoreo | Registro de eventos | Alta | 🟡 Parcial | Se usa Log4j2 o Slf4j junto con `System.out`; no hay logs estructurados ni centralizados. |
| RNF-34 | Monitoreo | Auditoría | Alta | ⛔ Pendiente | Solo existen `createdAt` y `updatedAt`; no se registra qué usuario hizo cada acción. |
| RNF-35 | IA | Disponibilidad del servicio de IA | Alta | ⚪ Fuera de alcance | Se aplicará cuando se incorpore el módulo de IA (trabajo futuro). |
| RNF-36 | IA | Tiempo de respuesta de la IA | Media | ⚪ Fuera de alcance | Igual que RNF-35. |
| RNF-37 | Configuración | Variables de entorno | Media | ✅ Implementado | Base de datos, correo, Mongo, Redis, clave de pago, URL de la pasarela (`PAYMENT_SERVICE_URL`) y credencial de Firebase (`FIREBASE_CREDENTIALS`) vienen de variables de entorno. |
| RNF-38 | Configuración | Configuración externa | Media | ✅ Implementado | Archivos `application.yaml` con variables y `environment.ts` en el front. |
| RNF-39 | Mantenibilidad | Modularidad | Alta | ✅ Implementado | Módulos por dominio y servicios de pago desacoplados (WebSocket, Redis y webhook). |
| RNF-40 | Portabilidad | Despliegue en varios ambientes | Alta | ✅ Implementado | El front tiene archivos de entorno (`apiUrl`, `wsUrl`) y el backend toma todas las URL y secretos de variables de entorno. |
| RNF-41 | Integración | Pagos asíncronos y desacoplados: el cobro se procesa por un servicio de pagos independiente (WebSocket, cola Redis y webhook), con idempotencia por `orderId` y un tiempo máximo de espera configurable | Alta | ✅ Implementado | `pasarela_pagos` (`payment-service`, `authorization-payment`); `payment.timeout = 15` s. |

---

## 5. Reglas de negocio

| ID | Proceso | Regla | Prioridad | Estado | Evidencia / brecha |
|---|---|---|---|---|---|
| RN-01 | Suscripciones | La barbería solo opera con suscripción activa | Alta | 🟡 Parcial | Lo controla el front (`barbershop-subscription.guard`). **El backend no bloquea** las operaciones de una barbería sin suscripción. |
| RN-02 | Suscripciones | Suspensión por vencimiento | Alta | 🟡 Parcial | El scheduler de expiración está activo (12-nov) y pasa las suscripciones a `EXPIRED`, pero el backend no bloquea las operaciones de una barbería sin suscripción (ver RN-01). |
| RN-41 | Suscripciones | Una sola suscripción vigente: una barbería no puede tener dos suscripciones activas o pendientes al mismo tiempo; una renovación pagada queda "Aprobada" y se activa al vencer la actual | Alta | ✅ Implementado | `CreateSubscriptionBarberUC`, `RenewSubscriptionUC`, `UpdateSubscriptionBarberStatusUC`. |
| RN-42 | Suscripciones | Vigencia: la suscripción empieza cuando se aprueba el pago y dura el número de días del plan contratado | Alta | ✅ Implementado | `SubscriptionBarbershop.processPaymentResult` (`expirationDate = inicio + duration` días). |
| RN-03 | Usuarios | Correo único dentro de la barbería | Alta | ⛔ Pendiente | La unicidad se valida por documento y UID, no por correo. |
| RN-04 | Usuarios | Celular único dentro de la barbería | Alta | ⛔ Pendiente | No se valida. |
| RN-05 | Usuarios | Solo los usuarios activos inician sesión | Alta | ✅ Implementado | `AuthenticationUC.authorization` rechaza a los usuarios que no están `ACTIVE` (AT_002) y el filtro JWT lo valida en cada petición. |
| RN-06 | Usuarios | Los usuarios bloqueados no se autentican | Alta | ✅ Implementado | Igual que RN-05: el bloqueo aplica desde la siguiente petición del usuario. |
| RN-07 | Usuarios | Todo usuario tiene un rol | Alta | ✅ Implementado | `roleId` es obligatorio (`@NotNull`). |
| RN-48 | Usuarios | Motivo de bloqueo: todo bloqueo de un usuario debe registrar el motivo | Media | ✅ Implementado (barberos) | El motivo (5 a 200 caracteres) es obligatorio y se guarda con la fecha y el administrador en `bloqueo_usuario`; se muestra en el listado del equipo. |
| RN-08 | Barberos | Al menos una especialidad | Media | 🟡 Parcial | El campo `specialty` existe (texto único); no se verificó que sea obligatorio. |
| RN-09 | Agenda | No reservar sobre un horario ocupado | Alta | ✅ Implementado | `existsByEmployeeAndRange` (con el riesgo de concurrencia descrito en RNF-14). |
| RN-10 | Agenda | Reservar solo dentro del horario laboral | Alta | ⛔ Pendiente | La creación de reservas no consulta el horario (`SchedulePort`). |
| RN-11 | Agenda | La duración depende del servicio | Alta | ✅ Implementado | La hora de fin se calcula como el inicio más la suma de las duraciones de los servicios. |
| RN-12 | Agenda | Solo se reprograman reservas no iniciadas | Alta | ⛔ Pendiente | La reprogramación no existe (RF-51). |
| RN-47 | Agenda | Plazo de reprogramación: la barbería define si permite reprogramar y con cuántas horas de anticipación mínima | Media | ⛔ Pendiente | La vista de políticas lo captura; no hay modelo ni validación en el backend. |
| RN-13 | Reservas | Toda reserva inicia en "Pendiente" | Alta | ✅ Implementado | `PENDING` para reservas programadas; `WAITING` para las de cola. |
| RN-14 | Reservas | Máquina de estados de la reserva. Transiciones permitidas: Pendiente → Confirmada; Confirmada → En proceso; En proceso → Finalizada; Confirmada → No asistió; Pendiente o Confirmada → Cancelada; En espera (cola) → En proceso. Finalizada, Cancelada y No asistió son estados finales. Una reserva en proceso no se puede cancelar | Alta | 🟡 Parcial | El dominio impide confirmar si la reserva no está pendiente, pero **permite cancelar una reserva `IN_PROGRESS`**, lo que contradice la regla. |
| RN-15 | Reservas | Sin reservas duplicadas del cliente en el mismo horario | Alta | ✅ Implementado | `existsByCustomerAndRange`. |
| RN-16 | Reservas | Plazo de cancelación del cliente: el cliente solo puede cancelar con la anticipación mínima configurada por la barbería (RF-22), que por defecto es de 24 horas. Si falta menos tiempo, el sistema rechaza la cancelación | Alta | ⛔ Pendiente | No hay validación de tiempo y las políticas no se guardan (RF-22). |
| RN-17 | Reservas | Cancelación por el administrador: el administrador puede cancelar cualquier reserva que aún no haya iniciado, sin importar el plazo, pero debe registrar el motivo; el cliente es notificado | Alta | ⛔ Pendiente | La cancelación funciona, pero no se exige ni se guarda el motivo. |
| RN-43 | Penalizaciones | Contabilización: cada reserva marcada como "No asistió" suma una inasistencia al historial del cliente en esa barbería | Alta | ⛔ Pendiente | Ver RF-82. |
| RN-44 | Penalizaciones | Restricción automática: cuando el cliente alcanza el umbral de inasistencias dentro del periodo configurado, no puede crear nuevas reservas en esa barbería mientras dure la restricción | Alta | ⛔ Pendiente | Ver RF-83 y RF-84. |
| RN-45 | Penalizaciones | Alcance por barbería: las inasistencias y restricciones de un cliente solo aplican en la barbería donde se generaron | Alta | ⛔ Pendiente | Depende del aislamiento multi-tenant (RN-34). |
| RN-46 | Penalizaciones | Levantamiento: la restricción vence automáticamente al terminar su duración; el administrador puede retirarla antes registrando el motivo | Media | ⛔ Pendiente | No implementado. |
| RN-18 | Cola virtual | Las reservas programadas tienen prioridad sobre la cola | Alta | ✅ Implementado | `CreateReservationQueueUc` usa `QueueAvailabilityService`: rechaza el ingreso si el turno no termina antes de la próxima reserva programada del barbero. |
| RN-19 | Cola virtual | Atención por orden de llegada | Alta | ✅ Implementado | `findWaitingQueueByEmployeeId` y luego el primero en espera. |
| RN-20 | Cola virtual | Pierde el turno si no acepta a tiempo | Media | ⛔ Pendiente | No existe el mecanismo de aceptar el turno ni su tiempo límite. |
| RN-49 | Cola virtual | Cola única por barbero: un barbero no puede abrir una cola que ya está abierta | Media | ✅ Implementado | `OpenQueueUC` lo valida con `existsByEmployeeIdAndBarbershopIdAndAcceptingClients`. |
| RN-50 | Cola virtual | Condiciones de ingreso: solo se puede ingresar a la cola de un barbero que esté aceptando clientes y que pertenezca a la barbería indicada | Alta | ✅ Implementado | `CreateReservationQueueUc.validateQueue`. |
| RN-51 | Cola virtual | Atención única: un barbero atiende un solo turno de la cola a la vez, y solo puede finalizar el turno que tiene en atención | Alta | ✅ Implementado | `NextCustomerUC` y `CompleteCurrentTurnUC`. |
| RN-21 | Servicios | Solo se reservan servicios activos | Alta | 🟡 Parcial | La cola virtual valida que los servicios estén activos y pertenezcan a la barbería. La reserva programada (`CreateReservationUc.loadServices`) no revisa el `status`. |
| RN-22 | Servicios | Se aplica el precio vigente al reservar | Alta | ⛔ Pendiente | `ServiceReservation` guarda la duración, pero **no el precio** del momento. |
| RN-23 | Pagos | Toda reserva finalizada tiene un pago | Alta | ⛔ Pendiente | `BOOKING_TRANSACTION` está definido, pero no hay flujo de cobro de reservas. |
| RN-24 | Pagos | Solo los métodos de pago configurados | Media | ⛔ Pendiente | No existe la configuración de métodos de pago. |
| RN-25 | Inventario | No consumir productos inexistentes | Alta | ⚪ Fuera de alcance | No hay requisitos funcionales ni módulo de inventario en esta versión. Se conserva para una fase futura. |
| RN-26 | Inventario | Alerta de stock mínimo | Baja | ⚪ Fuera de alcance | Igual que RN-25. |
| RN-29 | IA | Las predicciones son solo informativas | Alta | ⚪ Fuera de alcance | Se aplicará cuando se incorpore el módulo de IA. |
| RN-30 | IA | El negocio sigue funcionando sin IA | Alta | ⚪ Fuera de alcance | Igual que RN-29. |
| RN-31 | Notificaciones | Reserva confirmada notifica al cliente y al barbero | Alta | 🟡 Parcial | Se notifica solo al cliente, por correo. |
| RN-33 | Auditoría | Registrar las operaciones críticas | Alta | ⛔ Pendiente | Ver RNF-34. |
| RN-34 | Multi-tenant | Nadie accede a datos de otra barbería | Alta | ⛔ Pendiente | Los endpoints reciben IDs sin verificar a quién pertenecen; muchas rutas son públicas. |
| RN-35 | Administración | Eliminación lógica de registros críticos | Alta | 🟡 Parcial | Ver RNF-22. |
| RN-36 | Administración | No eliminar un usuario con reservas activas | Media | ⛔ Pendiente | No existe la eliminación de usuarios, así que la regla aún no se aplica. |
| RN-37 | Administración | No eliminar un servicio con reservas futuras | Alta | ⛔ Pendiente | No hay eliminación ni validación al desactivar. |
| RN-38 | Reportes | Indicadores solo de la barbería autenticada | Alta | ✅ Implementado | El backend toma la barbería de la sesión del administrador, nunca de la petición. |
| RN-40 | Protección de datos | Datos personales solo para usuarios autorizados | Alta | 🟡 Parcial | Desde noviembre todas las rutas exigen sesión, salvo los *onboarding* y `/auth/verify`, y los WebSocket exigen token. Faltan el control por rol y la pertenencia a la barbería (RN-34), y la cola sigue entregando documento, celular y correo de los clientes en espera. |

---

## 6. Control de cambios respecto a la matriz original (`documento 2.xlsx`)

| # | Cambio aplicado | Requisitos afectados |
|---|---|---|
| C-01 | Los IDs que faltan en la numeración quedan registrados como retirados y no se reutilizan (sección 1.6). | RF-40, RNF-03, RNF-15, RNF-27, RN-27, RN-28, RN-32, RN-39 |
| C-02 | Se diferencian dos requisitos que tenían el mismo nombre: "Consultar agenda del barbero" y "Consultar agenda de la barbería". | RF-39, RF-57 |
| C-03 | Se resuelve la contradicción sobre cancelaciones: el cliente cancela según el plazo configurable de la barbería (24 h por defecto) y el administrador puede cancelar antes del inicio registrando el motivo. | RN-16, RN-17 |
| C-04 | Las reglas de inventario quedan fuera del alcance de esta versión porque no tienen requisitos funcionales asociados. | RN-25, RN-26 |
| C-05 | El flujo de estados de la reserva se redefine como máquina de estados con transiciones y estados finales explícitos, e incluye el estado "En espera" de la cola. | RN-14, RF-59 |
| C-06 | La gestión de sesiones se alinea con la arquitectura adoptada: ID token de Firebase validado por el backend, en lugar de un JWT propio. | RNF-08, RF-11 |
| C-07 | El cierre de sesión se precisa: además de cerrar la sesión en el cliente, se revocan los tokens en Firebase. | RF-17 |
| C-08 | Se incorporan requisitos que ya estaban implementados y no figuraban en la matriz. | RF-77 a RF-81, RNF-41, RN-41, RN-42 |
| C-09 | Se incorporan los requisitos y reglas de control de asistencia y penalizaciones, que forman parte del alcance del documento de grado (sección 1.4 y Sprint 7) y no estaban en la matriz. | RF-82 a RF-85, RN-43 a RN-46 |
| C-10 | Las funciones predictivas con IA quedan fuera del alcance del PMV, según la sección 1.4 del documento de grado; se conservan como trabajo futuro. Los dashboards (RF-67, RF-68, RF-70) sí siguen dentro del alcance. | RF-65, RF-66, RF-69, RNF-35, RNF-36, RN-29, RN-30 |
| C-11 | Se eleva a prioridad Alta la comunicación cifrada y la protección contra ataques, por tratarse de un SaaS que gestiona datos personales (Ley 1581 de 2012; OWASP API Security Top 10 – 2023). | RNF-09, RNF-12 |

> **Pendiente de validar con el equipo:** C-03 (plazo por defecto de 24 h) y C-06 (no emitir un JWT propio) son decisiones de diseño propuestas. Si el equipo opta por otra alternativa, hay que ajustar estos requisitos.

---

## 7. Prioridades recomendadas (brechas de prioridad Alta)

1. **Seguridad y multi-tenant:** validar en el backend el rol y que cada recurso pertenezca a la barbería del usuario (patrón `BarbershopAdminResolver`), tomar el cliente de la sesión al unirse a la cola, limitar CORS y autenticar el webhook de la pasarela (RN-34, RN-40, RNF-04, RNF-07, RNF-12).
2. **Ciclo de vida de la reserva:** exponer iniciar, finalizar, no asistió y reprogramar; validar el horario laboral y los servicios activos; guardar el precio del momento y el motivo de cancelación (RF-51 a RF-59, RF-82, RN-10, RN-14, RN-16, RN-17, RN-21, RN-22). Sin *finalizar*, las reservas agendadas no suman en las estadísticas.
3. **Front sobre el backend existente:** cancelar y confirmar reservas, calificar, «Mi agenda», notificaciones, clientes y editar barbero (ver `CONTEXTO_PROYECTO_SMARTBARBER.md`, sección 11).
4. **Suscripción completa:** exigirla en el backend (RN-01), cancelación, cambio de plan e historial de pagos (RF-04, RF-05, RF-06).
5. **Cuenta de usuario:** recuperación y cambio de contraseña (RF-12, RF-13).
6. **Calidad y operación:** OpenAPI, Docker Compose, más pruebas, auditoría y limpieza de logs de depuración (RNF-05, RNF-29, RNF-31, RNF-34).
7. **Notificaciones:** FCM y avisos al barbero (RNF-23, RF-71, RF-74).
