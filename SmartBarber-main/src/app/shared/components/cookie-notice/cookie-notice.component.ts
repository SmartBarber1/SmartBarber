import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CookieNoticeService } from './cookie-notice.service';

@Component({
  selector: 'app-cookie-notice',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-notice.component.html',
  styleUrl: './cookie-notice.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookieNoticeComponent {
  readonly notice = inject(CookieNoticeService);
}
