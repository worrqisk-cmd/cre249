export const PHOTOS = {
  medovik: 'photos/01_hero_medovik.jpg',
  process: 'photos/13_medovik_process.jpg',
};

export type CategoryId = string;
export interface Category {
  id: CategoryId;
  label: string;
  sort_order: number;
  is_public: boolean;
}

export interface ProductPhoto {
  static?: string;
  path?: string;
  desktop: string;
  mobile: string;
}

export interface ProductRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category_id: string;
  fillings: string[];
  price: number | null;
  price_unit: string | null;
  photos: ProductPhoto[];
  primary_photo: number;
  sort_order: number;
  featured: boolean;
  published: boolean;
  availability: 'unconfirmed' | 'available' | 'unavailable';
  updated_at: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  fillings: string[];
  price: number | null;
  priceUnit: string | null;
  photos: string[];
  focus?: { mobile: string; desktop: string };
  photoFocus: { mobile: string; desktop: string }[];
  featured: boolean;
  availability: ProductRow['availability'];
}

export interface SiteSettings {
  id: true;
  city: string;
  whatsapp_number: string | null;
  telegram_username: string | null;
  delivery_text: string;
}

export const DEFAULT_DELIVERY = 'Способ получения и удобное время согласуем при заказе.';
export const webpSet = (photo: string) => photo.startsWith('photos/') && photo.endsWith('.jpg')
  ? photo.replace(/\.jpg$/, '-480.webp') + ' 480w, ' + photo.replace(/\.jpg$/, '-960.webp') + ' 960w'
  : null;

export const formatPrice = (product: Product) => product.price !== null && product.priceUnit
  ? `${new Intl.NumberFormat('ru-RU').format(product.price)} ₽/${product.priceUnit}`
  : 'Стоимость уточняйте';

export const buildMessage = (product: Product, variant?: string) =>
  `Здравствуйте, Милана! Хочу обсудить заказ: ${product.title}${variant ? ` (начинка: ${variant.toLowerCase()})` : ''}. ` +
  'Подскажите, пожалуйста, возможность приготовления, стоимость и удобную дату.';

export const waLink = (number: string, text?: string) =>
  `https://wa.me/${number.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const telegramLink = (username: string) => `https://t.me/${username.replace(/^@/, '')}`;
