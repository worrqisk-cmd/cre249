import { ChangeDetectionStrategy, Component, input, Signal } from '@angular/core';

/** Shared presentation; validation stays in each form's schema. */
@Component({
  selector: 'app-field-errors',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './field-errors.html',
})
export class FieldErrors {
  readonly id = input.required<string>();
  readonly state = input.required<{
    touched: Signal<boolean>;
    errors: Signal<readonly { message?: string }[]>;
  }>();
}
