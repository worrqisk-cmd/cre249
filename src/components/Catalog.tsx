import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CATEGORIES, type CategoryId, PRODUCTS, type Product, waLink } from '../data'
import ProductCard from './ProductCard'

export type CatalogState = 'ok' | 'loading' | 'empty' | 'error'

type Props = {
  category: CategoryId
  onCategory: (c: CategoryId) => void
  state: CatalogState
  onRetry: () => void
  onOpen: (p: Product, el: HTMLElement) => void
}

function Tabs({ category, onCategory }: Pick<Props, 'category' | 'onCategory'>) {
  const wrap = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelector<HTMLElement>(`[data-cat="${category}"]`)
      if (el) setInd({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [category])
  return (
    <div ref={wrap} role="tablist" aria-label="Категории" className="relative flex flex-wrap gap-2">
      {ind && (
        <span
          aria-hidden
          className="absolute left-0 top-0 rounded-full bg-cocoa transition-[transform,width,height] duration-[240ms] ease-[var(--ease-soft)] motion-reduce:transition-none"
          style={{ transform: `translate(${ind.x}px, ${ind.y}px)`, width: ind.w, height: ind.h }}
        />
      )}
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          role="tab"
          data-cat={c.id}
          aria-selected={c.id === category}
          onClick={() => onCategory(c.id)}
          className={`relative z-10 min-h-11 rounded-full border px-4 text-[0.95rem] transition-colors duration-200 ${
            c.id === category ? 'border-cocoa text-paper' : 'border-line text-cocoa hover:border-cocoa/50'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

export default function Catalog({ category, onCategory, state, onRetry, onOpen }: Props) {
  const items = state === 'empty' ? [] : PRODUCTS.filter((p) => !p.hidden && (category === 'all' || p.category === category))
  const inner = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number | undefined>()
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => setAnimKey((k) => k + 1), [category, state])
  // плавное изменение высоты области
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const catLabel = CATEGORIES.find((c) => c.id === category)?.label

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-20 pt-10 md:px-10 md:pt-16">
      <div className="grid gap-6 border-b border-line pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="label text-cocoa-soft">Каталог</p>
          <h1 className="mt-3 font-display text-[clamp(2.6rem,7vw,5rem)] leading-[0.95]">Вся выпечка</h1>
        </div>
        <p className="max-w-sm text-cocoa-soft">
          Возможность приготовления, дату и стоимость уточняйте в переписке — каждое изделие готовится на заказ.
        </p>
      </div>
      <div className="sticky top-16 z-20 -mx-5 bg-cream/90 px-5 py-4 backdrop-blur-md md:top-[72px] md:-mx-10 md:px-10">
        <Tabs category={category} onCategory={onCategory} />
      </div>

      <div className="overflow-hidden transition-[height] duration-[260ms] ease-[var(--ease-soft)] motion-reduce:transition-none" style={{ height: h }}>
        <div ref={inner} className="pt-6" aria-live="polite">
          {state === 'loading' && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4" aria-busy="true" aria-label="Загрузка каталога">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <div className="skeleton aspect-[4/5] rounded-[14px]" />
                  <div className="skeleton mt-3 h-4 w-4/5 rounded" />
                  <div className="skeleton mt-2 h-3 w-2/5 rounded" />
                </div>
              ))}
            </div>
          )}

          {state === 'error' && (
            <div className="page-in mx-auto max-w-lg rounded-[18px] border border-dashed border-berry/50 bg-paper px-6 py-10 text-center">
              <p className="label text-berry">Ошибка загрузки</p>
              <h2 className="mt-3 font-display text-2xl">Каталог сейчас не загрузился</h2>
              <p className="mt-3 text-cocoa-soft">Это техническая ошибка, а не пустой ассортимент. Попробуйте ещё раз или напишите Милане напрямую.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button className="btn btn-primary" onClick={onRetry}>Повторить</button>
                <a className="btn btn-ghost" href={waLink()} target="_blank" rel="noreferrer">Написать в WhatsApp</a>
              </div>
            </div>
          )}

          {(state === 'ok' || state === 'empty') && items.length === 0 && (
            <div key={animKey} className="page-in py-14 text-center">
              <p className="font-hand text-4xl text-berry">пока пусто</p>
              <p className="mx-auto mt-3 max-w-sm text-cocoa-soft">
                В категории «{catLabel}» сейчас нет изделий. Загляните в другие разделы или спросите Милану.
              </p>
              <button className="btn btn-ghost mt-6" onClick={() => onCategory('all')}>Показать все</button>
            </div>
          )}

          {state === 'ok' && items.length > 0 && (
            <div key={animKey} className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
              {items.map((p, i) => (
                <ProductCard key={p.slug} product={p} onOpen={onOpen} index={i} animate />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
