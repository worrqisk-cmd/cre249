import { Signal, WritableSignal } from '@angular/core';
import {
  applyEach,
  disabled,
  form,
  pattern,
  readonly,
  required,
  validate,
} from '@angular/forms/signals';
import { Category, DEFAULT_DELIVERY, ProductRow, SiteSettings } from './data';
import { ProductPayload } from './database.types';

export type ProductFormModel = Omit<ProductRow, 'price' | 'price_unit' | 'fillings'> & {
  price: string;
  price_unit: string;
  fillings: string;
};
export type SettingsFormModel = Omit<SiteSettings, 'whatsapp_number' | 'telegram_username'> & {
  whatsapp_number: string;
  telegram_username: string;
};

export function emptyProductModel(): ProductFormModel {
  return {
    id: '',
    slug: '',
    title: '',
    description: '',
    category_id: '',
    fillings: '',
    price: '',
    price_unit: '',
    photos: [],
    primary_photo: 0,
    sort_order: 0,
    featured: false,
    published: false,
    availability: 'unconfirmed',
    updated_at: '',
  };
}

export function productToForm(row: ProductRow): ProductFormModel {
  return {
    ...structuredClone(row),
    photos: row.photos.map((photo) => ({
      ...photo,
      desktop: photo.desktop || '50% 50%',
      mobile: photo.mobile || '50% 50%',
    })),
    price: row.price === null ? '' : String(row.price),
    price_unit: row.price_unit || '',
    fillings: row.fillings.join('\n'),
  };
}

export function productPayload(model: ProductFormModel): ProductPayload {
  // Исходный текст остаётся в модели при ошибке API. Нормализацию выполняем
  // только на границе записи: пустая цена -> null, строки начинок -> уникальный массив.
  return {
    slug: model.slug,
    title: model.title.trim(),
    description: model.description,
    category_id: model.category_id,
    fillings: [
      ...new Set(
        model.fillings
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ],
    price: model.price.trim() === '' ? null : Number(model.price),
    price_unit: model.price_unit || null,
    photos: model.photos,
    primary_photo: model.primary_photo,
    sort_order: model.sort_order,
    featured: model.featured,
    published: model.published,
    availability: model.availability,
  };
}

export function settingsToForm(settings: SiteSettings): SettingsFormModel {
  return {
    ...settings,
    whatsapp_number: settings.whatsapp_number || '',
    telegram_username: settings.telegram_username || '',
  };
}

export function settingsPayload(model: SettingsFormModel): SiteSettings {
  return {
    id: true,
    city: model.city.trim() || 'Москва',
    whatsapp_number: model.whatsapp_number.trim() || null,
    telegram_username: model.telegram_username.trim().replace(/^@/, '') || null,
    delivery_text: model.delivery_text.trim() || DEFAULT_DELIVERY,
  };
}

function validPrice(value: string): boolean {
  return value.trim() === '' || (/^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)));
}

function validPhotoFocus(value: string): boolean {
  if (!/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/.test(value)) return false;
  return value.split(' ').every((part) => Number(part.slice(0, -1)) <= 100);
}

function validWhatsApp(value: string): boolean {
  const phone = value.trim();
  if (!phone) return true;
  return /^\+?[\d\s()-]+$/.test(phone) && /^\d{7,15}$/.test(phone.replace(/\D/g, ''));
}

function validTelegram(value: string): boolean {
  const username = value.trim();
  return !username || /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username);
}

export function createProductForm(
  model: WritableSignal<ProductFormModel>,
  context: { busy: Signal<boolean>; isNew: Signal<boolean>; categories: Signal<Category[]> },
) {
  return form(model, (fields) => {
    disabled(fields, () => context.busy());
    readonly(fields.slug, () => !context.isNew());
    required(fields.title, { message: 'Укажите название.' });
    validate(fields.title, ({ value }) =>
      !value() || value().trim() ? undefined : { kind: 'blank', message: 'Укажите название.' },
    );
    required(fields.slug, { message: 'Укажите slug.' });
    pattern(fields.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, {
      message: 'Используйте латиницу, цифры и дефисы.',
    });
    required(fields.category_id, { message: 'Выберите категорию.' });
    validate(fields.category_id, ({ value }) =>
      context.categories().some((category) => category.id === value())
        ? undefined
        : { kind: 'category', message: 'Выберите доступную категорию.' },
    );
    validate(fields.sort_order, ({ value }) =>
      Number.isSafeInteger(value())
        ? undefined
        : { kind: 'integer', message: 'Укажите целое число.' },
    );
    validate(fields.price, ({ value }) =>
      validPrice(value())
        ? undefined
        : { kind: 'price', message: 'Укажите неотрицательную цену, до двух знаков после точки.' },
    );
    applyEach(fields.photos, (photo) => {
      for (const focus of [photo.desktop, photo.mobile]) {
        validate(focus, ({ value }) =>
          validPhotoFocus(value())
            ? undefined
            : { kind: 'focus', message: 'Укажите две позиции от 0% до 100%, например 50% 50%.' },
        );
      }
    });
  });
}

export function createSettingsForm(
  model: WritableSignal<SettingsFormModel>,
  busy: Signal<boolean>,
) {
  return form(model, (fields) => {
    disabled(fields, () => busy());
    validate(fields.whatsapp_number, ({ value }) =>
      validWhatsApp(value())
        ? undefined
        : { kind: 'phone', message: 'Укажите телефон: от 7 до 15 цифр.' },
    );
    validate(fields.telegram_username, ({ value }) =>
      validTelegram(value())
        ? undefined
        : {
            kind: 'username',
            message: 'Username: 5–32 латинских символа, цифры или _, начинается с буквы.',
          },
    );
  });
}
