import { useRef } from 'react'
import { CONTACT, PHOTOS, PRODUCTS, SHOW_REVIEWS, type Product, waLink } from '../data'
import { useReveal } from '../hooks'
import ProductCard from './ProductCard'

type Props = { intro: boolean; onOpen: (p: Product, el: HTMLElement) => void; onCatalog: () => void }

function Hero({ intro, onCatalog }: { intro: boolean; onCatalog: () => void }) {
  return (
    <section className={`relative overflow-hidden ${intro ? 'intro' : ''}`}>
      <div className="glow pointer-events-none absolute -right-[10%] top-[-10%] h-[70%] w-[60%] rounded-full bg-[radial-gradient(closest-side,#f3d9a8aa,transparent)] blur-2xl" aria-hidden />
      <div className="relative mx-auto grid max-w-[1320px] gap-8 px-5 pb-14 pt-8 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-14 md:px-10 md:pb-24 md:pt-14">
        <div className="order-2 md:order-1">
          <p className="label i-1 text-cocoa-soft">Домашняя выпечка · Москва</p>
          <h1 className="i-1 mt-4 font-display text-[clamp(3rem,9vw,7.2rem)] leading-[0.92] tracking-[-0.01em]">
            Выпечка<br />у&nbsp;<span className="text-berry">Миланы</span>
          </h1>
          <p className="i-2 mt-6 max-w-[30rem] text-lg leading-relaxed text-cocoa-soft md:text-xl">
            Пироги, торты и десерты на заказ. Готовлю дома, в Москве — для вашего стола и ваших праздников.
          </p>
          <div className="i-3 mt-8 flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={onCatalog}>Выбрать выпечку</button>
            <a className="btn btn-ghost" href={waLink()} target="_blank" rel="noreferrer">Написать Милане</a>
          </div>
        </div>
        <figure className="relative order-1 md:order-2">
          <div className="i-photo relative overflow-hidden rounded-[22px] bg-kraft shadow-[0_30px_60px_-30px_#3a241866]">
            <img
              src={PHOTOS.medovik}
              alt="Медовик с клубникой, мандаринами и голубикой"
              className="aspect-[4/3.4] w-full object-cover object-[50%_45%] md:aspect-[5/5.4] md:object-[48%_50%]"
            />
          </div>
          <span className="tape -top-3 left-8 hidden md:block" aria-hidden />
          <figcaption className="i-3 absolute -bottom-5 right-4 flex rotate-[-3deg] items-center gap-2 rounded-sm bg-paper px-4 py-2 shadow-[0_6px_16px_-8px_#3a241855] md:-left-10 md:right-auto md:bottom-10">
            <span className="font-hand text-2xl leading-none text-cocoa">медовик с ягодами</span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

function SectionHead({ n, title, hand }: { n: string; title: string; hand?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
      <div>
        <p className="label text-cocoa-soft">{n}</p>
        <h2 className="mt-2 font-display text-[clamp(2rem,5vw,3.4rem)] leading-none">{title}</h2>
      </div>
      {hand && <span className="hidden font-hand text-2xl text-berry sm:block">{hand}</span>}
    </div>
  )
}

function Featured({ onOpen, onCatalog }: { onOpen: Props['onOpen']; onCatalog: () => void }) {
  const ref = useReveal<HTMLDivElement>(0.1)
  const items = PRODUCTS.filter((p) => p.featured && !p.hidden).slice(0, 8)
  return (
    <section id="featured" className="mx-auto max-w-[1320px] px-5 py-14 md:px-10 md:py-24">
      <SectionHead n="№ 02 — Выпечка" title="Что я пеку" hand="из разных категорий" />
      <div ref={ref} className="mt-10 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-4 md:gap-x-6 md:gap-y-12">
        {items.map((p, i) => (
          <div
            key={p.slug}
            className={`reveal ${i === 0 ? 'col-span-2 row-span-2' : ''} ${i === 3 ? 'md:translate-y-8' : ''}`}
            style={{ '--d': `${i * 60}ms` } as React.CSSProperties}
          >
            <ProductCard product={p} onOpen={onOpen} size={i === 0 ? 'lg' : 'md'} />
          </div>
        ))}
      </div>
      <div className="mt-14 flex justify-center">
        <button onClick={onCatalog} className="btn btn-ghost">Весь каталог →</button>
      </div>
    </section>
  )
}

function About() {
  const photo = useReveal<HTMLDivElement>(0.25)
  const text = useReveal<HTMLDivElement>(0.25)
  return (
    <section id="about" className="relative scroll-mt-20 bg-paper">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 md:grid-cols-[0.9fr_1.1fr] md:items-center md:gap-20 md:px-10 md:py-28">
        <div ref={photo} className="reveal-mask relative overflow-hidden rounded-[22px] bg-kraft">
          <img src={PHOTOS.rulet} alt="Меренговый рулет" loading="lazy" className="aspect-[4/5] w-full object-cover" />
        </div>
        <div ref={text}>
          <p className="label reveal text-cocoa-soft" style={{ '--d': '350ms' } as React.CSSProperties}>№ 03 — О Милане</p>
          <div className="reveal" style={{ '--d': '450ms' } as React.CSSProperties}>
            <p className="mt-6 font-display text-[clamp(1.7rem,3.6vw,2.7rem)] leading-[1.18]">
              Меня зовут Милана. Я&nbsp;занимаюсь домашней выпечкой в&nbsp;Москве.
            </p>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-cocoa-soft">
              Готовлю пироги, торты и десерты на заказ. Напишите мне, чтобы обсудить выбранное изделие и удобную дату.
            </p>
            <p className="mt-8 font-hand text-4xl text-berry">— Милана</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function HowToOrder() {
  const ref = useReveal<HTMLOListElement>(0.3)
  const steps = [
    { t: 'Выберите изделие', d: 'Посмотрите каталог и откройте то, что понравилось.' },
    { t: 'Напишите Милане', d: 'Сообщение с названием и начинкой подготовится само — останется отправить.' },
    { t: 'Согласуйте детали', d: 'Дату, возможность приготовления, стоимость, получение и оплату обсудим в переписке.' },
  ]
  return (
    <section id="order" className="mx-auto max-w-[1320px] scroll-mt-20 px-5 py-16 md:px-10 md:py-28">
      <SectionHead n="№ 04 — Как заказать" title="Три простых шага" />
      <ol ref={ref} className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        <span className="draw-line absolute left-[1.35rem] top-6 h-[calc(100%-3rem)] w-px border-l border-dashed border-cocoa/40 md:left-6 md:top-6 md:h-px md:w-[calc(100%-3rem)] md:border-l-0 md:border-t" aria-hidden />
        {steps.map((s, i) => (
          <li key={s.t} className="reveal relative flex gap-5 md:block" style={{ '--d': `${150 + i * 140}ms` } as React.CSSProperties}>
            <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cocoa bg-cream font-display text-lg md:h-12 md:w-12">
              {i + 1}
            </span>
            <div className="md:mt-6">
              <h3 className="font-display text-2xl">{s.t}</h3>
              <p className="mt-2 max-w-[22rem] leading-relaxed text-cocoa-soft">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <Delivery />
    </section>
  )
}

function Delivery() {
  const ref = useReveal<HTMLDivElement>(0.4)
  return (
    <div ref={ref} className="reveal relative mt-16 max-w-xl rotate-[-0.6deg] rounded-sm bg-kraft/70 px-7 py-6 md:ml-auto md:mt-20">
      <span className="tape -top-3 right-10" aria-hidden />
      <p className="label text-cocoa-soft">Получение</p>
      <p className="mt-2 font-display text-xl leading-snug md:text-2xl">Способ получения и удобное время согласуем при заказе.</p>
    </div>
  )
}

/** Отключаемая секция — подтверждённых отзывов пока нет */
function Reviews() {
  if (!SHOW_REVIEWS) return null
  return <section id="reviews" />
}

export function Contacts({ onCatalog }: { onCatalog: () => void }) {
  const ref = useReveal<HTMLDivElement>(0.3)
  return (
    <section id="contacts" className="scroll-mt-20 bg-cocoa text-paper">
      <div ref={ref} className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 md:grid-cols-[1.3fr_1fr] md:items-end md:px-10 md:py-24">
        <div className="reveal">
          <p className="label text-kraft">№ 05 — Контакты</p>
          <h2 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.98]">
            Напишите мне —<br /><span className="text-kraft-deep">обсудим ваш заказ</span>
          </h2>
        </div>
        <div className="reveal space-y-6" style={{ '--d': '120ms' } as React.CSSProperties}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-lg">
            <dt className="label pt-1.5 text-kraft">Город</dt><dd>{CONTACT.city}</dd>
            <dt className="label pt-1.5 text-kraft">WhatsApp</dt>
            <dd><a className="underline decoration-kraft-deep underline-offset-4 hover:text-kraft" href={waLink()} target="_blank" rel="noreferrer">{CONTACT.whatsappDisplay}</a></dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            <a href={waLink()} target="_blank" rel="noreferrer" className="btn bg-paper text-cocoa hover:bg-kraft">Написать в WhatsApp</a>
            <button onClick={onCatalog} className="btn border border-paper/40 text-paper hover:bg-paper/10">К каталогу</button>
          </div>
        </div>
      </div>
      <footer className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-2 border-t border-paper/15 px-5 py-6 text-sm text-paper/60 md:px-10">
        <span>© Выпечка у Миланы, Москва</span>
        <span>Домашняя выпечка на заказ</span>
      </footer>
    </section>
  )
}

export default function Home({ intro, onOpen, onCatalog }: Props) {
  const root = useRef<HTMLDivElement>(null)
  return (
    <div ref={root}>
      <Hero intro={intro} onCatalog={onCatalog} />
      <Featured onOpen={onOpen} onCatalog={onCatalog} />
      <About />
      <HowToOrder />
      <Reviews />
    </div>
  )
}
