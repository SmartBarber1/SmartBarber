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
  testimonials: Testimonial[] = [
    {
      quote: 'El mejor arreglo de barba que me han hecho en Bogotá. Muy atentos al detalle y al gusto de cada cliente.',
      author: 'Felipe Ortega, cliente frecuente'
    },
    {
      quote: 'Ambiente cómodo, buena música y siempre puntuales con las citas. Un espacio que se siente como en casa.',
      author: 'David Salazar, cliente'
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
