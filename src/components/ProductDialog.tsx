import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ASSORTI_FILLINGS, type Product, buildMessage, formatPrice, waLink } from '../data'
import { prefersReduced } from '../hooks'
import { PhotoPlaceholder } from './ProductCard'

type Props = {
  product: Product | null
  missing?: boolean
  closing: boolean
  origin: HTMLElement | null
  onRequestClose: () => void
  onClosed: () => void
  onCatalog: () => void
}

const EASE = 'cubic-bezier(0.22, 0.8, 0.24, 1)'

/** Летящий клон фотографии между двумя прямоугольниками */
function flyClone(src: string, from: DOMRect, to: DOMRect, duration: number, fromRadius: number, toRadius: number) {
  const img = document.createElement('img')
  img.src = src
  Object.assign(img.style, {
    position: 'fixed', zIndex: '70', objectFit: 'cover', pointerEvents: 'none', margin: '0',
    left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
  })
  document.body.appendChild(img)
  const anim = img.animate(
    [
      { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: `${fromRadius}px` },
      { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: `${toRadius}px` },
    ],
    { duration, easing: EASE, fill: 'forwards' },
  )
  const done = anim.finished.catch(() => {}).finally(() => img.remove())
  return { anim, done, img }
}

const visible = (r: DOMRect) => r.bottom > 0 && r.top < window.innerHeight && r.width > 0

export default function ProductDialog({ product: p, missing, closing, origin, onRequestClose, onClosed, onCatalog }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const heroImg = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const flight = useRef<ReturnType<typeof flyClone> | null>(null)
  const [active, setActive] = useState(0)
  const [variant, setVariant] = useState<string | undefined>()
  const [composing, setComposing] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (p) setMessage(buildMessage(p, variant)) }, [p, variant])

  // Открытие: фото из карточки перелетает в диалог, текст появляется следом
  useLayoutEffect(() => {
    if (!p && !missing) return
    const reduced = prefersReduced()
    const dur = reduced ? 160 : 420
    backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * 0.8, easing: 'ease-out' })
    panel.current?.animate(
      reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
      { duration: dur * 0.75, easing: EASE },
    )
    panel.current?.querySelectorAll<HTMLElement>('[data-stagger]').forEach((el, i) =>
      el.animate([{ opacity: 0, transform: reduced ? 'none' : 'translateY(10px)' }, { opacity: 1, transform: 'none' }], {
        duration: 320, delay: reduced ? 0 : 160 + i * 50, easing: EASE, fill: 'backwards',
      }),
    )
    const target = heroImg.current
    const srcEl = origin?.querySelector<HTMLElement>('[data-photo]')
    if (p?.photos[0] && target && srcEl && !reduced) {
      const from = srcEl.getBoundingClientRect()
      const to = target.getBoundingClientRect()
      if (visible(from)) {
        target.style.visibility = 'hidden'
        flight.current?.anim.cancel()
        flight.current = flyClone(p.photos[0], from, to, dur, 14, window.innerWidth < 768 ? 0 : 18)
        flight.current.done.then(() => { target.style.visibility = '' })
      }
    }
    closeBtn.current?.focus({ preventScroll: true })
    return () => { flight.current?.anim.cancel() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.slug, missing])

  // Закрытие: короткий обратный переход, затем фокус на карточку
  useEffect(() => {
    if (!closing) return
    const reduced = prefersReduced()
    const dur = reduced ? 140 : 280
    flight.current?.anim.cancel()
    const target = heroImg.current
    const srcEl = origin?.querySelector<HTMLElement>('[data-photo]')
    const jobs: Promise<unknown>[] = []
    if (p?.photos[0] && target && srcEl && !reduced && visible(srcEl.getBoundingClientRect())) {
      const f = flyClone(p.photos[0], target.getBoundingClientRect(), srcEl.getBoundingClientRect(), dur, window.innerWidth < 768 ? 0 : 18, 14)
      target.style.visibility = 'hidden'
      srcEl.style.visibility = 'hidden'
      jobs.push(f.done.then(() => { srcEl.style.visibility = '' }))
    }
    const a = panel.current?.animate([{ opacity: 1 }, { opacity: 0, transform: reduced ? 'none' : 'translateY(10px)' }], { duration: dur * 0.8, easing: EASE, fill: 'forwards' })
    const b = backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'ease-in', fill: 'forwards' })
    if (a) jobs.push(a.finished.catch(() => {}))
    if (b) jobs.push(b.finished.catch(() => {}))
    let cancelled = false
    Promise.all(jobs).then(() => { if (!cancelled) onClosed() })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing])

  // Escape и удержание фокуса внутри
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onRequestClose() }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button, a[href], textarea, input, [tabindex]:not([tabindex="-1"])')
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onRequestClose])

  const startCompose = () => {
    setComposing(true)
    requestAnimationFrame(() => {
      composer.current?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' })
      composer.current?.focus({ preventScroll: true })
    })
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(message) } catch {
      composer.current?.select(); document.execCommand('copy')
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  const variants = p?.slug === 'assorti' ? ASSORTI_FILLINGS : []

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6" role="presentation">
      <div ref={backdrop} className="absolute inset-0 bg-cocoa/55 backdrop-blur-[3px]" onClick={onRequestClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        className="relative flex h-full w-full flex-col overflow-hidden bg-cream md:h-auto md:max-h-[min(860px,92vh)] md:max-w-[1120px] md:rounded-[24px] md:shadow-[0_40px_80px_-30px_#1a0f0899]"
      >
        <button
          ref={closeBtn}
          onClick={onRequestClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-paper/95 text-cocoa shadow-sm transition-transform duration-150 hover:scale-105 active:scale-95 md:right-4 md:top-4"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>

        {missing || !p ? (
          <div className="m-auto max-w-md px-6 py-16 text-center">
            <p className="label text-berry" data-stagger>Изделие недоступно</p>
            <h2 id="dlg-title" className="mt-3 font-display text-3xl" data-stagger>Этого изделия сейчас нет на сайте</h2>
            <p className="mt-3 text-cocoa-soft" data-stagger>Возможно, ссылка устарела или изделие временно скрыто. Посмотрите каталог — там всё актуальное.</p>
            <button className="btn btn-primary mt-7" onClick={onCatalog} data-stagger>Перейти в каталог</button>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain md:grid-cols-[1.1fr_1fr] md:overflow-hidden">
            {/* Фото */}
            <div className="md:overflow-y-auto md:p-5 md:pr-0">
              <div ref={heroImg} className="relative aspect-[4/4.4] overflow-hidden bg-kraft md:aspect-auto md:h-[min(620px,70vh)] md:rounded-[18px]">
                {p.photos[active] ? (
                  <img
                    key={active}
                    src={p.photos[active]}
                    alt={p.title}
                    className="h-full w-full object-cover [animation:fade-in_200ms_ease-out]"
                    style={{ objectPosition: p.focus?.desktop ?? '50% 50%' }}
                  />
                ) : (
                  <PhotoPlaceholder title={p.title} />
                )}
              </div>
              {p.photos.length > 1 && (
                <div className="flex gap-2 px-5 pt-3 md:px-0">
                  {p.photos.map((src, i) => (
                    <button key={i} onClick={() => setActive(i)} aria-label={`Фото ${i + 1}`} aria-pressed={i === active}
                      className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === active ? 'border-berry' : 'border-transparent opacity-70'}`}>
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Сведения */}
            <div className="flex flex-col md:min-h-0 md:overflow-y-auto">
              <div className="flex-1 px-5 pb-8 pt-6 md:px-10 md:pt-12">
                <p className="label text-cocoa-soft" data-stagger>
                  {{ savory: 'Несладкие пироги', sweet: 'Сладкие пироги', cakes: 'Торты', desserts: 'Десерты и зефир' }[p.category]}
                </p>
                <h2 id="dlg-title" className="mt-3 pr-10 font-display text-[clamp(2rem,4vw,2.8rem)] leading-[1.05]" data-stagger>{p.title}</h2>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1" data-stagger>
                  <span className={`text-xl font-semibold ${p.price ? 'text-berry' : 'text-cocoa-soft'}`}>{formatPrice(p)}</span>
                  <span className="label text-[0.62rem] text-cocoa-soft">{p.inStock ? 'В наличии' : 'Уточнить возможность заказа'}</span>
                </div>
                {p.description && <p className="mt-6 text-lg leading-relaxed" data-stagger>{p.description}</p>}

                {variants.length > 0 && (
                  <fieldset className="mt-8" data-stagger>
                    <legend className="label text-cocoa-soft">Начинка · по желанию</legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {variants.map((v) => (
                        <button key={v} type="button" aria-pressed={variant === v} onClick={() => setVariant(variant === v ? undefined : v)}
                          className={`min-h-11 rounded-full border px-4 text-[0.95rem] transition-colors duration-150 ${variant === v ? 'border-berry bg-berry text-paper' : 'border-line hover:border-cocoa/50'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-cocoa-soft">Варианты из публикаций канала; наличие уточняется при заказе.</p>
                  </fieldset>
                )}

                <p className="mt-8 border-l-2 border-kraft-deep pl-4 text-sm leading-relaxed text-cocoa-soft" data-stagger>
                  Состав, размер и вес уточните при заказе — Милана подскажет.
                </p>

                <div className="mt-8 hidden md:block" data-stagger>
                  {!composing && <button className="btn btn-primary w-full" onClick={startCompose}>Обсудить заказ</button>}
                </div>

                {composing && (
                  <div className="page-in mt-8 rounded-[16px] border border-line bg-paper p-5">
                    <label htmlFor="msg" className="label text-cocoa-soft">Сообщение Милане</label>
                    <textarea id="msg" ref={composer} value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
                      className="mt-3 w-full resize-none rounded-lg border border-line bg-cream p-3 leading-relaxed focus:outline-none focus-visible:border-berry" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a className="btn btn-primary flex-1" href={waLink(message)} target="_blank" rel="noreferrer">Открыть WhatsApp</a>
                      <button className="btn btn-ghost" onClick={copy} aria-live="polite">{copied ? 'Скопировано ✓' : 'Скопировать'}</button>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-cocoa-soft">
                      Сообщение отправляете вы сами. Переход в мессенджер — ещё не подтверждённый заказ и не оплата.
                    </p>
                  </div>
                )}
              </div>
              {/* Закреплённая кнопка на телефоне */}
              {!composing && (
                <div className="sticky bottom-0 border-t border-line bg-cream/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
                  <button className="btn btn-primary w-full" onClick={startCompose}>Обсудить заказ</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
