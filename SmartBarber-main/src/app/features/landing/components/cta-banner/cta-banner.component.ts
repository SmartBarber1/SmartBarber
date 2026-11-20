import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cta-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cta-banner.component.html',
  styleUrl: './cta-banner.component.css'
})
export class CtaBannerComponent {}
