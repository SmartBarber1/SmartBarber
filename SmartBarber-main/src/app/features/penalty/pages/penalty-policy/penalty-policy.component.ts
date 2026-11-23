import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { toUserMessage } from '../../../../core/errors';
import {
  DEFAULT_PENALTY_POLICY,
  PENALTY_LIMITS,
  PENALTY_STATE_LABELS,
  PenaltyPolicy,
  PenaltyPolicySettings,
  PenaltyStanding,
  policySummary
} from '../../domain/models/penalty.model';
import { PenaltyApiService } from '../../infrastructure/api/penalty-api.service';

/**
 * Políticas (RF-22, RF-83): el administrador ajusta la penalización por
 * inasistencias y la anticipación para cancelar, ve la vista
 * previa del texto que leerá el cliente y gestiona a los clientes en
 * advertencia o restringidos (RF-84, RN-46).
 */
@Component({
  selector: 'app-penalty-policy',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './penalty-policy.component.html',
  styleUrl: './penalty-policy.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PenaltyPolicyComponent implements OnInit {

  private readonly api = inject(PenaltyApiService);
  private readonly fb = inject(FormBuilder);

  readonly limits = PENALTY_LIMITS;
  readonly stateLabels = PENALTY_STATE_LABELS;

  readonly form = this.fb.nonNullable.group({
    enabled: [DEFAULT_PENALTY_POLICY.enabled],
    toleranceMinutes: [DEFAULT_PENALTY_POLICY.toleranceMinutes, this.range('toleranceMinutes')],
    noShowThreshold: [DEFAULT_PENALTY_POLICY.noShowThreshold, this.range('noShowThreshold')],
    countingPeriodDays: [DEFAULT_PENALTY_POLICY.countingPeriodDays, this.range('countingPeriodDays')],
    restrictionDays: [DEFAULT_PENALTY_POLICY.restrictionDays, this.range('restrictionDays')],
    cancelNoticeHours: [DEFAULT_PENALTY_POLICY.cancelNoticeHours, this.range('cancelNoticeHours')]
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Vista previa del texto que verá el cliente junto al botón de reservar. */
  readonly preview = computed(() => {
    const value = { ...DEFAULT_PENALTY_POLICY, ...this.formValue() } as PenaltyPolicy;
    return policySummary(value);
  });

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly formError = signal('');
  readonly success = signal('');
  readonly lastUpdate = signal<string | null>(null);

  readonly customers = signal<PenaltyStanding[]>([]);
  readonly customersLoading = signal(true);
  readonly customersError = signal('');

  /** Restricción que se está levantando y su motivo. */
  readonly liftingId = signal<string | null>(null);
  readonly liftReason = signal('');
  readonly liftBusy = signal(false);
  readonly liftError = signal('');

  readonly restrictedCount = computed(() => this.customers().filter(c => c.state === 'RESTRICTED').length);
  readonly warnedCount = computed(() => this.customers().filter(c => c.state === 'WARNED').length);

  ngOnInit(): void {
    this.loadPolicy();
    this.loadCustomers();
  }

  loadPolicy(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.myPolicy().subscribe({
      next: policy => {
        this.applyPolicy(policy);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.loadError.set(toUserMessage(error, { DEFAULT: 'No fue posible cargar la política de tu barbería.' }));
      }
    });
  }

  loadCustomers(): void {
    this.customersLoading.set(true);
    this.customersError.set('');
    this.api.customers().subscribe({
      next: list => {
        this.customers.set(list);
        this.customersLoading.set(false);
      },
      error: error => {
        this.customersLoading.set(false);
        this.customersError.set(toUserMessage(error, { DEFAULT: 'No fue posible consultar los clientes.' }));
      }
    });
  }

  save(): void {
    this.formError.set('');
    this.success.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Revisa los valores marcados: deben estar dentro de los límites.');
      return;
    }

    const settings: PenaltyPolicySettings = this.form.getRawValue();
    const disabling = !settings.enabled && this.restrictedCount() > 0;
    if (disabling && !window.confirm(
      'Al desactivar la penalización se levantarán las restricciones activas y se dejará de contar. ¿Continuar?')) {
      return;
    }

    this.saving.set(true);
    this.api.updateMyPolicy(settings).subscribe({
      next: policy => {
        this.saving.set(false);
        this.applyPolicy(policy);
        this.success.set('Política guardada. Aplica a las inasistencias que se marquen desde ahora.');
        if (disabling) {
          this.loadCustomers();
        }
      },
      error: error => {
        this.saving.set(false);
        this.formError.set(toUserMessage(error, { DEFAULT: 'No fue posible guardar la política.' }));
      }
    });
  }

  startLift(customer: PenaltyStanding): void {
    if (!customer.restriction) return;
    this.liftingId.set(customer.restriction.id);
    this.liftReason.set('');
    this.liftError.set('');
  }

  cancelLift(): void {
    this.liftingId.set(null);
    this.liftError.set('');
  }

  confirmLift(): void {
    const id = this.liftingId();
    const reason = this.liftReason().trim();
    if (!id || this.liftBusy()) return;
    if (reason.length < 5 || reason.length > 200) {
      this.liftError.set('Escribe el motivo (entre 5 y 200 caracteres).');
      return;
    }
    this.liftBusy.set(true);
    this.api.liftRestriction(id, reason).subscribe({
      next: () => {
        this.liftBusy.set(false);
        this.liftingId.set(null);
        this.success.set('Restricción levantada. El cliente ya puede volver a reservar y recibió un aviso.');
        this.loadCustomers();
      },
      error: error => {
        this.liftBusy.set(false);
        this.liftError.set(toUserMessage(error, { DEFAULT: 'No fue posible levantar la restricción.' }));
      }
    });
  }

  invalid(control: keyof PenaltyPolicySettings): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || field.dirty);
  }

  trackByCustomer(_: number, customer: PenaltyStanding): string {
    return customer.customerId;
  }

  private applyPolicy(policy: PenaltyPolicy): void {
    this.form.reset({
      enabled: policy.enabled,
      toleranceMinutes: policy.toleranceMinutes,
      noShowThreshold: policy.noShowThreshold,
      countingPeriodDays: policy.countingPeriodDays,
      restrictionDays: policy.restrictionDays,
      cancelNoticeHours: policy.cancelNoticeHours
    });
    this.lastUpdate.set(policy.updatedAt ?? null);
  }

  private range(field: keyof typeof PENALTY_LIMITS) {
    const { min, max } = PENALTY_LIMITS[field];
    return [Validators.required, Validators.min(min), Validators.max(max)];
  }
}
