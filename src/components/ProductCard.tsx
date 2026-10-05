import { type Product, formatPrice } from '../data'

export function PhotoPlaceholder({ title, className = '' }: { title: string; className?: string }) {
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-kraft p-4 text-center text-cocoa-soft ${className}`}>
      <span className="font-hand text-3xl leading-none text-cocoa/70">{title.replace(/^(Пирог|Торт)\s*/, '').replace(/[«»]/g, '').split(' ')[0]}</span>
      <span className="label text-[0.62rem]">демо · фото будет добавлено</span>
    </div>
  )
}

type Props = {
  product: Product
  onOpen: (p: Product, el: HTMLElement) => void
  index?: number
  animate?: boolean
  size?: 'lg' | 'md'
}

export default function ProductCard({ product: p, onOpen, index = 0, animate, size = 'md' }: Props) {
  const photo = p.photos[0]
  return (
    <button
      type="button"
      data-slug={p.slug}
      onClick={(e) => onOpen(p, e.currentTarget)}
      className={`group block w-full text-left ${animate ? 'card-in' : ''}`}
      style={animate ? ({ '--d': `${Math.min(index, 8) * 55}ms` } as React.CSSProperties) : undefined}
      aria-label={`${p.title}, ${formatPrice(p)}. Открыть подробности`}
    >
      <div
        data-photo
        className={`relative overflow-hidden rounded-[14px] bg-kraft ${size === 'lg' ? 'aspect-[4/5] md:aspect-[5/6]' : 'aspect-[4/5]'}`}
      >
        {photo ? (
          <img
            src={photo}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-soft)] group-hover:scale-[1.035]"
            style={{ objectPosition: p.focus?.mobile ?? '50% 50%' }}
          />
        ) : (
          <PhotoPlaceholder title={p.title} />
        )}
        {/* подпись «Смотреть» — только мышь и без reduced motion */}
        <span className="pointer-events-none absolute left-3 top-3 hidden rounded-full bg-paper/90 px-3 py-1 text-xs font-medium text-cocoa opacity-0 transition-all duration-200 [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:inline-block group-hover:translate-y-0 group-hover:opacity-100 translate-y-1">
          Смотреть
        </span>
        {p.inStock && (
          <span className="absolute bottom-3 left-3 rounded-full bg-cocoa px-3 py-1 text-xs font-medium text-paper">В наличии</span>
        )}
      </div>
      <div className="mt-3 pr-2">
        <h3 className={`font-display leading-[1.15] text-cocoa ${size === 'lg' ? 'text-xl md:text-2xl' : 'text-[1.02rem] md:text-lg'}`}>
          {p.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={`text-sm font-semibold ${p.price ? 'text-berry' : 'text-cocoa-soft'}`}>{formatPrice(p)}</span>
          {!p.inStock && <span className="label text-[0.6rem] text-cocoa-soft/80">Уточнить возможность заказа</span>}
        </div>
      </div>
    </button>
  )
}
