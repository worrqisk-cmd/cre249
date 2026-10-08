# Автоматическое обновление каталога на GitHub Pages

## Проверенное состояние и ограничения

08.10.2026 официальный Supabase MCP, ограниченный `project_ref=bvlcyhcuneaphuletnqz&read_only=true`, подтвердил URL проекта milana, таблицы products/categories/site_settings с RLS, публичные фильтры published/is_public и owner-only запись. Из функций public есть set_catalog_updated_at, BEFORE UPDATE triggers products_updated_at и site_settings_updated_at. Edge Functions отсутствуют. Vault 0.3.1 установлен; pg_net 0.20.4 и pg_cron 1.6.4 доступны для установки, но не установлены. Секреты не читались. Это наблюдение, не применение миграций.

Angular 22.2.1 остаётся без обновлений; static prerender без hydration. Существующий Pages workflow собирает и проверяет main, concurrency `pages-${{ github.ref }}`, cancel-in-progress=false сохранены. Добавлены независимые проверки очереди/Edge Function, проверка пустого каталога и браузерного fallback. Deployment зависит от успешных существующих и новых проверок.

Официальные ограничения:

- [Supabase schedule](https://supabase.com/docs/guides/functions/schedule-functions): pg_cron + pg_net и Vault поддерживают периодический вызов Edge Function.
- [Database Webhooks](https://supabase.com/docs/guides/database/webhooks): асинхронный вызов после транзакции не заменяет долговечную очередь и гарантированные повторы.
- [Edge limits](https://supabase.com/docs/guides/functions/limits): время/CPU ограничены; функция не спит ради debounce и не ждёт завершения GitHub build.
- [GitHub dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event): Actions:write, ref=main; API 2026-03-10 возвращает workflow_run_id в ответе HTTP 200.
- [Concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency): новый pending run может вытеснить прежний даже при cancel-in-progress=false. Очередь проверяет conclusion и повторяет отменённый запуск.

## Механизм

Database trigger фильтрует события и атомарно увеличивает requested revision. INSERT/DELETE опубликованных товаров, публикация/скрытие и содержательные изменения публичного товара учитываются, включая фотографии, цену, описание, slug, порядок, featured, доступность. Любые изменения скрытого черновика игнорируются. Обновление только updated_at/created_at игнорируется. Публичные категории и настройки тоже учитываются. Загрузка файла в Storage до сохранения products не меняет страницы и не запускает сборку.

Database Webhook реализован SQL AFTER UPDATE trigger на агрегированной очереди через pg_net: передаётся только tick, без содержимого строк. Отдельный одноимённый webhook в Dashboard создавать НЕ нужно: иначе будут дубли. Cron раз в минуту пробуждает функцию только при наличии незавершённых изменений/активного запуска. Потеря первого HTTP-вызова не теряет событие.

Две минуты тишины объединяют сохранения; при непрерывных изменениях ожидание ограничено десятью минутами. Под блокировкой строки выдаётся одна аренда dispatch на пять минут. Функция вызывает только pages.yml в main фиксированного репозитория worrqisk-cmd/cre249, сохраняет run_id и далее опрашивает workflow. Успех подтверждается только completed/success и jobs.deploy/success. События во время сборки остаются dirty и вызывают завершающую сборку. Ошибка snapshot при изменениях во время подготовки также приводит к повтору.

Ошибка dispatch сохраняется в state.last_error и attempts.error. Отказ API/провал/отмена workflow повторяются с паузами 1, 2, 4, 8… максимум 60 минут без удаления события. При timeout/сбое до attach нельзя достоверно узнать, принял ли GitHub запрос: по истечении аренды следует повтор; возможно лишнее выполнение (at-least-once). Сохранённый run_id при временной ошибке poll не сбрасывается. HTTP 404 для исчезнувшего run вызывает повтор. Запуск, навсегда оставленный GitHub в queued/waiting/in_progress, требует оператора: его нельзя безопасно считать проваленным только по времени. Очередь не обещает exactly-once.

## Живые данные и старые страницы

Кэш и Realtime не менялись. Новый визит после bootstrap читает опубликованные товары Supabase; существующая вкладка сохраняет прежнюю политику восьмиминутного memory cache с отложенным refresh на странице изделия. Успешное сохранение админки обновляет её собственный store.

До нового deploy URL нового товара получает **HTTP 404** от Pages, но 404.html содержит Angular shell с baseHref=/, и клиент загружает опубликованный товар. Обновление URL тоже работает с HTTP 404. Это не HTTP 200 и не полноценная индексируемая страница: shell и клиент сохраняют noindex; настоящие prerender HTML и sitemap появляются после успешного deploy.

После скрытия/удаления товара старый HTML и sitemap остаются опубликованы **до замены Pages artifact**. Свежий клиент показывает недоступность, однако исходный HTML всё ещё содержит прежние сведения и HTTP 200. Нормальное окно: 2–3 минуты debounce + ожидание concurrency + build/checks/deploy + распространение CDN. При непрерывных сохранениях debounce до 10–11 минут. Фиксированной верхней границы нет: ошибки сборки, истёкший токен, недоступность Supabase/GitHub или ожидание workflow могут продлить окно. После deploy дополнительно остаются CDN/браузерные/поисковые кэши; удаление сторонних копий не гарантируется. Это не механизм срочного удаления конфиденциальных данных. Уже лежащие в public/photos исходные фото не удаляются автоматически.

Пустой публичный каталог теперь допустим при точном count=0; усечённый ответ по-прежнему останавливает сборку. Это необходимо для скрытия последнего товара. Удаление всех site_settings или публичной категории, на которую ссылается опубликованный товар, остаётся ошибкой целостности: исправить данные владельцем, затем повторить сборку.

## Подключение — только после отдельного разрешения на remote changes

1. Провести обычный PR/CI/merge этой ветки в main и дождаться Pages deploy с новым workflow и fallback. Сейчас push/merge/deploy НЕ выполнены.
2. В GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens создать токен только для worrqisk-cmd/cre249 с Repository permissions **Actions: Read and write**, без Contents write, Administration и широкого classic repo. Metadata read добавляется GitHub автоматически. Установить срок действия и напоминание о замене. Actions write шире отдельного dispatch, но это минимальное право этого endpoint. Не помещать токен в браузер, site-config, Git или чат.
3. Создать случайный общий секрет не короче 32 символов (например, `openssl rand -hex 32` в своём терминале). Через Supabase Dashboard → Edge Functions → Secrets сохранить `CATALOG_GITHUB_TOKEN` и `CATALOG_WEBHOOK_SECRET`. SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY предоставляет runtime; их не копировать в frontend.
4. В Dashboard → Vault добавить secret с именем `catalog_sync_webhook_secret`, значением точно того же CATALOG_WEBHOOK_SECRET. Не выводить decrypted_secrets в отчётах/чат. GitHub-токен в Vault не нужен.
5. Если Supabase CLI не установлен, команды можно выполнить через pnpm dlx (без изменения зависимостей проекта). Авторизоваться своим аккаунтом и выполнить из этой папки:
   ```sh
   pnpm dlx supabase login
   pnpm dlx supabase functions deploy catalog-static-sync --project-ref bvlcyhcuneaphuletnqz --no-verify-jwt
   ```
   config.toml отключает JWT только для этой функции; POST требует x-catalog-sync-secret, GET и посторонний POST отклоняются. Не включать CORS/вызовы из админки. Вызов без секрета должен дать 401; GET — 405. Не вставлять secret в команды, сохраняемые в истории; для пробного POST использовать локальный защищённый curl config либо Dashboard.
6. Проверить историю миграций и применить **только два новых файла** в указанном порядке через SQL Editor, каждый целиком в транзакции BEGIN/COMMIT: `20261008120000_catalog_static_sync.sql`, затем `20261008121000_catalog_static_sync_wakeup.sql`. Не выполнять слепой db push всех исторических файлов: исходная схема уже существует. Второй файл устанавливает pg_net/pg_cron и минутное задание; enabled=false предотвращает сетевые вызовы до включения. Эти операции меняют удалённую конфигурацию и сейчас не выполнялись.
7. Проверить extensions, cron.job, функции, privileges и единственный queue webhook trigger. В SQL Editor под postgres выполнить `select public.catalog_sync_enable(true);`. Включение само ставит первую сборку в очередь — тестовые товары не нужны.
8. Проверить состояние и журнал без секретов:
   ```sql
   select enabled,requested,deployed,attempt,revision,run_id,failures,retry_at,last_error
   from public.catalog_sync_state;
   select * from public.catalog_sync_attempts order by started_at desc limit 20;
   select jobid,status,return_message,start_time,end_time
   from cron.job_run_details order by start_time desc limit 20;
   ```
   После успешного deploy дождаться requested=deployed, attempt IS NULL; проверить sitemap и HTTP 200 существующих публичных URL. Сверить run_id с GitHub Actions, логи функции и при проблемах pg_net response logs (они временные, не долговечный журнал). Не читать http_request_queue с auth headers для отчётов.
9. Повторы автоматические. После исправления токена/ошибки можно ускорить следующую попытку под postgres: `update public.catalog_sync_state set retry_at=now() where id and attempt is null; select public.catalog_sync_wake();`. Для зависшего run сначала отменить его в GitHub и дождаться фиксации failure. Не подтверждать deployed вручную.
10. Пауза: `select public.catalog_sync_enable(false);` — перестаёт создавать новые вызовы, но уже запущенный workflow не отменяется. События сохраняются; повторное true ставит актуальную сборку. Для полного отключения отдельно отключить Cron и отменить активные workflow; frontend fallback остаётся.

## Локальные проверки и границы

`deno test supabase/functions/catalog-static-sync/worker_test.ts`; `deno check .../index.ts`; `node scripts/test-catalog-sync-db.mjs` на одноразовом Docker PostgreSQL 17; `pnpm test:static-empty`; `pnpm test --watch=false`; production `pnpm build`, `pnpm test:seo`, `pnpm test:routing`, `pnpm test:catalog-api`, `pnpm test:catalog-fallback`.

SQL-тесты проверяют реальные транзакции/функции core migration, RLS privileges и SQL wiring с локальными doubles net/cron/Vault (включая отказ без секрета и адрес/headers/body webhook). Реальные расширения pg_net/pg_cron не запускались в hosted Supabase. GitHub HTTP в Edge unit tests подменён; реальный dispatch/deploy специально не запускался. После разрешённого подключения нужен один начальный end-to-end run без изменения товаров. Дальнейшие миграции схемы должны учитывать фильтрацию trigger и статический snapshot. Журнал attempts пока без автоматической чистки: при редких сохранениях рост мал; чистить по согласованному сроку хранения позже, не теряя активные попытки.
