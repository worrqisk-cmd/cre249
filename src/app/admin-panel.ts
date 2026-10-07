import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { form, FormField, required, pattern, validate, readonly, disabled, applyEach, submit } from '@angular/forms/signals';
import { FieldErrors } from './field-errors';
import { RouterLink } from '@angular/router';
import { Category, DEFAULT_DELIVERY, ProductPhoto, ProductRow, SiteSettings } from './data';
import { AdminAuth } from './admin-auth';
import { CatalogStore } from './catalog-store';
import { PHOTO_BUCKET, SupabaseService } from './supabase';

type ProductDraft = ProductRow;
type ProductModel = Omit<ProductRow, 'price' | 'price_unit' | 'fillings'> & { price: string; price_unit: string; fillings: string };
type SettingsModel = Omit<SiteSettings, 'whatsapp_number' | 'telegram_username'> & { whatsapp_number: string; telegram_username: string };
const emptyProduct = (): ProductModel => ({ id: '', slug: '', title: '', description: '', category_id: '', fillings: '', price: '', price_unit: '', photos: [], primary_photo: 0, sort_order: 0, featured: false, published: false, availability: 'unconfirmed', updated_at: '' });

@Component({ standalone: true, imports: [RouterLink, FormField, FieldErrors], templateUrl: './admin-panel.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminPanel {
  private supabase = inject(SupabaseService).client;
  private auth = inject(AdminAuth);
  private catalog = inject(CatalogStore);
  readonly rows = signal<ProductRow[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly productModel = signal<ProductModel>(emptyProduct());
  private readonly selected = signal(false);
  readonly draft = computed<ProductDraft | null>(() => {
    if (!this.selected()) return null;
    const model = this.productModel();
    return { ...model, price: model.price.trim() === '' ? null : Number(model.price), price_unit: model.price_unit || null,
      fillings: [...new Set(model.fillings.split(/\r?\n/).map(line => line.trim()).filter(Boolean))] };
  });
  readonly productForm = form(this.productModel, p => {
    disabled(p, () => this.saving() || this.uploading());
    readonly(p.slug, () => !this.isNew());
    required(p.title, {message: 'Укажите название.'});
    validate(p.title, ({value}) => !value() || value().trim() ? undefined : {kind: 'blank', message: 'Укажите название.'});
    required(p.slug, {message: 'Укажите slug.'});
    pattern(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, {message: 'Используйте латиницу, цифры и дефисы.'});
    required(p.category_id, {message: 'Выберите категорию.'});
    validate(p.category_id, ({value}) => this.categories().some(c => c.id === value()) ? undefined : {kind: 'category', message: 'Выберите доступную категорию.'});
    validate(p.sort_order, ({value}) => Number.isSafeInteger(value()) ? undefined : {kind: 'integer', message: 'Укажите целое число.'});
    validate(p.price, ({value}) => value().trim() === '' || (/^\d+(\.\d{1,2})?$/.test(value()) && Number.isFinite(Number(value()))) ? undefined : {kind: 'price', message: 'Укажите неотрицательную цену, до двух знаков после точки.'});
    applyEach(p.photos, photo => {
      for (const focus of [photo.desktop, photo.mobile]) {
        validate(focus, ({value}) => /^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/.test(value()) && value().split(' ').every(part => Number(part.slice(0, -1)) <= 100) ? undefined : {kind: 'focus', message: 'Укажите две позиции от 0% до 100%, например 50% 50%.'});
      }
    });
  });
  readonly settings = signal<SettingsModel>({id: true, city: '', whatsapp_number: '', telegram_username: '', delivery_text: ''});
  readonly settingsForm = form(this.settings, p => {
    disabled(p, () => this.saving());
    validate(p.whatsapp_number, ({value}) => !value().trim() || (/^\+?[\d\s()-]+$/.test(value().trim()) && /^\d{7,15}$/.test(value().replace(/\D/g, ''))) ? undefined : {kind: 'phone', message: 'Укажите телефон: от 7 до 15 цифр.'});
    validate(p.telegram_username, ({value}) => !value().trim() || /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(value().trim()) ? undefined : {kind: 'username', message: 'Username: 5–32 латинских символа, цифры или _, начинается с буквы.'});
  });
  readonly previews = signal<string[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly isNew = signal(false);
  readonly tab = signal<'products' | 'settings'>('products');
  readonly dirty = computed(() => this.draft() !== null && JSON.stringify(this.productModel()) !== this.original);
  readonly settingsDirty = computed(() => this.originalSettings !== '' && JSON.stringify(this.settings()) !== this.originalSettings);
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
    const copy: SettingsModel = {...structuredClone(value), whatsapp_number: value.whatsapp_number || '', telegram_username: value.telegram_username || ''};
    this.settingsForm().reset(copy);this.originalSettings = JSON.stringify(copy);
  }

  private canDiscard(): boolean {
    if (this.saving() || this.uploading()) {
      this.error.set('Дождитесь завершения сохранения или загрузки фотографии.');
      return false;
    }
    if (!this.dirty() && !this.settingsDirty()) return true;
    if (!window.confirm('Есть несохранённые изменения. Покинуть страницу без сохранения?')) return false;
    void this.discardUploads();
    if (this.draft()) this.productForm().reset(JSON.parse(this.original) as ProductModel);
    if (this.settings()) this.settingsForm().reset(JSON.parse(this.originalSettings) as SettingsModel);
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
    this.setDraft(copy);this.isNew.set(false);
    this.error.set('');this.notice.set('');this.pendingRemovals.clear();this.uncommittedUploads.clear();
    void this.updatePreviews(copy.photos);
  }

  create() {
    if (!this.canDiscard()) return;
    const copy: ProductDraft = {
      id: crypto.randomUUID(), slug: '', title: '', description: '', category_id: this.categories()[0]?.id || '',
      fillings: [], price: null, price_unit: null, photos: [], primary_photo: 0, sort_order: Math.max(0, ...this.rows().map(row => row.sort_order)) + 10,
      featured: false, published: false, availability: 'unconfirmed', updated_at: '',
    };
    this.setDraft(copy);this.isNew.set(true);this.previews.set([]);
    this.error.set('');this.notice.set('');this.pendingRemovals.clear();this.uncommittedUploads.clear();
  }

  private setDraft(row: ProductRow) {
    const model: ProductModel = {...row, price: row.price === null ? '' : String(row.price), price_unit: row.price_unit || '', fillings: row.fillings.join('\n')};
    this.productForm().reset(model);this.selected.set(true);this.original = JSON.stringify(model);
  }
  patch(value: Pick<Partial<ProductDraft>, 'photos' | 'primary_photo'>) {
    this.productModel.update(model => ({...model, ...value}));
  }

  setPrimary(index: number) {
    if (!this.saving() && !this.uploading()) this.patch({ primary_photo: index });
  }

  removePhoto(index: number) {
    const draft = this.draft();if (!draft || this.saving() || this.uploading()) return;
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
    const draft = this.draft();if (!file || !draft || this.uploading() || this.saving()) return;
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
    if (this.saving() || this.uploading() || !this.draft()) return;
    await submit(this.productForm, {action: async () => { await this.persistProduct(); }, onInvalid: field => { field().errorSummary()[0]?.fieldTree().focusBoundControl(); }});
  }

  private async persistProduct() {
    const draft = this.draft();if (!draft || this.saving() || this.uploading()) return;
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
      this.setDraft(saved);this.isNew.set(false);
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
    if (this.saving() || this.uploading()) return;
    await submit(this.settingsForm, {action: async () => { await this.persistSettings(); }, onInvalid: field => { field().errorSummary()[0]?.fieldTree().focusBoundControl(); }});
  }

  private async persistSettings() {
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
