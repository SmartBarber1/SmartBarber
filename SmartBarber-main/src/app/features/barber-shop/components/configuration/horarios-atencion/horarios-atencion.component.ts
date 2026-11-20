import { toUserMessage } from '../../../../../core/errors';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
  Validators
} from '@angular/forms';

import { BarberShopApiService } from '../../../infrastructure/services/barber-shop-api.service';
import { SessionService } from '../../../../../core/auth/services/session.service';

import {
  ScheduleRequest,
  ScheduleResponse
} from '../../../domain/models/schedule.model';

interface EmployeeOption {
  id: string;
  name: string;
  specialty?: string;
}

@Component({
  selector: 'app-horarios-atencion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './horarios-atencion.component.html',
  styleUrls: ['./horarios-atencion.component.css']
})
export class HorariosAtencionComponent implements OnInit {

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BarberShopApiService);
  private readonly sessionService = inject(SessionService);

  horarioForm!: FormGroup;

  employees: EmployeeOption[] = [];

  selectedEmpleadoUuid = '';
  selectedEmployeeName = '';

  scheduleId: number | null = null;

  loadingEmployees = true;
  loadingSchedule = false;
  saving = false;

  scheduleExists = false;

  errorMessage = '';

  /** Error del formulario, mostrado junto al botón de guardar. */
  formError = '';

  /** Confirmación de guardado (se oculta sola). */
  successMessage = '';
  private successTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.initForm();
    this.loadEmployees();
  }

  private initForm(): void {
    this.horarioForm = this.fb.group({
      horaInicio: [
        '08:00',
        Validators.required
      ],

      horaFin: [
        '18:00',
        Validators.required
      ],

      horaInicioAlmuerzo: [
        '12:00'
      ],

      horaFinAlmuerzo: [
        '13:00'
      ],

      vacaciones: [
        false
      ]
    });

    // En vacaciones la jornada no se usa: los campos se bloquean, pero el
    // horario se conserva para cuando el barbero regrese.
    this.horarioForm.get('vacaciones')?.valueChanges.subscribe((enVacaciones: boolean) =>
      this.toggleScheduleFields(Boolean(enVacaciones))
    );
  }

  private toggleScheduleFields(enVacaciones: boolean): void {
    for (const name of ['horaInicio', 'horaFin', 'horaInicioAlmuerzo', 'horaFinAlmuerzo']) {
      const control = this.horarioForm.get(name);
      if (enVacaciones) {
        control?.disable({ emitEvent: false });
      } else {
        control?.enable({ emitEvent: false });
      }
    }
  }

  private loadEmployees(): void {

    const barbershopId =
      this.sessionService.getBarbershopId();

    this.loadingEmployees = true;
    this.errorMessage = '';

    if (!barbershopId) {

      this.loadingEmployees = false;

      this.errorMessage =
        'No encontramos una barbería asociada a tu sesión.';

      return;
    }

    this.api
      .getEmployeesByBarbershop(barbershopId)
      .subscribe({

        next: (response: unknown[]) => {

          const rawEmployees = Array.isArray(response)
            ? response
            : [];

          this.employees = rawEmployees
            .map((employee: unknown): EmployeeOption | null => {
              if (!employee || typeof employee !== 'object') {
                return null;
              }

              const item = employee as Record<string, unknown>;
              const id = item['id'] ??
                item['idEmpleado'] ??
                item['id_empleado'] ??
                item['uuid'];

              if (id === undefined || id === null || String(id).trim() === '') {
                return null;
              }

              const name = item['name'] ??
                item['nombre'] ??
                item['nombres'];
              const specialty = item['specialty'] ??
                item['especialidad'];

              return {
                id: String(id),
                name: typeof name === 'string' ? name : 'Empleado',
                specialty: typeof specialty === 'string' ? specialty : ''
              };
            })
            .filter(
              (employee): employee is EmployeeOption =>
                employee !== null
            );

          this.loadingEmployees = false;

          if (this.employees.length === 0) {

            this.errorMessage =
              'No hay barberos o empleados registrados para esta barbería.';

            this.resetScheduleState();

            return;
          }

          this.selectedEmpleadoUuid =
            this.employees[0].id;

          this.selectedEmployeeName =
            this.employees[0].name;

          this.loadSchedule(
            this.selectedEmpleadoUuid
          );
        },

        error: (error: unknown) => {

          console.error(
            '[SmartBarber] Error cargando empleados:',
            error
          );

          this.loadingEmployees = false;

          this.errorMessage =
            'No fue posible cargar el equipo de trabajo.';
        }
      });
  }

  onEmployeeChange(): void {

    const employee =
      this.employees.find(
        item =>
          item.id === this.selectedEmpleadoUuid
      );

    this.selectedEmployeeName =
      employee?.name ?? 'Empleado';

    this.loadSchedule(
      this.selectedEmpleadoUuid
    );
  }

  private loadSchedule(
    employeeId: string
  ): void {

    if (!employeeId) {
      return;
    }

    this.loadingSchedule = true;

    this.scheduleId = null;
    this.scheduleExists = false;

    this.errorMessage = '';

    this.api
      .obtenerHorarioEmpleadoPorEmpleadoId(employeeId)
      .subscribe({

        next: (response: ScheduleResponse) => {

          this.scheduleId =
            response?.id ?? null;

          this.scheduleExists =
            Boolean(this.scheduleId);

          this.patchSchedule(response);

          this.loadingSchedule = false;
        },

        error: (error: unknown) => {

          const status = this.getHttpErrorStatus(error);

          this.loadingSchedule = false;

          /*
           * Si el backend informa que el empleado
           * todavía no tiene horario, dejamos el
           * formulario preparado para crear uno.
           */
          if (
            status === 404 ||
            status === 409
          ) {

            this.resetScheduleState();

            return;
          }

          console.error(
            '[SmartBarber] Error cargando horario:',
            error
          );

          this.errorMessage =
            'No fue posible consultar el horario del empleado.';
        }
      });
  }

  saveHorarios(): void {

    if (
      this.horarioForm.invalid ||
      !this.selectedEmpleadoUuid ||
      this.saving
    ) {

      this.horarioForm.markAllAsTouched();

      return;
    }

    const formValue =
      this.horarioForm.getRawValue();

    this.formError = '';
    this.successMessage = '';

    // En vacaciones no se valida la jornada (se conserva tal como está).
    if (
      !formValue.vacaciones &&
      formValue.horaInicio >=
      formValue.horaFin
    ) {
      this.formError =
        'La hora de inicio de la jornada debe ser anterior a la hora de finalización.';
      return;
    }

    const tieneInicioAlmuerzo = Boolean(formValue.horaInicioAlmuerzo);
    const tieneFinAlmuerzo = Boolean(formValue.horaFinAlmuerzo);

    // El servidor exige el almuerzo completo (SH_003).
    if (!formValue.vacaciones && (!tieneInicioAlmuerzo || !tieneFinAlmuerzo)) {
      this.formError =
        'Indica el inicio y el fin del almuerzo.';
      return;
    }

    if (
      formValue.horaInicioAlmuerzo &&
      formValue.horaFinAlmuerzo &&
      formValue.horaInicioAlmuerzo >=
      formValue.horaFinAlmuerzo &&
      !formValue.vacaciones
    ) {
      this.formError =
        'El inicio del almuerzo debe ser anterior a su finalización.';
      return;
    }

    // El almuerzo debe quedar dentro de la jornada laboral.
    if (
      !formValue.vacaciones &&
      tieneInicioAlmuerzo &&
      (
        formValue.horaInicioAlmuerzo < formValue.horaInicio ||
        formValue.horaFinAlmuerzo > formValue.horaFin
      )
    ) {
      this.formError =
        `El almuerzo debe quedar dentro de la jornada (${formValue.horaInicio} a ${formValue.horaFin}).`;
      return;
    }

    const payload: ScheduleRequest = {

      empleadoId:
        this.selectedEmpleadoUuid,

      startTime:
        this.toLocalTime(
          formValue.horaInicio
        ),

      endTime:
        this.toLocalTime(
          formValue.horaFin
        ),

      lunchStartTime:
        this.toNullableLocalTime(
          formValue.horaInicioAlmuerzo
        ),

      lunchEndTime:
        this.toNullableLocalTime(
          formValue.horaFinAlmuerzo
        ),

      vacation:
        Boolean(formValue.vacaciones)
    };

    this.saving = true;

    const request$ =
      this.scheduleExists &&
      this.scheduleId !== null

        ? this.api.actualizarHorarioEmpleado(
            this.scheduleId,
            payload
          )

        : this.api.crearHorarioEmpleado(
            payload
          );

    request$.subscribe({

      next: (response: ScheduleResponse) => {

        this.saving = false;

        this.scheduleId =
          response?.id ??
          this.scheduleId;

        this.scheduleExists =
          Boolean(this.scheduleId);

        this.patchSchedule(response);

        clearTimeout(this.successTimer);
        this.successMessage = 'Horario guardado correctamente.';
        this.successTimer = setTimeout(() => (this.successMessage = ''), 4000);
      },

      error: (error: unknown) => {

        this.saving = false;

        console.error(
          '[SmartBarber] Error guardando horario:',
          error
        );

        this.formError = toUserMessage(error, {
          DEFAULT: 'No fue posible guardar el horario. Intenta de nuevo.'
        });
      }
    });
  }

  private patchSchedule(
    schedule: Partial<ScheduleResponse> | null
  ): void {

    this.horarioForm.patchValue({

      horaInicio:
        this.fromLocalTime(
          schedule?.startTime,
          '08:00'
        ),

      horaFin:
        this.fromLocalTime(
          schedule?.endTime,
          '18:00'
        ),

      horaInicioAlmuerzo:
        this.fromLocalTime(
          schedule?.lunchStartTime,
          '12:00'
        ),

      horaFinAlmuerzo:
        this.fromLocalTime(
          schedule?.lunchEndTime,
          '13:00'
        ),

      vacaciones:
        schedule?.vacation ?? false
    });
  }

  private resetScheduleState(): void {

    this.scheduleId = null;

    this.scheduleExists = false;

    this.horarioForm.patchValue({

      horaInicio: '08:00',

      horaFin: '18:00',

      horaInicioAlmuerzo: '12:00',

      horaFinAlmuerzo: '13:00',

      vacaciones: false
    });
  }

  private getHttpErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('status' in error)) {
      return undefined;
    }

    const status = error.status;
    return typeof status === 'number' ? status : undefined;
  }

  private toLocalTime(
    value: string
  ): string {

    return value?.length === 5
      ? `${value}:00`
      : value;
  }

  private toNullableLocalTime(
    value: string | null
  ): string | null {

    if (!value) {
      return null;
    }

    return value.length === 5
      ? `${value}:00`
      : value;
  }

  private fromLocalTime(
    value: string | null | undefined,
    fallback: string
  ): string {

    if (!value) {
      return fallback;
    }

    return value.length >= 5
      ? value.substring(0, 5)
      : fallback;
  }
}