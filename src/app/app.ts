import { Seo } from './seo';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { NavigationState } from './navigation-state';
import { HomeIntroState } from './home-intro-state';
import {
  CONTACT_MESSAGE,
  DEFAULT_DELIVERY,
  PROTOTYPE_WHATSAPP,
  telegramLink,
  waLink,
} from './data';
import { CatalogStore } from './catalog-store';

export function shouldShowSiteCredit(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  return !path.startsWith('/admin') && !path.startsWith('/item/');
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private seo = inject(Seo);
  private router = inject(Router);
  readonly nav = inject(NavigationState);
  // Instantiate this before the first lazy route resolves.
  private readonly homeIntro = inject(HomeIntroState);
  readonly catalog = inject(CatalogStore);
  readonly menu = signal(false);
  readonly isHome = signal(true);
  readonly showSiteCredit = signal(shouldShowSiteCredit(this.router.url));
  readonly contactNumber = computed(
    () =>
      this.catalog.settings()?.whatsapp_number ||
      (this.catalog.state() === 'error' ? PROTOTYPE_WHATSAPP : null),
  );
  readonly whatsapp = computed(() =>
    this.contactNumber() ? waLink(this.contactNumber()!, CONTACT_MESSAGE) : null,
  );
  readonly telegram = computed(() =>
    this.catalog.settings()?.telegram_username
      ? telegramLink(this.catalog.settings()!.telegram_username!)
      : null,
  );
  readonly delivery = computed(() => this.catalog.settings()?.delivery_text || DEFAULT_DELIVERY);
  constructor() {
    void this.catalog.load();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.isHome.set(this.router.url === '/');
      this.showSiteCredit.set(shouldShowSiteCredit(this.router.url));
      this.menu.set(false);
      if (!this.router.url.startsWith('/item/')) this.nav.restoreFocus();
    });
  }
  goSection(id: string) {
    this.menu.set(false);
    if (this.router.url !== '/')
      this.router
        .navigateByUrl('/')
        .then(() => setTimeout(() => document.getElementById(id)?.scrollIntoView(), 0));
    else
      document.getElementById(id)?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
  }
}
