import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Testimonial {
  quote: string;
  author: string;
}

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.css'
})
export class TestimonialsComponent implements OnInit, OnDestroy {
  // Extend here: add more entries to rotate through more quotes.
  /**
   * Opiniones de ejemplo sobre la plataforma (no de un cliente real). La
   * plantilla lo aclara con una nota hasta tener opiniones de barberías reales.
   */
  testimonials: Testimonial[] = [
    {
      quote: 'Desde que usamos SmartBarber los clientes reservan solos y ya no perdemos citas por teléfono.',
      author: 'Administrador · barbería de ejemplo'
    },
    {
      quote: 'La cola virtual nos ayuda a atender en orden a quienes llegan sin cita, sin aglomeraciones.',
      author: 'Barbero · barbería de ejemplo'
    }
  ];

  current = 0;
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.startAutoplay();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private startAutoplay(): void {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.current = (this.current + 1) % this.testimonials.length;
    }, 6000);
  }

  goTo(index: number): void {
    this.current = index;
    this.startAutoplay();
  }
}
