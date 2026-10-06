import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminAuth } from './admin-auth';

@Component({ standalone: true, imports: [RouterLink], template: `
<section class="admin-login container">
  <p class="eyebrow">Управление каталогом</p><h1>Вход для Миланы</h1>
  <form (submit)="submit($event)">
    <label>Логин<input type="text" name="username" autocomplete="username" required [value]="login()" (input)="login.set($any($event.target).value)"></label>
    <label>Пароль<input type="password" name="password" autocomplete="current-password" required [value]="password()" (input)="password.set($any($event.target).value)"></label>
    @if(error()){<p class="form-error" role="alert">{{error()}}</p>}
    <button class="button primary" type="submit" [disabled]="busy()">{{busy()?'Проверяем…':'Войти'}}</button>
  </form>
  <a class="text-link" routerLink="/catalog">← Вернуться в каталог</a>
</section>`, changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminLogin {
  private auth = inject(AdminAuth);
  private router = inject(Router);
  readonly login = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    void this.auth.isOwner().then(owner => { if (owner) void this.router.navigateByUrl('/admin'); });
  }

  async submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.error.set('');this.busy.set(true);
    try { await this.auth.login(this.login(), this.password());this.password.set(''); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Не удалось войти. Попробуйте ещё раз.'); }
    finally { this.busy.set(false); }
  }
}
