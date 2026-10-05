// Демонстрационные данные. Источник: архив Telegram-канала «Выпечка у Миланы», прайс от 02.12.2025.
// Цены исторические — перед публикацией подтвердить у Миланы.
import medovik from './assets/photos/01_hero_medovik.jpg'
import assorti from './assets/photos/02_pirog_assorti.jpg'
import karamel from './assets/photos/03_slivochno_karamelny_pirog.jpg'
import kuraga from './assets/photos/04_pirog_kuraga_orehi.jpg'
import kurnik from './assets/photos/05_kurnik.jpg'
import myasnoy from './assets/photos/06_myasnoy_pirog.jpg'
import tvorog from './assets/photos/07_tvorozhny_pirog_s_zelenyu.jpg'
import milka from './assets/photos/08_tort_milka.jpg'
import rulet from './assets/photos/09_merengovy_rulet.jpg'
import zefir from './assets/photos/10_zefirnye_tsvety.jpg'

export const PHOTOS = { medovik, assorti, milka, rulet }

export type CategoryId = 'all' | 'savory' | 'sweet' | 'cakes' | 'desserts'
export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'savory', label: 'Несладкие пироги' },
  { id: 'sweet', label: 'Сладкие пироги' },
  { id: 'cakes', label: 'Торты' },
  { id: 'desserts', label: 'Десерты и зефир' },
]

export type Product = {
  slug: string
  title: string
  category: Exclude<CategoryId, 'all'>
  /** Публичная цена: только при подтверждённой единице */
  price?: { amount: number; unit: string }
  /** Служебно: историческая сумма без единицы, на сайте не выводится */
  internalPrice?: number
  photos: string[]
  /** object-position для телефона / компьютера */
  focus?: { mobile: string; desktop: string }
  description?: string
  variants?: { label: string; note: string }
  /** Включается владельцем вручную */
  inStock?: boolean
  hidden?: boolean
  featured?: boolean
}

export const PRODUCTS: Product[] = [
  { slug: 'forel-brokkoli', title: 'Пирог с форелью и брокколи', category: 'savory', price: { amount: 1800, unit: 'кг' }, photos: [] },
  { slug: 'myasnoy', title: 'Мясной пирог с картошкой и зеленью', category: 'savory', price: { amount: 1200, unit: 'кг' }, photos: [myasnoy], featured: true },
  { slug: 'kurnik', title: 'Курник', category: 'savory', price: { amount: 1000, unit: 'кг' }, photos: [kurnik], featured: true },
  { slug: 'tvorozhno-syrny', title: 'Творожно-сырный пирог с зелёным луком и укропом', category: 'savory', price: { amount: 1000, unit: 'кг' }, photos: [tvorog] },
  {
    slug: 'assorti', title: 'Пирог «Ассорти»', category: 'sweet', internalPrice: 1500, photos: [assorti], featured: true,
    focus: { mobile: '50% 45%', desktop: '50% 50%' },
    description: 'Сладкий пирог, в котором можно сочетать разные начинки.',
    variants: { label: 'Начинка', note: 'Варианты из публикаций канала (19.02.2025). Наличие уточняется при заказе.' },
  },
  { slug: 'slivochno-karamelny', title: 'Сливочно-карамельный пирог', category: 'sweet', internalPrice: 2000, photos: [karamel], featured: true },
  { slug: 'kuraga-oreh', title: 'Двухслойный пирог с курагой и грецким орехом', category: 'sweet', internalPrice: 1800, photos: [kuraga] },
  { slug: 'molochnaya-devochka', title: 'Торт «Молочная девочка»', category: 'cakes', price: { amount: 2200, unit: 'кг' }, photos: [] },
  {
    slug: 'milka', title: 'Торт «Милка»', category: 'cakes', price: { amount: 2200, unit: 'кг' }, photos: [milka], featured: true,
    focus: { mobile: '50% 30%', desktop: '50% 35%' },
    description: 'Шоколадные бисквитные коржи и крем, напоминающий пломбир с молочным шоколадом.',
  },
  { slug: 'orehovy', title: 'Ореховый торт', category: 'cakes', price: { amount: 1500, unit: 'кг' }, photos: [] },
  { slug: 'medovik', title: 'Медовик', category: 'cakes', photos: [medovik], featured: true, focus: { mobile: '55% 40%', desktop: '50% 40%' } },
  { slug: 'merengovy-rulet', title: 'Меренговый рулет', category: 'desserts', internalPrice: 2000, photos: [rulet], featured: true },
  { slug: 'tart', title: 'Тарт фруктово-ягодный', category: 'desserts', internalPrice: 2500, photos: [] },
  { slug: 'zefirnye-tsvety', title: 'Зефирные цветы', category: 'desserts', photos: [zefir], featured: true },
  // Пример скрытого изделия для проверки прямой ссылки
  { slug: 'pechenochny', title: 'Печёночный торт', category: 'cakes', photos: [], hidden: true },
]

export const ASSORTI_FILLINGS = ['Творог', 'Клубника', 'Малина', 'Манго-маракуйя', 'Орехи']

export const CONTACT = {
  whatsappDisplay: '+7 (964) 203-48-35',
  whatsappNumber: '79642034835', // из архива канала, актуальность проверить
  city: 'Москва',
}

export const SHOW_REVIEWS = false

export const formatPrice = (p: Product) =>
  p.price ? `${p.price.amount.toLocaleString('ru-RU')} ₽/${p.price.unit}` : 'Стоимость уточняйте'

export const buildMessage = (p: Product, variant?: string) =>
  `Здравствуйте, Милана! Хочу обсудить заказ: ${p.title}${variant ? ` (начинка: ${variant.toLowerCase()})` : ''}. ` +
  `Подскажите, пожалуйста, возможность приготовления, стоимость и удобную дату.`

export const waLink = (text?: string) =>
  `https://wa.me/${CONTACT.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`
