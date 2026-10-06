import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class AdminAuth {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  readonly owner = signal(false);
  readonly checking = signal(true);
  private checked: Promise<boolean> | null = null;

  async isOwner(): Promise<boolean> {
    if (this.checked) return this.checked;
    this.checked = (async () => {
      const { data, error } = await this.supabase.client.auth.getUser();
      const owner = !error && data.user?.id === this.supabase.config.adminUserId;
      this.owner.set(owner);
      this.checking.set(false);
      return owner;
    })().finally(() => this.checked = null);
    return this.checked;
  }

  async login(login: string, password: string): Promise<void> {
    if (login.trim().toLowerCase() !== this.supabase.config.adminLogin.toLowerCase()) throw new Error('Неверный логин или пароль.');
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: this.supabase.config.adminEmail, password,
    });
    if (error || data.user?.id !== this.supabase.config.adminUserId) {
      if (data.user) await this.supabase.client.auth.signOut();
      throw new Error('Неверный логин или пароль либо нет доступа к админке.');
    }
    this.owner.set(true);
    await this.router.navigateByUrl('/admin');
  }

  async logout() {
    await this.supabase.client.auth.signOut();
    this.owner.set(false);
    await this.router.navigateByUrl('/admin/login');
  }
}
