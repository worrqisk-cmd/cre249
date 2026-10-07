import { ChangeDetectionStrategy, Component, input, Signal } from '@angular/core';

/** Shared presentation; validation stays in each form's schema. */
@Component({
  selector: 'app-field-errors',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (state().touched()) { @for (error of state().errors(); track $index) {
    <small class="form-error" [id]="id() + '-' + $index">{{error.message || 'Проверьте значение поля.'}}</small>
  } }`,
})
export class FieldErrors {
  readonly id = input.required<string>();
  readonly state = input.required<{ touched: Signal<boolean>; errors: Signal<readonly {message?: string}[]> }>();
}
