import { inject, Injectable } from '@angular/core';
import { Category, DEFAULT_DELIVERY, ProductRow, SiteSettings } from './data';
import { ProductPayload } from './database.types';
import { SupabaseService } from './supabase';

export interface AdminCatalogData {
  products: ProductRow[];
  categories: Category[];
  settings: SiteSettings;
}

export class ProductConflict extends Error {
  constructor() {
    super('Запись изменилась в другой вкладке. Обновите список перед повтором.');
  }
}

@Injectable({ providedIn: 'root' })
export class AdminCatalogApi {
  private readonly client = inject(SupabaseService).client;

  async load(): Promise<AdminCatalogData> {
    const [products, categories, settings] = await Promise.all([
      this.client.from('products').select('*').order('sort_order').order('slug'),
      this.client.from('categories').select('*').order('sort_order'),
      this.client.from('site_settings').select('*').eq('id', true).maybeSingle(),
    ]);
    if (products.error || categories.error || settings.error) {
      throw products.error || categories.error || settings.error;
    }
    return {
      products: products.data || [],
      categories: categories.data || [],
      settings: settings.data || {
        id: true,
        city: 'Москва',
        whatsapp_number: null,
        telegram_username: null,
        delivery_text: DEFAULT_DELIVERY,
      },
    };
  }

  async saveProduct(
    payload: ProductPayload,
    record: Pick<ProductRow, 'id' | 'updated_at'>,
    isNew: boolean,
  ): Promise<ProductRow> {
    // updated_at защищает от затирания изменений другой вкладки. После успеха
    // редактор должен принять возвращённую запись, включая новую серверную версию.
    const query = isNew
      ? this.client
          .from('products')
          .upsert({ id: record.id, ...payload }, { onConflict: 'id' })
          .select('*')
          .single()
      : this.client
          .from('products')
          .update(payload)
          .eq('id', record.id)
          .eq('updated_at', record.updated_at)
          .select('*')
          .maybeSingle();
    const { data, error } = await query;
    if (error) throw error;
    if (!data) throw new ProductConflict();
    return data;
  }

  async saveSettings(payload: SiteSettings): Promise<SiteSettings> {
    const { data, error } = await this.client
      .from('site_settings')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();
    if (error || !data) throw error || new Error('No settings returned');
    return data;
  }
}
