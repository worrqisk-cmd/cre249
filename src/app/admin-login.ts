import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, validate, disabled, submit } from '@angular/forms/signals';
import { FieldErrors } from './field-errors';
import { Router, RouterLink } from '@angular/router';
import { AdminAuth } from './admin-auth';

@Component({
  standalone: true,
  imports: [RouterLink, FormField, FieldErrors],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLogin {
  private readonly auth = inject(AdminAuth);
  private readonly router = inject(Router);
  readonly model = signal({ login: '', password: '' });
  readonly loginForm = form(this.model, (p) => {
    disabled(p, ({ state }) => state.submitting());
    required(p.login, { message: 'Введите логин.' });
    validate(p.login, ({ value }) =>
      !value() || value().trim() ? undefined : { kind: 'blank', message: 'Введите логин.' },
    );
    required(p.password, { message: 'Введите пароль.' });
  });
  readonly busy = this.loginForm().submitting;
  readonly error = signal('');

  constructor() {
    void this.auth.isOwner().then((owner) => {
      if (owner) void this.router.navigateByUrl('/admin');
    });
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    await submit(this.loginForm, {
      action: async () => {
        this.error.set('');
        try {
          await this.auth.login(this.model().login, this.model().password);
          this.loginForm().reset({ login: this.model().login, password: '' });
        } catch (error) {
          this.error.set(
            error instanceof Error ? error.message : 'Не удалось войти. Попробуйте ещё раз.',
          );
        }
      },
      onInvalid: (field) => {
        field().errorSummary()[0]?.fieldTree().focusBoundControl();
      },
    });
  }
}
