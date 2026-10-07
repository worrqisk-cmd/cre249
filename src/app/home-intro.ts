import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';
import { animate } from 'animejs';

@Component({
  selector: 'app-home-intro',
  standalone: true,
  templateUrl: './home-intro.html',
  styleUrl: './home-intro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeIntro implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);
  private readonly animations: ReturnType<typeof animate>[] = [];
  private finishTimer: ReturnType<typeof setTimeout> | undefined;
  private failSafeTimer: ReturnType<typeof setTimeout> | undefined;

  ngAfterViewInit() {
    const layer = this.host.nativeElement.querySelector<HTMLElement>('.home-intro');
    if (!layer) return;
    // The real opaque layer now exists; replace the early cover in the same render.
    document.documentElement.removeAttribute('data-home-intro');

    // The timer removes the layer independently of anime.js; CSS also makes it
    // transparent after 2.1 s if JavaScript is interrupted altogether.
    const finish = () => layer.classList.add('home-intro--finished');
    this.failSafeTimer = setTimeout(finish, 2100);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      finish();
      return;
    }

    try {
      const composition = layer.querySelector<HTMLElement>('.home-intro__composition');
      const cake = layer.querySelector<HTMLElement>('.home-intro__cake');
      const rotation = layer.querySelector<HTMLElement>('.home-intro__cake-rotation');
      const artwork = layer.querySelector<HTMLElement>('.home-intro__cake-artwork');
      const brand = layer.querySelector<HTMLElement>('.home-intro__brand');
      if (!composition || !cake || !rotation || !artwork || !brand) {
        finish();
        return;
      }

      // Figma timeline: cake is visible at 0.35 s, settles at 1.25 s, then
      // the parent composition fades from 1.25 s to 1.6 s.
      this.animations.push(
        animate(cake, { opacity: [0, 1], duration: 350, ease: 'out(3)' }),
        animate(rotation, { rotate: ['3deg', '0deg'], duration: 1150, ease: 'out(3)' }),
        animate(artwork, { translateY: ['10px', '0px'], duration: 850, ease: 'out(3)' }),
        animate(artwork, {
          translateY: ['0px', '-2px'],
          delay: 850,
          duration: 400,
          ease: 'out(3)',
        }),
        animate(brand, { opacity: [0, 1], delay: 120, duration: 430, ease: 'out(3)' }),
        animate(brand, {
          translateY: ['5px', '0px'],
          delay: 120,
          duration: 430,
          ease: 'out(3)',
        }),
        animate(composition, {
          opacity: [1, 0],
          delay: 1250,
          duration: 350,
          ease: 'out(1)',
        }),
      );
      this.finishTimer = setTimeout(finish, 1600);
    } catch {
      finish();
    }

    this.destroy.onDestroy(() => {
      if (this.finishTimer) clearTimeout(this.finishTimer);
      if (this.failSafeTimer) clearTimeout(this.failSafeTimer);
      this.animations.forEach((animation) => animation.cancel());
    });
  }
}
