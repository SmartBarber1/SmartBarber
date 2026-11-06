import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { formEndpoints } from '../../forms/form-config';
import { LegalConsentComponent } from '../legal-consent/legal-consent.component';

type SubmitState = 'idle' | 'sending' | 'success' | 'error';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LegalConsentComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  state: SubmitState = 'idle';
  submitted = false;

  subscribeForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    consent: [false, Validators.requiredTrue]
  });

  get emailInvalid(): boolean {
    const email = this.subscribeForm.controls.email;
    return email.invalid && (email.touched || this.submitted);
  }

  onSubscribe(): void {
    this.submitted = true;

    if (this.subscribeForm.invalid) {
      this.subscribeForm.markAllAsTouched();
      return;
    }

    this.state = 'sending';

    // Solo se envía el correo y la fecha de la autorización, como prueba del consentimiento.
    const payload = {
      email: this.subscribeForm.controls.email.value,
      consentAt: new Date().toISOString()
    };

    this.http.post(formEndpoints.newsletterEndpoint, payload, {
      headers: { Accept: 'application/json' }
    }).subscribe({
      next: () => {
        this.state = 'success';
        setTimeout(() => {
          this.state = 'idle';
          this.submitted = false;
          this.subscribeForm.reset();
        }, 3000);
      },
      error: () => {
        this.state = 'error';
        setTimeout(() => (this.state = 'idle'), 4000);
      }
    });
  }
}
