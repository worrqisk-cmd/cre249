// Демонстрационные названия и фотографии из архива. Исторические цены и наличие исключены.
const medovik = 'photos/01_hero_medovik.jpg'
const assorti = 'photos/02_pirog_assorti.jpg'
const karamel = 'photos/03_slivochno_karamelny_pirog.jpg'
const kuraga = 'photos/04_pirog_kuraga_orehi.jpg'
const kurnik = 'photos/05_kurnik.jpg'
const myasnoy = 'photos/06_myasnoy_pirog.jpg'
const tvorog = 'photos/07_tvorozhny_pirog_s_zelenyu.jpg'
const milka = 'photos/08_tort_milka.jpg'
const rulet = 'photos/09_merengovy_rulet.jpg'
const zefir = 'photos/10_zefirnye_tsvety.jpg'

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
  photos: string[]
  /** object-position для телефона / компьютера */
  focus?: { mobile: string; desktop: string }
  description?: string
  variants?: { label: string; note: string }
  hidden?: boolean
  featured?: boolean
}

export const PRODUCTS: Product[] = [
  { slug: 'forel-brokkoli', title: 'Пирог с форелью и брокколи', category: 'savory', photos: [] },
  { slug: 'myasnoy', title: 'Мясной пирог с картошкой и зеленью', category: 'savory', photos: [myasnoy], featured: true },
  { slug: 'kurnik', title: 'Курник', category: 'savory', photos: [kurnik], featured: true },
  { slug: 'tvorozhno-syrny', title: 'Творожно-сырный пирог с зелёным луком и укропом', category: 'savory', photos: [tvorog] },
  {
    slug: 'assorti', title: 'Пирог «Ассорти»', category: 'sweet', photos: [assorti], featured: true,
    focus: { mobile: '50% 45%', desktop: '50% 50%' },
    description: 'Сладкий пирог, в котором можно сочетать разные начинки.',
    variants: { label: 'Начинка', note: 'Варианты из публикаций канала (19.02.2025). Наличие уточняется при заказе.' },
  },
  { slug: 'slivochno-karamelny', title: 'Сливочно-карамельный пирог', category: 'sweet', photos: [karamel], featured: true },
  { slug: 'kuraga-oreh', title: 'Двухслойный пирог с курагой и грецким орехом', category: 'sweet', photos: [kuraga] },
  { slug: 'molochnaya-devochka', title: 'Торт «Молочная девочка»', category: 'cakes', photos: [] },
  {
    slug: 'milka', title: 'Торт «Милка»', category: 'cakes', photos: [milka], featured: true,
    focus: { mobile: '50% 30%', desktop: '50% 35%' },
    description: 'Шоколадные бисквитные коржи и крем, напоминающий пломбир с молочным шоколадом.',
  },
  { slug: 'orehovy', title: 'Ореховый торт', category: 'cakes', photos: [] },
  { slug: 'medovik', title: 'Медовик', category: 'cakes', photos: [medovik], featured: true, focus: { mobile: '55% 40%', desktop: '50% 40%' } },
  { slug: 'merengovy-rulet', title: 'Меренговый рулет', category: 'desserts', photos: [rulet], featured: true },
  { slug: 'tart', title: 'Тарт фруктово-ягодный', category: 'desserts', photos: [] },
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

export const formatPrice = (_p: Product) => 'Стоимость уточняйте'

export const buildMessage = (p: Product, variant?: string) =>
  `Здравствуйте, Милана! Хочу обсудить заказ: ${p.title}${variant ? ` (начинка: ${variant.toLowerCase()})` : ''}. ` +
  `Подскажите, пожалуйста, возможность приготовления, стоимость и удобную дату.`

export const waLink = (text?: string) =>
  `https://wa.me/${CONTACT.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`
