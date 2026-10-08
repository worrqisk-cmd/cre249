import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  linkedSignal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

export function focusPoint(value: string): [number, number] {
  const match = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(value);
  return match ? [Math.min(100, +match[1]), Math.min(100, +match[2])] : [50, 50];
}
export function focusValue(x: number, y: number): string {
  return `${Math.round(Math.max(0, Math.min(100, x)))}% ${Math.round(Math.max(0, Math.min(100, y)))}%`;
}

@Component({
  selector: 'app-photo-focus',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './photo-focus.html',
  styleUrl: './photo-focus.scss',
})
export class PhotoFocus implements FormValueControl<string> {
  readonly value = model('50% 50%');
  readonly touched = model(false);
  readonly disabled = input(false);
  readonly src = input.required<string>();
  readonly label = input.required<string>();
  readonly id = input.required<string>();
  readonly ratio = input(4 / 5);
  readonly fit = input('cover');
  readonly fixed = input(false);
  readonly previewSrc = input('');
  readonly loaded = linkedSignal(() => {
    this.src();
    return false;
  });
  readonly failed = linkedSignal(() => {
    this.src();
    return false;
  });
  readonly point = computed(() => focusPoint(this.value()));
  readonly location = computed(() => {
    const [x, y] = this.point();
    return `Фокус: ${y < 34 ? 'верх' : y > 66 ? 'низ' : 'середина'}, ${x < 34 ? 'слева' : x > 66 ? 'справа' : 'по центру'}.`;
  });
  private readonly source = viewChild<ElementRef<HTMLButtonElement>>('source');

  focus(options?: FocusOptions): void {
    this.source()?.nativeElement.focus(options);
  }

  pick(event: MouseEvent) {
    if (this.disabled() || !this.loaded()) return;
    // Keyboard activation of a button has no pointer coordinates.
    if (event.detail === 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.value.set(
      focusValue(
        ((event.clientX - rect.left) / rect.width) * 100,
        ((event.clientY - rect.top) / rect.height) * 100,
      ),
    );
    this.touched.set(true);
  }
  move(event: KeyboardEvent) {
    if (this.disabled() || !this.loaded()) return;
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = direction[event.key];
    if (!delta) return;
    event.preventDefault();
    const [x, y] = this.point(),
      step = event.shiftKey ? 10 : 1;
    this.value.set(focusValue(x + delta[0] * step, y + delta[1] * step));
    this.touched.set(true);
  }
  reset() {
    if (!this.disabled()) {
      this.value.set('50% 50%');
      this.touched.set(true);
    }
  }
}
