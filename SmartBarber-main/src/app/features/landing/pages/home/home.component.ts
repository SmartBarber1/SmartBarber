import { Component } from '@angular/core';

import { HeroComponent } from '../../components/hero/hero.component';
import { AboutComponent } from '../../components/about/about.component';
import { TeamComponent } from '../../components/team/team.component';
import { TestimonialsComponent } from '../../components/testimonials/testimonials.component';
import { CtaBannerComponent } from '../../components/cta-banner/cta-banner.component';

import { ServicesComponent } from '../../../services/components/services/services.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HeroComponent,
    AboutComponent,
    ServicesComponent,
    TeamComponent,
    TestimonialsComponent,
    CtaBannerComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {}