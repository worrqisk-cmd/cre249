import { Seo } from './seo';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationState } from './navigation-state';
import { HomeIntroState } from './home-intro-state';
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
  private readonly router = inject(Router);
  readonly nav = inject(NavigationState);

  readonly catalog = inject(CatalogStore);
  readonly menu = signal(false);
  readonly isHome = signal(true);
  readonly showSiteCredit = signal(shouldShowSiteCredit(this.router.url));
  readonly contactNumber = this.catalog.contactNumber;
  readonly whatsapp = this.catalog.whatsapp;
  readonly telegram = this.catalog.telegram;
  readonly delivery = this.catalog.delivery;
  constructor() {
    // Эти сервисы подписываются на первую навигацию: создаём их до lazy Home.
    inject(Seo);
    inject(HomeIntroState);
    void this.catalog.load();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.isHome.set(this.router.url === '/');
        this.showSiteCredit.set(shouldShowSiteCredit(this.router.url));
        this.menu.set(false);
        if (!this.router.url.startsWith('/item/')) this.nav.restoreFocus();
      });
  }
  goSection(id: string): void {
    this.menu.set(false);
    if (this.router.url !== '/') {
      void this.router.navigateByUrl('/').then(() => {
        setTimeout(() => document.getElementById(id)?.scrollIntoView(), 0);
      });
      return;
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
  }
}
