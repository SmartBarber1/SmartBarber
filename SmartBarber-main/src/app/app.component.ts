import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CookieNoticeComponent } from './shared/components/cookie-notice/cookie-notice.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CookieNoticeComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {}
