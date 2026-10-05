import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { NavigationState } from './navigation-state';
import { CONTACT, waLink } from './data';
@Component({selector:'app-root', standalone:true, imports:[RouterOutlet,RouterLink], templateUrl:'./app.html', styleUrl:'./app.css', changeDetection:ChangeDetectionStrategy.OnPush})
export class App {
  private router = inject(Router);
  readonly nav = inject(NavigationState);
  readonly menu = signal(false);
  readonly isHome = signal(true);
  readonly contact = CONTACT;
  readonly whatsapp = waLink();
  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.isHome.set(this.router.url === '/');
      this.menu.set(false);
      if (!this.router.url.startsWith('/item/')) this.nav.restoreFocus();
    });
  }
  goSection(id: string) {
    this.menu.set(false);
    if (this.router.url !== '/') this.router.navigateByUrl('/').then(() => setTimeout(() => document.getElementById(id)?.scrollIntoView(), 0));
    else document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
}
