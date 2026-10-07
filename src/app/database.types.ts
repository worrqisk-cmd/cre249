import { Category, ProductRow, SiteSettings } from './data';

export type ProductPayload = Omit<ProductRow, 'id' | 'updated_at'>;

/** Типы текущих таблиц из supabase/migrations; политика доступа остаётся на сервере. */
export interface Database {
  public: {
    Tables: {
      products: {
        Row: { [Key in keyof ProductRow]: ProductRow[Key] };
        Insert: ProductPayload & { id?: string; updated_at?: string };
        Update: Partial<ProductPayload>;
        Relationships: [];
      };
      categories: {
        Row: { [Key in keyof Category]: Category[Key] };
        Insert: { [Key in keyof Category]: Category[Key] };
        Update: Partial<Category>;
        Relationships: [];
      };
      site_settings: {
        Row: { [Key in keyof SiteSettings]: SiteSettings[Key] };
        Insert: { [Key in keyof SiteSettings]: SiteSettings[Key] };
        Update: Partial<SiteSettings>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
