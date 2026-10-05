import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category, DEFAULT_DELIVERY, ProductPhoto, ProductRow, SiteSettings } from './data';
import { AdminAuth } from './admin-auth';
import { CatalogStore } from './catalog-store';
import { PHOTO_BUCKET, SupabaseService } from './supabase';

type ProductDraft = ProductRow;

@Component({ standalone: true, imports: [RouterLink], templateUrl: './admin-panel.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminPanel {
  private supabase = inject(SupabaseService).client;
  private auth = inject(AdminAuth);
  private catalog = inject(CatalogStore);
  readonly rows = signal<ProductRow[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly draft = signal<ProductDraft | null>(null);
  readonly settings = signal<SiteSettings | null>(null);
  readonly previews = signal<string[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly isNew = signal(false);
  readonly tab = signal<'products' | 'settings'>('products');
  readonly dirty = computed(() => this.draft() !== null && JSON.stringify(this.draft()) !== this.original);
  readonly settingsDirty = computed(() => this.settings() !== null && JSON.stringify(this.settings()) !== this.originalSettings);
  private original = '';
  private originalSettings = '';
  private pendingRemovals = new Set<string>();
  private uncommittedUploads = new Set<string>();
  private leaving = false;

  constructor() { void this.load(); }

  async load() {
    this.loading.set(true);this.error.set('');
    try {
      const [products, categories, settings] = await Promise.all([
        this.supabase.from('products').select('*').order('sort_order').order('slug'),
        this.supabase.from('categories').select('*').order('sort_order'),
        this.supabase.from('site_settings').select('*').eq('id', true).maybeSingle(),
      ]);
      if (products.error || categories.error || settings.error) throw products.error || categories.error || settings.error;
      this.rows.set((products.data || []) as ProductRow[]);
      this.categories.set((categories.data || []) as Category[]);
      this.setSettings((settings.data || { id: true, city: 'Москва', whatsapp_number: null, telegram_username: null, delivery_text: DEFAULT_DELIVERY }) as SiteSettings);
    } catch { this.error.set('Не удалось загрузить данные. Проверьте подключение и права доступа.'); }
    finally { this.loading.set(false); }
  }

  private setSettings(value: SiteSettings) {
    const copy = structuredClone(value);
    this.settings.set(copy);this.originalSettings = JSON.stringify(copy);
  }

  private canDiscard(): boolean {
    if (this.saving() || this.uploading()) {
      this.error.set('Дождитесь завершения сохранения или загрузки фотографии.');
      return false;
    }
    if (!this.dirty() && !this.settingsDirty()) return true;
    if (!window.confirm('Есть несохранённые изменения. Покинуть страницу без сохранения?')) return false;
    void this.discardUploads();
    if (this.draft()) this.draft.set(JSON.parse(this.original) as ProductRow);
    if (this.settings()) this.settings.set(JSON.parse(this.originalSettings) as SiteSettings);
    this.pendingRemovals.clear();
    return true;
  }

  canLeave(): boolean {
    if (this.leaving) return true;
    return this.canDiscard();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty() || this.settingsDirty()) event.preventDefault();
  }

  async logout() {
    if (!this.canDiscard()) return;
    this.leaving = true;
    await this.auth.logout();
  }

  selectTab(tab: 'products' | 'settings') {
    if (tab !== this.tab() && !this.canDiscard()) return;
    this.tab.set(tab);this.error.set('');this.notice.set('');
  }

  edit(row: ProductRow) {
    if (!this.canDiscard()) return;
    const copy = structuredClone(row);
    this.draft.set(copy);this.original = JSON.stringify(copy);this.isNew.set(false);
    this.error.set('');this.notice.set('');this.pendingRemovals.clear();this.uncommittedUploads.clear();
    void this.updatePreviews(copy.photos);
  }

  create() {
    if (!this.canDiscard()) return;
    const copy: ProductDraft = {
      id: crypto.randomUUID(), slug: '', title: '', description: '', category_id: this.categories()[0]?.id || '',
      fillings: [], price: null, price_unit: null, photos: [], primary_photo: 0, sort_order: this.rows().length * 10 + 10,
      featured: false, published: false, availability: 'unconfirmed', updated_at: '',
    };
    this.draft.set(copy);this.original = JSON.stringify(copy);this.isNew.set(true);this.previews.set([]);
    this.error.set('');this.notice.set('');this.pendingRemovals.clear();this.uncommittedUploads.clear();
  }

  patch(value: Partial<ProductDraft>) { this.draft.update(draft => draft ? { ...draft, ...value } : null); }
  patchSettings(value: Partial<SiteSettings>) { this.settings.update(settings => settings ? { ...settings, ...value } : null); }
  fillingsText() { return (this.draft()?.fillings || []).join('\n'); }
  setFillings(value: string) { this.patch({ fillings: [...new Set(value.split(/\r?\n/).map(line => line.trim()).filter(Boolean))] }); }

  patchPhoto(index: number, value: Partial<ProductPhoto>) {
    const draft = this.draft();if (!draft) return;
    const photos = [...draft.photos];photos[index] = { ...photos[index], ...value };
    this.patch({ photos });
  }

  setPrimary(index: number) { this.patch({ primary_photo: index }); }

  removePhoto(index: number) {
    const draft = this.draft();if (!draft) return;
    const photos = [...draft.photos];const [removed] = photos.splice(index, 1);
    if (removed.path) {
      if (this.uncommittedUploads.delete(removed.path)) void this.supabase.storage.from(PHOTO_BUCKET).remove([removed.path]);
      else this.pendingRemovals.add(removed.path);
    }
    this.patch({ photos, primary_photo: Math.min(draft.primary_photo, Math.max(0, photos.length - 1)) });
    this.previews.update(urls => urls.filter((_, i) => i !== index));
  }

  async upload(event: Event, replaceIndex?: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];input.value = '';
    const draft = this.draft();if (!file || !draft || this.uploading()) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      this.error.set('Выберите JPEG, PNG или WebP размером до 8 МБ.');return;
    }
    this.uploading.set(true);this.error.set('');
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `products/${draft.id}/${crypto.randomUUID()}.${ext}`;
    try {
      const { error } = await this.supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      this.uncommittedUploads.add(path);
      const photo: ProductPhoto = { path, desktop: '50% 50%', mobile: '50% 50%' };
      const photos = [...draft.photos];
      if (replaceIndex === undefined) photos.push(photo);
      else {
        const previous = photos[replaceIndex];
        if (previous?.path) this.pendingRemovals.add(previous.path);
        photos[replaceIndex] = { ...photo, desktop: previous?.desktop || photo.desktop, mobile: previous?.mobile || photo.mobile };
      }
      this.patch({ photos });
      await this.updatePreviews(photos);
    } catch { this.error.set('Не удалось загрузить фотографию. Форма сохранена; попробуйте ещё раз.'); }
    finally { this.uploading.set(false); }
  }

  private async updatePreviews(photos: ProductPhoto[]) {
    const urls = await Promise.all(photos.map(photo => this.catalog.photoUrl(photo).catch(() => '')));
    this.previews.set(urls);
  }

  private async discardUploads() {
    const paths = [...this.uncommittedUploads];this.uncommittedUploads.clear();
    if (paths.length) await this.supabase.storage.from(PHOTO_BUCKET).remove(paths);
  }

  async saveProduct() {
    const draft = this.draft();if (!draft || this.saving() || this.uploading()) return;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug) || !draft.title.trim() || !draft.category_id) {
      this.error.set('Укажите название, категорию и slug латиницей через дефис.');return;
    }
    this.saving.set(true);this.error.set('');this.notice.set('');
    const payload = {
      slug: draft.slug, title: draft.title.trim(), description: draft.description, category_id: draft.category_id,
      fillings: draft.fillings, price: draft.price, price_unit: draft.price_unit, photos: draft.photos,
      primary_photo: draft.primary_photo, sort_order: draft.sort_order, featured: draft.featured,
      published: draft.published, availability: draft.availability,
    };
    try {
      const query = this.isNew()
        ? this.supabase.from('products').upsert({ id: draft.id, ...payload }, { onConflict: 'id' }).select('*').single()
        : this.supabase.from('products').update(payload).eq('id', draft.id).eq('updated_at', draft.updated_at).select('*').maybeSingle();
      const { data, error } = await query;
      if (error) throw error;
      if (!data) throw new Error('Запись изменилась в другой вкладке. Обновите список перед повтором.');
      const saved = data as ProductRow;
      this.draft.set(saved);this.original = JSON.stringify(saved);this.isNew.set(false);
      this.rows.update(rows => [...rows.filter(row => row.id !== saved.id), saved].sort((a,b) => a.sort_order - b.sort_order));
      this.uncommittedUploads.clear();
      const obsolete = [...this.pendingRemovals];this.pendingRemovals.clear();
      if (obsolete.length) {
        const result = await this.supabase.storage.from(PHOTO_BUCKET).remove(obsolete);
        if (result.error) this.notice.set('Изделие сохранено, но старый файл не удалился.');
      }
      if (!this.notice()) this.notice.set('Изделие сохранено.');
      void this.catalog.load(true);
    } catch (error) { this.error.set(error instanceof Error && error.message.includes('другой вкладке') ? error.message : 'Не удалось сохранить изделие. Данные формы сохранены; попробуйте ещё раз.'); }
    finally { this.saving.set(false); }
  }

  async saveSettings() {
    const settings = this.settings();if (!settings || this.saving()) return;
    this.saving.set(true);this.error.set('');this.notice.set('');
    try {
      const { data, error } = await this.supabase.from('site_settings').upsert({
        id: true, city: settings.city.trim() || 'Москва', whatsapp_number: settings.whatsapp_number?.trim() || null,
        telegram_username: settings.telegram_username?.replace(/^@/, '').trim() || null,
        delivery_text: settings.delivery_text.trim() || DEFAULT_DELIVERY,
      }, { onConflict: 'id' }).select('*').single();
      if (error || !data) throw error || new Error('No settings returned');
      this.setSettings(data as SiteSettings);this.notice.set('Настройки сохранены.');
      void this.catalog.load(true);
    } catch { this.error.set('Не удалось сохранить настройки. Данные формы сохранены; попробуйте ещё раз.'); }
    finally { this.saving.set(false); }
  }
}
