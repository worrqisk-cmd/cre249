import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, validate, disabled, submit } from '@angular/forms/signals';
import { FieldErrors } from './field-errors';
import { Router, RouterLink } from '@angular/router';
import { AdminAuth } from './admin-auth';

@Component({ standalone: true, imports: [RouterLink, FormField, FieldErrors], template: `
<section class="admin-login container">
  <p class="eyebrow">Управление каталогом</p><h1>Вход для Миланы</h1>
  <form novalidate (submit)="submit($event)">
    <label>Логин<input type="text" autocomplete="username" [formField]="loginForm.login" aria-describedby="login-error-0"><app-field-errors id="login-error" [state]="loginForm.login()" /></label>
    <label>Пароль<input type="password" autocomplete="current-password" [formField]="loginForm.password" aria-describedby="password-error-0"><app-field-errors id="password-error" [state]="loginForm.password()" /></label>
    @if(error()){<p class="form-error" role="alert">{{error()}}</p>}
    <button class="button primary" type="submit" [disabled]="busy()">{{busy()?'Проверяем…':'Войти'}}</button>
  </form>
  <a class="text-link" routerLink="/catalog">← Вернуться в каталог</a>
</section>`, changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminLogin {
  private auth = inject(AdminAuth);
  private router = inject(Router);
  readonly model = signal({login: '', password: ''});
  readonly loginForm = form(this.model, p => {
    disabled(p, () => this.loginForm().submitting());
    required(p.login, {message: 'Введите логин.'});
    validate(p.login, ({value}) => !value() || value().trim() ? undefined : {kind: 'blank', message: 'Введите логин.'});
    required(p.password, {message: 'Введите пароль.'});
  });
  readonly busy = this.loginForm().submitting;
  readonly error = signal('');

  constructor() {
    void this.auth.isOwner().then(owner => { if (owner) void this.router.navigateByUrl('/admin'); });
  }

  async submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    await submit(this.loginForm, {action: async () => {
      this.error.set('');
      try { await this.auth.login(this.model().login, this.model().password);this.loginForm().reset({login: this.model().login, password: ''}); }
      catch (error) { this.error.set(error instanceof Error ? error.message : 'Не удалось войти. Попробуйте ещё раз.'); }
    }, onInvalid: field => { field().errorSummary()[0]?.fieldTree().focusBoundControl(); }});
  }
}
