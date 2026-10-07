import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Decides once, during the application's initial navigation, whether the
 * decorative home intro belongs to this document load. Keeping this in a
 * root service prevents a later in-app visit to `/` from replaying it.
 */
@Injectable({ providedIn: 'root' })
export class HomeIntroState {
  readonly shouldPlay = signal(false);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly startedOnHome = this.isBrowser && this.isHomePath();
  private readonly fullPageLoad = this.isBrowser && this.isDocumentLoad();
  private readonly reducedMotion =
    this.isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private firstNavigation = true;

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (!this.firstNavigation) {
          this.shouldPlay.set(false);
          return;
        }
        this.firstNavigation = false;
        this.shouldPlay.set(
          this.startedOnHome &&
            this.fullPageLoad &&
            document.documentElement.dataset['homeIntro'] === 'pending' &&
            !this.reducedMotion &&
            event.urlAfterRedirects === '/',
        );
        if (this.isBrowser && !this.shouldPlay())
          document.documentElement.removeAttribute('data-home-intro');
      });
  }

  private isHomePath() {
    return window.location.pathname === new URL(document.baseURI).pathname;
  }

  private isDocumentLoad() {
    const navigation = performance.getEntriesByType('navigation').at(0) as
      PerformanceNavigationTiming | undefined;
    return !navigation || navigation.type === 'navigate' || navigation.type === 'reload';
  }
}
