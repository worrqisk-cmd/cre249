import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { FormField, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Category, ProductPhoto, ProductRow, SiteSettings } from './data';
import { FieldErrors } from './field-errors';
import { AdminAuth } from './admin-auth';
import { AdminCatalogApi, ProductConflict } from './admin-catalog-api';
import { AdminPhotos, validUpload } from './admin-photos';
import { CatalogStore } from './catalog-store';
import {
  createProductForm,
  createSettingsForm,
  emptyProductModel,
  productPayload,
  productToForm,
  ProductFormModel,
  settingsPayload,
  settingsToForm,
  SettingsFormModel,
} from './admin-forms';

type AdminTab = 'products' | 'settings';

@Component({
  standalone: true,
  imports: [RouterLink, FormField, FieldErrors],
  providers: [AdminPhotos],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPanel {
  private readonly api = inject(AdminCatalogApi);
  private readonly auth = inject(AdminAuth);
  private readonly catalog = inject(CatalogStore);
  private readonly photos = inject(AdminPhotos);
  readonly rows = signal<ProductRow[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = this.photos.uploading;
  readonly busy = computed(() => this.saving() || this.uploading());
  readonly previews = this.photos.previews;
  readonly error = signal('');
  readonly notice = signal('');
  readonly isNew = signal(false);
  readonly tab = signal<AdminTab>('products');

  readonly productModel = signal<ProductFormModel>(emptyProductModel());
  private readonly selected = signal(false);
  readonly draft = computed(() => (this.selected() ? this.productModel() : null));
  readonly productForm = createProductForm(this.productModel, {
    busy: this.busy,
    isNew: this.isNew,
    categories: this.categories,
  });
  readonly settingsModel = signal<SettingsFormModel>({
    id: true,
    city: '',
    whatsapp_number: '',
    telegram_username: '',
    delivery_text: '',
  });
  readonly settingsForm = createSettingsForm(this.settingsModel, this.saving);
  private readonly originalProduct = signal<ProductFormModel | null>(null);
  private readonly originalSettings = signal<SettingsFormModel | null>(null);
  readonly dirty = computed(
    () =>
      this.selected() &&
      JSON.stringify(this.productModel()) !== JSON.stringify(this.originalProduct()),
  );
  readonly settingsDirty = computed(
    () =>
      this.originalSettings() !== null &&
      JSON.stringify(this.settingsModel()) !== JSON.stringify(this.originalSettings()),
  );
  private leaving = false;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.load();
      this.rows.set(data.products);
      this.categories.set(data.categories);
      this.setSettings(data.settings);
    } catch {
      this.error.set('Не удалось загрузить данные. Проверьте подключение и права доступа.');
    } finally {
      this.loading.set(false);
    }
  }

  private setSettings(settings: SiteSettings): void {
    const model = settingsToForm(settings);
    this.settingsForm().reset(model);
    this.originalSettings.set(structuredClone(model));
  }

  private setDraft(row: ProductRow): void {
    const model = productToForm(row);
    this.productForm().reset(model);
    this.originalProduct.set(structuredClone(model));
    this.selected.set(true);
  }

  private canDiscard(): boolean {
    if (this.busy()) {
      this.error.set('Дождитесь завершения сохранения или загрузки фотографии.');
      return false;
    }
    if (!this.dirty() && !this.settingsDirty()) return true;
    if (!window.confirm('Есть несохранённые изменения. Покинуть страницу без сохранения?'))
      return false;
    void this.photos.discard().catch(() => {});
    const product = this.originalProduct();
    const settings = this.originalSettings();
    if (product) this.productForm().reset(structuredClone(product));
    if (settings) this.settingsForm().reset(structuredClone(settings));
    return true;
  }

  canLeave(): boolean {
    return this.leaving || this.canDiscard();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.settingsDirty()) event.preventDefault();
  }

  async logout(): Promise<void> {
    if (!this.canDiscard()) return;
    this.leaving = true;
    await this.auth.logout();
  }

  selectTab(tab: AdminTab): void {
    if (tab !== this.tab() && !this.canDiscard()) return;
    this.tab.set(tab);
    this.clearFeedback();
  }

  edit(row: ProductRow): void {
    if (!this.canDiscard()) return;
    this.setDraft(row);
    this.isNew.set(false);
    this.clearFeedback();
    this.photos.beginEdit(row.photos);
  }

  create(): void {
    if (!this.canDiscard()) return;
    const nextOrder = Math.max(0, ...this.rows().map((row) => row.sort_order)) + 10;
    const model = {
      ...emptyProductModel(),
      id: crypto.randomUUID(),
      category_id: this.categories()[0]?.id || '',
      sort_order: nextOrder,
    };
    this.productForm().reset(model);
    this.originalProduct.set(structuredClone(model));
    this.selected.set(true);
    this.isNew.set(true);
    this.clearFeedback();
    this.photos.beginEdit([]);
  }

  private clearFeedback(): void {
    this.error.set('');
    this.notice.set('');
  }

  private patchPhotos(value: { photos?: ProductPhoto[]; primary_photo?: number }): void {
    this.productModel.update((model) => ({ ...model, ...value }));
  }

  setPrimary(index: number): void {
    if (!this.busy()) this.patchPhotos({ primary_photo: index });
  }

  removePhoto(index: number): void {
    const draft = this.draft();
    if (!draft || this.busy()) return;
    const photos = this.photos.remove(draft.photos, index);
    this.patchPhotos({
      photos,
      primary_photo: Math.min(draft.primary_photo, Math.max(0, photos.length - 1)),
    });
  }

  async upload(event: Event, replaceIndex?: number): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    input.value = '';
    const draft = this.draft();
    if (!file || !draft || this.busy()) return;
    if (!validUpload(file)) {
      this.error.set('Выберите JPEG, PNG или WebP размером до 8 МБ.');
      return;
    }
    this.error.set('');
    try {
      const photos = await this.photos.upload(file, draft.id, draft.photos, replaceIndex);
      this.patchPhotos({ photos });
    } catch {
      this.error.set('Не удалось загрузить фотографию. Форма сохранена; попробуйте ещё раз.');
    }
  }

  async saveProduct(): Promise<void> {
    if (this.busy() || !this.draft()) return;
    await submit(this.productForm, {
      action: async () => this.persistProduct(),
      onInvalid: (field) => field().errorSummary()[0]?.fieldTree().focusBoundControl(),
    });
  }

  private async persistProduct(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.busy()) return;
    this.saving.set(true);
    this.clearFeedback();
    try {
      const saved = await this.api.saveProduct(productPayload(draft), draft, this.isNew());
      this.setDraft(saved);
      this.isNew.set(false);
      this.rows.update((rows) =>
        [...rows.filter((row) => row.id !== saved.id), saved].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      );
      const cleaned = await this.photos.commit();
      this.notice.set(
        cleaned ? 'Изделие сохранено.' : 'Изделие сохранено, но старый файл не удалился.',
      );
      void this.catalog.load(true);
    } catch (error) {
      this.error.set(
        error instanceof ProductConflict
          ? error.message
          : 'Не удалось сохранить изделие. Данные формы сохранены; попробуйте ещё раз.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async saveSettings(): Promise<void> {
    if (this.busy()) return;
    await submit(this.settingsForm, {
      action: async () => this.persistSettings(),
      onInvalid: (field) => field().errorSummary()[0]?.fieldTree().focusBoundControl(),
    });
  }

  private async persistSettings(): Promise<void> {
    this.saving.set(true);
    this.clearFeedback();
    try {
      const saved = await this.api.saveSettings(settingsPayload(this.settingsModel()));
      this.setSettings(saved);
      this.notice.set('Настройки сохранены.');
      void this.catalog.load(true);
    } catch {
      this.error.set('Не удалось сохранить настройки. Данные формы сохранены; попробуйте ещё раз.');
    } finally {
      this.saving.set(false);
    }
  }
}
