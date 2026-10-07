import { DestroyRef, ElementRef, inject, Injectable } from '@angular/core';

/** Окружение модального окна: viewport, клавиатура, inert и scroll lock. */
@Injectable()
export class ProductDialogEnvironment {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroy = inject(DestroyRef);
  private readonly viewport = typeof window === 'undefined' ? null : window.visualViewport;

  attach(standalone: boolean, requestClose: () => void): void {
    if (typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      }
      if (event.key !== 'Tab' || standalone) return;
      const controls = [
        ...this.host.querySelectorAll<HTMLElement>('button,a[href],textarea'),
      ].filter(
        (control) =>
          !control.hasAttribute('disabled') && getComputedStyle(control).visibility !== 'hidden',
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    this.destroy.onDestroy(() => document.removeEventListener('keydown', onKey));
    if (standalone) return;

    // Каталог остаётся в DOM: блокируем взаимодействие и scroll, а не заменяем
    // фон. При уничтожении возвращаем прежнее состояние, включая inline overflow.
    const previousOverflow = document.body.style.overflow;
    const background = ['.catalog-page', 'header', '.contacts'].flatMap((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      return element ? [{ element, wasInert: element.hasAttribute('inert') }] : [];
    });
    document.body.style.overflow = 'hidden';
    background.forEach(({ element }) => element.setAttribute('inert', ''));
    const updateViewport = (): void => {
      if (!this.viewport) return;
      this.host.style.setProperty('--visual-height', `${this.viewport.height}px`);
      this.host.style.setProperty('--visual-top', `${this.viewport.offsetTop}px`);
    };
    updateViewport();
    this.viewport?.addEventListener('resize', updateViewport);
    this.viewport?.addEventListener('scroll', updateViewport);
    this.host.querySelector<HTMLButtonElement>('.dialog-close')?.focus({ preventScroll: true });
    this.destroy.onDestroy(() => {
      this.viewport?.removeEventListener('resize', updateViewport);
      this.viewport?.removeEventListener('scroll', updateViewport);
      background.forEach(({ element, wasInert }) => {
        if (!wasInert) element.removeAttribute('inert');
      });
      document.body.style.overflow = previousOverflow;
    });
  }
}
