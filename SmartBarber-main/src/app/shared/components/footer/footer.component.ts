import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { formEndpoints } from '../../forms/form-config';
import { RouterLink } from '@angular/router';

type SubmitState = 'idle' | 'sending' | 'success' | 'error';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  state: SubmitState = 'idle';

  subscribeForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  onSubscribe(): void {
    if (this.subscribeForm.invalid) {
      this.subscribeForm.markAllAsTouched();
      return;
    }

    this.state = 'sending';

    this.http.post(formEndpoints.newsletterEndpoint, this.subscribeForm.value, {
      headers: { Accept: 'application/json' }
    }).subscribe({
      next: () => {
        this.state = 'success';
        setTimeout(() => {
          this.state = 'idle';
          this.subscribeForm.reset();
        }, 3000);
      },
      error: (err) => {
        console.error('Error al suscribir:', err);
        this.state = 'error';
        setTimeout(() => (this.state = 'idle'), 4000);
      }
    });
  }
}