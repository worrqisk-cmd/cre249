# Читаемость и архитектура Angular

## Основа и область

Аудит 2026-10-08: Angular 22.2.1, zoneless, standalone, Signals, lazy routes, static prerender. `origin/main` ab05054. Локальные 2663efb/f1aef5c перенесены cherry-pick в отдельную ветку `refactor/angular-maintainability`, worktree `/tmp/cre249-refactor`. b1e2e55 соответствует уже включённому 9257139 (diff исходников и теста пуст); интро 84e9837 также в main. Незавершённые файлы остальных worktree не изменяются. Google/Яндекс проверяются относительно main, файлы вне индекса исходного worktree не включаются без происхождения в main.

Проверены src/app (включая design-preview), шаблоны, CSS, конфигурация, static scripts, существующие browser/unit сценарии, таблицы и RLS в supabase/migrations. Это аудит кода; не полный SEO/performance/CRO аудит сайта. Никаких запросов записи реальных данных.

## Конкретные выводы

| Приоритет | Доказательство до рефакторинга                                                                                                                                                                 | Последствие и этап                                                                                                                                                                                           |
| :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Высокий   | `src/app/admin-panel.ts` (263 строки): прямые products/settings/storage запросы, schema, mapping, lifecycle фото, несохранённые изменения в одном классе; `admin-panel.html` 32 длинные строки | API-контракт и состояние редактора трудно проверить отдельно. Выделить конкретный admin API, модель/schema, lifecycle фото; компонент оставить координатором UI.                                             |
| Высокий   | `src/app/product-dialog.ts` (390 строк): клавиатура/viewport/inert/scroll, async decoding, anime, gallery, текст WhatsApp                                                                      | Перемешаны независимые жизненные циклы. Выделить модальное окружение, движение галереи и редактор сообщения без изменения геометрии/таймингов.                                                               |
| Высокий   | `src/styles.css` (1236 строк): глобальные основы, все компоненты, admin, item-page и mobile gallery вперемешку                                                                                 | Искать итоговое свойство приходится в нескольких местах. Разделить global foundations/shared и scoped SCSS компонентов; сохранить порядок связанных переопределений и проверить вычисленные стили/геометрию. |
| Средний   | `admin-login.ts`, `product-card.ts`, `field-errors.ts`, `not-found.ts`: inline HTML; сжатые TS/HTML в app/admin и preview                                                                      | Вынести HTML, настроить Prettier и SCSS, раскрыть методы. Никакой смены дизайна.                                                                                                                             |
| Средний   | `supabase.ts`: createClient без Database generic; `catalog-store.ts`, admin: приведения ProductRow/Category/SiteSettings                                                                       | Ошибки имён колонок и payload скрыты. Типизировать текущие таблицы по SQL, убрать приведения на API-границе; не менять RLS/schema.                                                                           |
| Средний   | `catalog-store.ts`: mapping photos и signed URLs вместе со state/cache; refresh зависит от `document.querySelector('.dialog-panel')`                                                           | Выделить конкретный публичный API и чистое преобразование; решение об открытом изделии выразить состоянием Router, без зависимости store от классов DOM.                                                     |
| Средний   | `app.ts` и `home.ts`: одинаковая contactNumber/WhatsApp/delivery логика; сложные template expressions в card                                                                                   | Единый computed contact state в CatalogStore; именованные вычисления и отдельные правила presentation карточек.                                                                                              |
| Средний   | `app.ts`, `seo.ts`, `home-intro-state.ts`: подписки не завершаются; intro cleanup зарегистрирован после ранних return                                                                          | Использовать DestroyRef/takeUntilDestroyed; регистрировать cleanup до ранних выходов. Не менять lifecycle начального cover/hydration.                                                                        |
| Средний   | `admin-panel.ts`: Telegram schema принимает пробелы вокруг @username, payload удаляет @ до trim                                                                                                | Подтверждённая ошибка нормализации: `@milana_test` хранится как `@milana_test`. Переставить trim/remove-prefix, закрепить browser payload.                                                                   |
| Низкий    | `navigation-state.ts` priorUrl записывается/очищается, но не читается; CatalogStore featured не используется; app/home-preview отдельные DI side effects                                       | Удалять только после rg по всему проекту; зависимости с side effect явно обозначить.                                                                                                                         |
| Низкий    | `photo-flight.ts`, `navigation-state.ts`, intro/gallery: важные комментарии на английском или отсутствуют                                                                                      | Короткие русские объяснения сохранения DOM/scroll/focus, временной копии и отмены callback; без комментариев очевидных операций.                                                                             |

## Поэтапный план и проверки

1. Зафиксировать аудит, перенести отчёт форм, исправить его Markdown. Сверить происхождение параллельных исправлений.
2. Читаемость: external HTML/SCSS, Prettier/config/scripts, форматирование TS/HTML/SCSS. Build/unit; собрать исходные browser geometry/style measurements без медиа.
3. Стили: foundations/shared/global motion и scoped стили app/home/catalog/card/dialog/admin. Сохранить media order и `!important` там, где он необходим; отсутствие универсального redesign. Build + сравнение CSS/geometry, public UI/intro/галерея.
4. Admin: API-грань, типы/маппинг/schema форм, upload lifecycle. Проверить ошибки, снятие busy/disabled, повтор, current updated_at, reset и контакты на mock Supabase.
5. Public: mapping/API, contact state, modal environment/gallery motion/message; комментарии и проверенное удаление мёртвого кода. Проверить route reuse, scroll/focus, отмену/быстрые действия.
6. Финал: production build/unit и browser forms/catalog API/routing/public UI/dialog-position/motion/intro/SEO, pageerror и hydration console. Не повторять уже достаточные проверки без новых изменений. Зафиксировать результаты и границы.

## Ограничения и архитектурные решения

Angular и зависимости остаются прежними; SCSS уже поддержан build pipeline. Emulated encapsulation по умолчанию; body/early intro cover, reduced motion и общие utility остаются глобальными. PhotoFlight создаёт div в document.body, поэтому его styles не должны зависеть от scoped атрибутов компонента; геометрия по-прежнему вычисляется в TS.

Не вводятся NgRx, generic repositories/base components или UI service для каждого простого метода. Guard/auth, query predicates/updated_at, публикация и Storage policies сохраняются. Крупные классы разделяются по реальным жизненным циклам, не по количеству строк.

Результаты этапов, локальные коммиты и остаточные ограничения добавляются ниже после выполнения.

## Выполненные этапы

- `d95ffcf`: аудит/план, перенос отчёта форм с читаемой Markdown-таблицей, конфигурация форматирования.
- `d0dd895`: external HTML для login/card/errors/not-found, отдельные SCSS, Angular CLI defaults для новых SCSS-компонентов, читабельные TS/HTML/SCSS.
- `f100cbf`: global foundations/shared/reduced-motion и Emulated SCSS компонентов. Селекторы разных владельцев разделены; mobile overrides сохранены в исходном порядке. Без ViewEncapsulation.None, ::ng-deep и повышения style budgets.
- `2c4f09c`: typed Supabase client, конкретный AdminCatalogApi, схемы/маппинг форм и отдельный scoped lifecycle фото. Snapshot стал типизированным сигналом вместо JSON.parse; успешный save принимает серверную запись. Старая фотография удаляется после записи photos; сбой очистки не отменяет уже успешное сохранение.
- `e95ecda`: PublicCatalogApi, чистые product-mapping/product-presentation, общий contact state в store; удалены неиспользуемые featured/priorUrl. Store больше не зависит от CSS-класса открытого диалога. Сквозные контракты, публикация и порядок сохранены.
- `720eef4`: ProductDialog сокращён до 98 строк; modal environment (66), gallery motion (182) и order message (96) имеют самостоятельные lifecycles. Cleanup подписок/таймеров, короткие русские комментарии, strict TS/noUnused/Angular templates. AdminPanel после форматирования и разделения — 283 строки вместо 480; число строк не было критерием само по себе.

После возобновления сессии каталоги в /tmp исчезли. Коммиты сохранились; последние незакоммиченные изменения восстановлены из выполненного этапа, остальные сессии не изменялись. Постоянный worktree: `/media/aozaki/ssd2/projects/cre249-refactor`, ветка `refactor/angular-maintainability`. Main не изменялся. Оригинальные Signal Forms 2663efb/f1aef5c присутствуют как cherry-pick c216476/9105ec2. Интро/каталог b1e2e55 уже в базе через 9257139; дополнительная интеграция с известным коммитом не нужна. Любые новые незавершённые изменения другой сессии остаются за пределами этой ветки.

## Текущая структура

| Обязанность                   | Основные файлы                                                                                                                   |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| Shell, lazy routes, public UI | `app.*`, `app.routes.ts`, `home.*`, `catalog.*`, `product-card.*`                                                                |
| State и Supabase              | `catalog-store.ts`, `public-catalog-api.ts`, `admin-catalog-api.ts`, `catalog-photos.ts`, `supabase.ts`, `database.types.ts`     |
| Преобразование и presentation | `product-mapping.ts`, `product-presentation.ts`, `data.ts`                                                                       |
| Admin и формы                 | `admin-panel.*`, `admin-forms.ts`, `admin-photos.ts`, `admin-login.*`, `admin-auth.ts`, `admin-guards.ts`, `field-errors.*`      |
| Изделие/сообщение/галерея     | `product-dialog.*`, `product-dialog-environment.ts`, `product-gallery-motion.ts`, `order-message.*`                              |
| Navigation и движение         | `catalog-route-reuse.ts`, `navigation-state.ts`, `photo-frame.ts`, `photo-flight.ts`, `home-intro-state.ts`, `home-intro.*`      |
| Стили                         | `src/styles.scss`, `src/styles/_foundations.scss`, `_shared.scss`, `_motion.scss`; scoped SCSS рядом с компонентами              |
| Static/SEO                    | `main.server.ts`, `seo.ts`, `scripts/prepare-static.mjs`, `finalize-static.mjs`, неизменённые `public` verification/robots файлы |

Компоненты без собственных стилевых правил (`field-errors`, `not-found`) используют общий CSS; пустые SCSS не добавлялись. PhotoFlight по-прежнему создаёт body-элемент с inline геометрией, не зависящий от scoped стилей. Объединены подтверждённые unconditional CSS-дубликаты about-photo и dialog-photo picture; h1/h2 с идентичными свойствами объединены без изменения responsive каскада.

## Итоговая проверка

Node 22.22.3, pnpm 12.8.1, Angular 22.2.1, production build, Chromium/Playwright 1.63.0 headless. Preview `http://127.0.0.1:8458/` обслуживает output без SPA fallback. API/browser записи и auth/session подменяются; build читает опубликованный каталог. Медиа не записывается.

| Команда (browser: BASE_URL=http://127.0.0.1:8458/) | Результат                                                                                                                                                                                                     |
| :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm build`                                       | Успех; 23 prerender маршрута, admin shells и sitemap; initial raw bundle 489.16 kB на проверенной сборке.                                                                                                     |
| `pnpm test --watch=false`                          | 2 файла, 7 тестов, pass.                                                                                                                                                                                      |
| `pnpm format:check`                                | Все TS/HTML/SCSS в src соответствуют Prettier.                                                                                                                                                                |
| `pnpm test:admin-form`                             | Validation, login/settings/product error/retry, duplicate submit, edit/new/reset/dirty guard, hidden product, photo focus, current updated_at, JPEG upload error/retry/unlock — pass.                         |
| `pnpm test:order-form`                             | Generated/custom message, filling, invalid input, WhatsApp encoding, clipboard error/retry на 390/1440 — pass.                                                                                                |
| `pnpm test:catalog-api`                            | Empty/error/published query/hidden direct URL и unknown login без password endpoint — pass.                                                                                                                   |
| `node tests/style-geometry-check.mjs`              | Computed CSS и geometry 144 элементов 390/1440 совпадают, допуск <1px. Baseline в ignored `.tmp-refactor/styles-baseline.json`; до переноса CSS также было подтверждено совпадение с исходной миграцией форм. |
| `CATALOG_SNAPSHOT=1 pnpm test:public-ui`           | 360/390/768/1440, typography, gallery continuity, порядок, 200% text, reduced viewport, keyboard/focus/scroll/message/clipboard — pass.                                                                       |
| `CATALOG_SNAPSHOT=1 pnpm test:motion`              | 390/1440: crop при входе/выходе, interrupted flight, повторное закрытие, Back/scroll/focus — pass.                                                                                                            |
| `pnpm test:bootstrap`                              | 390/1440, public/admin routes и anonymous guard; no pageerror или console Angular/hydration error diagnostics — pass.                                                                                         |
| `CATALOG_SNAPSHOT=1 pnpm test:routing`             | 23 HTTP документа, reload/legacy/guard/dialog history/focus/scroll/fillings/WhatsApp/intro — pass.                                                                                                            |
| `CATALOG_SNAPSHOT=1 pnpm test:dialog-position`     | Mobile/desktop, normal/reduced motion: scrollY и рамки каталога сохраняются, deviations 0.                                                                                                                    |
| `CATALOG_SNAPSHOT=1 pnpm test:intro`               | First visit/reload/internal return, reduced motion, failsafe, JS disabled, cover до Angular и handoff, stalled/failed boot — pass.                                                                            |
| `pnpm test:seo`                                    | 23 public HTML, unique title/description, canonical, robots, index/noindex, sitemap — pass.                                                                                                                   |

TypeScript strict/noUnused и Angular strictTemplates проходят production/unit compilation. Production stylesheet warning остаётся: `product-dialog.scss` 4.06 kB, на 60 байт выше warning budget 4 kB. Это результат локализации уже существовавших стилей; error budget 8 kB не превышен. Порог не повышен, геометрия не изменена ради экономии байтов. Исправление не требует нового architectural слоя.

## Границы и остаточные вопросы

- `provideClientHydration` в appConfig отсутствует. Проверены фактические prerender→bootstrap и Angular console diagnostics; полноценная hydration не включалась и не объявляется проверенной. При её отдельном внедрении нужен новый набор consistency проверок.
- Real auth/Supabase writes/Storage/WhatsApp send не выполнялись. RLS/migrations и public verification файлы имеют нулевой diff относительно main. Код private Storage lifecycle и его mock сценарии не доказывают реальных серверных прав доступа.
- Firefox, Safari и screen readers не проверялись. Geometry/CSS measurements и browser assertions не являются полной визуальной/WCAG оценкой.
- Database типы описывают используемый контракт таблиц из локальной SQL-миграции; при изменении схемы их нужно синхронизировать. Внедрение автоматической генерации типов не требуется для текущего scope.
- Удаление файлов при отказе от несохранённых изменений остаётся best effort, как до рефакторинга: при сетевом отказе в private Storage возможны неиспользуемые файлы. Универсальная очередь очистки не добавлена; это отдельная операционная задача.
- Архитектурных этапов плана, требующих интеграции известного b1e2e55, не осталось. Для новых изменений параллельной сессии потребуется обычное сравнение после её фиксации.

Никаких скриншотов, видео, push, merge в main, публикации или отправки сообщений.
