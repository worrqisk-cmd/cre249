import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnChanges,
  signal,
} from '@angular/core';
import { FormField, form, required, submit, validate } from '@angular/forms/signals';
import { CatalogStore } from './catalog-store';
import { buildMessage, Product, waLink } from './data';
import { FieldErrors } from './field-errors';

@Component({
  selector: 'app-order-message',
  standalone: true,
  imports: [FormField, FieldErrors],
  templateUrl: './order-message.html',
  styleUrl: './order-message.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderMessage implements OnChanges {
  readonly product = input<Product | null>(null);
  readonly variant = input<string | null>(null);
  readonly model = signal({ text: '' });
  readonly messageForm = form(this.model, (fields) => {
    required(fields.text, { message: 'Введите сообщение.' });
    validate(fields.text, ({ value }) =>
      !value() || value().trim() ? undefined : { kind: 'blank', message: 'Введите сообщение.' },
    );
  });
  readonly copied = signal(false);
  readonly copyError = signal('');
  private readonly catalog = inject(CatalogStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);
  private productId: string | null = null;
  private previousVariant: string | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroy.onDestroy(() => clearTimeout(this.copyTimer));
  }

  ngOnChanges(): void {
    const product = this.product();
    if (!product) return;
    const variant = this.variant();
    if (product.id !== this.productId) {
      this.messageForm().reset({ text: buildMessage(product, variant || undefined) });
    } else if (variant !== this.previousVariant) {
      // Меняем только контекст начинки: дописанные пользователем дата и пожелания
      // остаются. Если название удалено вручную, не пересобираем его текст.
      const oldContext = this.context(product.title, this.previousVariant);
      const newContext = this.context(product.title, variant);
      this.model.update((model) => ({ text: model.text.replace(oldContext, newContext) }));
    }
    this.productId = product.id;
    this.previousVariant = variant;
    this.onInput();
  }

  private context(title: string, variant: string | null): string {
    return title + (variant ? ` (начинка: ${variant.toLowerCase()})` : '');
  }

  onInput(): void {
    clearTimeout(this.copyTimer);
    this.copied.set(false);
    this.copyError.set('');
  }

  link(): string | null {
    const number = this.catalog.settings()?.whatsapp_number;
    return number && this.messageForm().valid() ? waLink(number, this.model().text) : null;
  }

  async copy(): Promise<void> {
    await submit(this.messageForm, async () => {
      this.copyError.set('');
      try {
        await navigator.clipboard.writeText(this.model().text);
        if (this.destroy.destroyed) return;
        this.copied.set(true);
        clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => this.copied.set(false), 1800);
      } catch {
        if (this.destroy.destroyed) return;
        this.copyError.set('Не удалось скопировать. Выделите сообщение и скопируйте его вручную.');
        this.host.nativeElement.querySelector('textarea')?.select();
      }
    });
  }
}
