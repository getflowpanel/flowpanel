# Первый цикл качества: что изменено и чем подтверждено

Дата: 2026-09-08. Связанный документ: [план качества](2026-09-08-developer-experience-quality-plan.md).

Это завершённые изменения первого цикла и оставшиеся проверки. Полная программа A–D и переработка FreelanceRadar ещё не выполнены. Изменения FlowPanel находятся в рабочем дереве; пакеты не опубликованы, зависимости FreelanceRadar не переключены. После входа пользователя отдельный UI fix FreelanceRadar применён к его текущей admin-ветке и проверен в браузере (см. ниже).

## Реализовано в FlowPanel

| Сценарий | Новое поведение | Доказательство |
| --- | --- | --- |
| Занятый `/admin`, включая route groups | `init` находит конфликт и выбирает свободный `/flowpanel`; `--path` задаёт явный статический mount. Config, page import и итоговый URL согласованы | `admin-path.test.ts`, `init-mount.test.ts`; отдельный собранный Next consumer |
| Опасный или неоднозначный mount | Private/dynamic/catch-all пересечения и overlap с генерируемым API учитываются до записи. Dynamic config требует явного пути | Negative fixtures; `doctor-mount.test.ts` |
| FSD/barrel imports | DB/schema `index.ts`, локальные aliases и цепочки реэкспортов проверяются без исполнения host config; отсутствующий named export блокирует init | `module-path.test.ts`, generated FSD config + `tsc --noEmit` |
| Существующий root layout | CSS import помещается в layout admin segment; root layout не переписывается | Byte equality в integration fixture |
| Неизвестный auth hook | Генерируется `getSession`, возвращающий `null`. Открытая development identity требует `--dev-auth` | Выполнение сгенерированного closed helper через jiti |
| Async role | Promise ожидается до requireRole и adapter access; ошибка provider не продолжает запрос | `request-runtime.test.ts` |
| Detail tabs | Сервер выполняет только выбранный разрешённый tab; неактивный renderer не запрашивает данные. URL использует `?tab=`, переход добавляется в history | 4 новых table-driven regression cases; браузерный Back для detail пока отдельно не проверен |
| CSP | `ThemeScript` передаёт nonce host | React regression test; server-safe raw-script export добавлен; проверен отдельно ниже |
| DB diagnostics | Показывается цепочка cause при установленном DATABASE_URL; credentials в connection URL и parameter dumps редактируются | `fail.test.ts`, включая credential canary |
| `doctor --fix` | Использует фактический статический mount, в том числе decomposed config, и не создаёт конфликтующий admin route | 11 focused doctor tests |
| Локализованный поиск | Страница списка применяет существующий `labels.searchPlaceholder` вместо hardcoded English | Браузерный дефект в host; red/green regression, 9 focused tests + Next typecheck. Проверены отсутствующая настройка, explicit undefined из JS, русский шаблон и intentional empty string; scoped review PASS |

Обновлены CLI README, страницы quickstart/project structure/styling/CLI/troubleshooting и changeset. Два исходных документа пользователя оставлены без изменений; для них и новых quality-документов добавлены узкие исключения из `/docs/` в `.gitignore`.

## Проверки

- CLI: **275 tests passed**, 28 files. На старте было 241.
- Next: **752 tests passed**. В полном workspace `test:unit` — **13 успешных задач из 13**.
- Полный workspace `typecheck` прошёл; после последних изменений resolver повторный CLI typecheck прошёл.
- `pnpm lint` прошёл; docs: **49 canonical pages и snippets** проверены.
- CLI build и установка его tarball в новый npm-проект с проверкой команд прошли.
- `publint --strict` прошёл для CLI, core, next и react. Новый CI workflow прошёл синтаксический YAML parse; `node --check` проверил smoke script.
- Import boundaries прошли. Размер `doctor.ts` уменьшен выделением template manifest; focused doctor tests после выделения прошли.
- Независимый reviewer проверил изменения. Найденные corner cases с legacy `basePath`, named config re-export, export-star/alias barrels и API collision воспроизведены тестами и исправлены; scoped re-review — PASS.

Один ранний полный unit run совпал с очисткой `dist` другой нашей сборкой и получил ошибки отсутствующих chunks. После завершения сборки последовательный полный повтор прошёл. Это не основание скрывать failure или менять assertions; проверки, которые собирают общие пакеты, нужно запускать последовательно.

Публичные type-tests прошли отдельной командой `pnpm --filter './packages/*' --filter '!@flowpanel/e2e' -r test:types` (core, оба DB adapters, react, next). Корневой `pnpm test:types` был остановлен: через Turbo он дополнительно начал production build всех examples/site. Этот корневой запуск не считается прошедшим.

## Реальная установка вне workspace

Проверка `scripts/check-next-onboarding.mjs` создаёт временный consumer, устанавливает tarballs всех FlowPanel-пакетов через npm или pnpm и запускает настоящий Next. Она использует Next **16.3.1**, React **19.2.0**, Drizzle **0.45.2**, Tailwind **4.3.0**, Node **22.23.2** при локальной проверке.

Сценарий содержит FSD DB/schema barrels и существующий `src/app/(dashboard)/admin/page.tsx`. Development auth включается явно только для изолированного fixture. Ресурсы пустые, подключения к БД FreelanceRadar или чтения её credentials нет.

В отдельных npm и pnpm consumers подтверждены install, generated TypeScript, отсутствие изменений при повторном init и открытие `/flowpanel` в браузере: видны shell, стили и «FlowPanel is mounted and working». В pnpm consumer также открыт сохранённый `/admin` с исходным heading. Это проверка первого mount; она не доказывает CRUD, миграции, Prisma, CSS isolation на всех host routes или все supported Next versions.

Ранние автоматические прогоны не были полностью зелёными: npm install превысил лимит времени и был завершён повтором из его временного cache; второй pnpm consumer прошёл install/TypeScript и HTTP `/` + `/admin`, но компиляция `/flowpanel` превысила timeout. При последующей отдельной браузерной проверке обе установки открылись. Скрипт теперь ограничивает также принудительную остановку сервера и печатает server log при ошибке. Тайм-аут нельзя считать успехом или подменять им результат всего сценария.

Команда для повторения: `pnpm check:next-onboarding npm` или `pnpm check:next-onboarding pnpm` после сборки пакетов. В CI добавлена отдельная npm/pnpm matrix после build и включена в обязательный aggregate gate. Сам GitHub Actions workflow из этой сессии не запускался.

**Финальный полный `pnpm check:next-onboarding pnpm` — PASS, exit 0:** dry-run, init, повторный init, TypeScript, HTTP `/`, `/admin`, `/flowpanel` и остановка Next. Лог: `/tmp/flowpanel-next-final.log`. После исправления lifecycle smoke script также прошёл scoped independent review.

Для npm подтверждены установка после resume, dry-run/init/repeat, TypeScript и браузерный render. Финальный полный автоматический npm-прогон после изменения тайм-аутов отдельно не повторялся; это остаётся различием между проверенными результатами, даже при успешном ручном browser smoke.

## FreelanceRadar: проверенные исправления после входа

Выполнен TASK-612: `PlatformGrid` формирует encoded `f_platform`; `LiveStatus` сообщает состояние realtime-соединения, число событий и срок следующего запроса обновления. SSE не сбрасывает таймер запроса, `router.refresh()` не называется успешным получением данных. Hidden-tab polling остаётся приостановленным.

Изолированный task commit `49d45a34` прошёл независимый review и применён в существующую `feat/new-admin` отдельным коммитом **`247e841a`**, поверх `10428d7a`. Изменены только два компонента и два DOM test files. Чужой untracked документ сохранён. `dev`, remote и deployment не затронуты.

Приёмка:

- RED в реальном браузере: плитка Kwork открывала `?platform=kwork`, выбранное значение оставалось Any, строки содержали несколько площадок.
- GREEN после применения: тот же клик открывает `/new-admin/scraper_run?f_platform=kwork`; DOM содержит выбранный `kwork`, все видимые значения «Биржа» — `Kwork`. Screenshot показан в текущей сессии.
- На экране «Система» виден новый русский текст о соединении и следующем запросе; прежнего «обновлено N с назад» нет.
- 3 focused DOM tests, type-check, lint, workflow validate/eval и 42 hook tests — PASS. Visibility probe проверяет ноль refresh в hidden-состоянии и возобновление countdown/refresh после visible. Тест на SSE проверяет сохранение deadline.
- Standard-change: frontend implementer Terra/medium, независимый reviewer Terra/high; 2 review invocations, 1 fix round. Первый FAIL касался отсутствия visibility runtime evidence; после теста — PASS. Root выполнил browser QA. Токены и стоимость не измерялись.

Это не редизайн всей админки. Во время read-only проверки не запускались seed, миграции, parser actions, изменения пользователей или production DB scripts. Финансовая популяция, Telegram-воронка, лимиты историй, заголовки, единый язык и тема остаются в плане. Исправление локализованного поиска FlowPanel ещё не установлено в host.

## Что остаётся обязательным

1. Продолжить A: полный project scan, custom API collisions, env parity, совместимость версий, полная изоляция/prebuilt CSS и provider recipes. Inherited tsconfig и server-safe theme builder реализованы ниже.
2. Закрыть B: раздельные list/detail projections с сохранением permissions, related pagination, формы/diagnostics, реальный browser Back/Forward и loading/error states.
3. Реализовать нужные C/D после проверки usages: локализация, форматтеры, links, widgets, freshness, transport lifecycle и upgrade matrix.
4. Во FreelanceRadar сначала проверить isolated seed и correctness метрик, затем переносить framework fixes и UX по плану. Исходные host-дефекты перечислены в разделе 1 плана с файлами.
5. Расширить уже начатый browser audit host: desktop/mobile, Back/Forward, формы на изолированных данных, errors/loading и доступность. После входа пользователя read-only проверены обзор, система, фильтр прогонов, список и карточка существующего синтетического пользователя, пустая вкладка уведомлений. Начальная блокировка авторизацией снята.

Не считать снижение LOC, green unit subset или красивый mockup достаточным условием «10/10». Итогом должен быть воспроизводимый пользовательский сценарий от установки до работы с корректными данными.

## Продолжение без участия пользователя

В рабочем дереве FlowPanel дополнительно реализованы и проходят проверку:

- `detail.header` используется как содержимое h1 и получает только авторизованную проекцию. Редактирование скрывается по async update policy/disabled, текст задаёт `labels.actions.edit`. 19 detail regression tests и 4 PageHeader DOM tests прошли; независимый review PASS. Публичный `PageHeaderProps.title` допускает React content, изменение отражено в docs и minor changeset.
- TypeScript JSONC/extends разбирается штатным TS parser без исполнения/перечисления исходников. Унаследованные paths/baseUrl, npm bases, порядок нескольких bases, missing/cyclic configs проверены; full CLI до дополнительного migration case: 279 PASS. Review нашёл wildcard-root ошибку Jiti: воспроизведена реальным import, исправлена, 7 migration tests и scoped review PASS.
- Pure `buildThemeInitScript` добавлен в серверный core/kit API, прежний React export сохранён. Storage failure не отменяет выбор темы, произвольный runtime mode не попадает в script body. 4 core runtime probes прошли; публичные core type-tests и React callers прошли. Host по-прежнему отвечает за CSP/nonce.

Автоматическая проверка отклонила экспорт спецификации финансовой аналитики в Linear. Повторной отправки или обхода этого отказа нет. Для независимого продолжения создан локальный контракт `docs/plans/2026-09-08-admin-analytics-quality.md` в отдельной ветке FreelanceRadar `codex/admin-analytics-quality`, база `247e841a`. TASK-id не выдумывается; локальный workflow сохраняет одного исполнителя и независимый review перед интеграцией. Разрешение на внешний экспорт запрошено отдельно и не является условием локальной разработки.


### Проверка границы server/client в установленном пакете

Первый повтор packed Next выявил реальный дефект, пропущенный unit/type-tests и первым review: React импортировал pure helper через корневой core barrel, и browser compilation падала на Node `async_hooks`. Исправление: отдельный import-free entry `@flowpanel/core/theme` (ESM/CJS/types), React импортирует именно его. Import-boundary guard запрещает runtime import/re-export core barrel из React production source. Scoped source/package review PASS; runtime затем подтверждён отдельно.

Полный повтор `pnpm check:next-onboarding pnpm` после исправления: **PASS, exit 0**, включая install, dry-run/init/repeat, TypeScript, HTTP трёх маршрутов и остановку Next. Лог `/tmp/flowpanel-quality-onboarding-boundary.log`. Core subpath tsd PASS; docs ownership включает source и built declaration, docs/snippets PASS.

В этом же установленном временном consumer отдельный read-only fixture с синтетической строкой в памяти прошёл `tsc --noEmit` и browser check: h1 «Анна Тестовая»; кнопки Edit/Редактировать нет при async update=false; `data-flowpanel-theme=dark` от server helper; клик «События» меняет URL на `?tab=activity`, видимый panel содержит только `ACTIVITY_TAB_VISIBLE`. DB adapter introspection использует локальную схему, list/get возвращают память; к реальной БД этот fixture не обращается. Browser Back/Forward и enforcement настоящей CSP этим наблюдением не доказаны.


### FreelanceRadar: корректность аналитики

Изолированный commit `551eb312` после свежего независимого Sol/high review PASS применён к текущей `feat/new-admin` как **`96b02851`**. REAL population используется в revenue/revenuePrev и all-time unique payers; Telegram acted коррелирует user/order и первый просмотр после или в момент доставки. Единицы платежей и half-open periods сохранены.

RED на отдельной PostgreSQL: старые revenue/revenuePrev/payers = `1000/800/4`, ожидается `600/100/3`; старый acted = `4`, ожидается `1`. GREEN: 2 contract files / 3 tests; свежий reviewer повторил их на новых PostgreSQL/Redis containers, 3 PASS, teardown завершён. Также прошли admin unit tests (5), type-check, lint и workflow gates. High-risk route: Terra/high implementer, Sol/high reviewer, 1 review invocation / 0 fix rounds. Стоимость и токены не измерялись.

Read-only browser GREEN на `/new-admin`: обзор открывается, Telegram шаг подписан «Впервые открыли доставленный заказ», ограничение первого записанного просмотра видно рядом. Синтетические значения контрактов не подменяют реальные dashboard values. Host migrations/seeds/actions не запускались; пользовательский untracked документ сохранён.


### Итоговые проверки перед фиксацией FlowPanel

- Полный npm packed Next smoke после всех исправлений: **PASS, exit 0**, install/dry-run/init/repeat/TypeScript/host routes/FlowPanel render/shutdown; `/tmp/flowpanel-quality-npm-final.log`. Прежнее различие между итоговым npm и pnpm прогоном снято.
- Повтор всех unit tasks после выделения browser-safe entry: **13/13 PASS**; CLI 280, Next 762, core 205, React 449 tests. `/tmp/flowpanel-quality-unit-post-boundary.log`.
- `lint`, docs/snippets, core public tsd, strict core publint и release consistency PASS. Release gate сначала нашёл неверный порядок нового script key; исправлен только порядок, повтор PASS.

Перед локальным переносом проверена база версии: tag `@flowpanel/core@0.2.0` (`f71cd4a7ba2ca8140c693b33a36922178fc77c91`) и checkout HEAD `2804944` не отличаются package source/build configs, только release metadata. Это позволяет проверить приватные prerelease tarballs поверх host 0.2.0 без предположения, что меньший номер checkout означает старый код. CLI должен пересобираться с prerelease metadata: версия встроена в JS, простого переименования tarball недостаточно.


### Единый вход FreelanceRadar

UI commit `3e9c5ad7` после независимого Terra/high PASS применён в текущую admin-ветку как **`16902cca`**. `/admin` перенаправляет в `/new-admin`; старый мониторинг доступен в меню аккаунта по `/admin/monitor`. Desktop/mobile вход называется «Админка», роль и прежний guard сохранены. Accent согласован с host lime в light/dark.

RED/GREEN: 7 файлов / 14 tests; type-check, lint, workflow validate/eval/hooks PASS. Reviewer повторил 14 tests, cost/scoring/layout guard byte-unchanged. Browser GREEN: `/admin` открыл `/new-admin` с h1 «Обзор»; клик «Расширенный мониторинг» открыл `/admin/monitor` с h1 «Система» и активными «Админка» links; `/admin/cost` и `/admin/scoring/feedback` открылись с прежними heading. Это переход совместимости, mount ещё называется `/new-admin`.

### Фиксированный источник локального обновления

Foundation FlowPanel зафиксирован как **`ebb82ab`** в `codex/developer-experience-quality`; packages не опубликованы. `scripts/pack-preview.mjs` строит отдельные prerelease tarballs из указанного Git commit, а не из изменяемого working tree. Перед запуском нужны установленные внешние build dependencies выбранного lockfile (`pnpm install --frozen-lockfile`); внутренние зависимости и все сборки направляются в отдельный staged checkout. CLI пересобирается с новой metadata, проверяется его `--version`.

Команда проверена дважды: `node scripts/pack-preview.mjs 0.2.1-quality.20260908.ebb82ab /tmp/flowpanel-preview-ebb82ab-verified ebb82ab` (каждому повтору нужна новая output directory). 11 packages build/pack PASS, manifest содержит commit, hash исходного archive, builder/lockfile hashes, toolchain и SHA-256 каждого tarball. Каталог назначения не перезаписывается; исходный checkout и registry не изменяются.

Два повтора дали одинаковые hashes у 10/11 tarballs. React build меняет порядок imports/chunk names и union members деклараций; **побайтовая воспроизводимость пересборки не заявляется**. Воспроизводимая установка должна использовать сохранённые immutable tarballs и lockfile, а не заново строить файл с тем же именем. Локальные previews предназначены для проверки интеграции до обычного release-процесса.

### Реальный host выявил ложные ошибки doctor

В изолированной FreelanceRadar worktree preview установился и отрендерился в production standalone на 3558: `/admin` → `/new-admin`, русский поиск, h1 `E2E Test User`, «Редактировать», Back/Forward между вкладками одной карточки и reload deep link — GREEN. Desktop 1280 px без горизонтального overflow, тема dark, console errors отсутствуют. Anonymous list/detail API возвращают 403. CSP header содержит nonce и strict-dynamic; enforcement отдельно не утверждается.

Однако установленный doctor завершился exit 1: ошибочно счёл `[locale]/(marketing)/page` и `@modal/(.)order/[id]` конфликтами с `/new-admin`; старую неиспользуемую директорию pnpm core 0.2.0 — вторым активным экземпляром. Host и кэш не изменялись ради зелёного результата.

Исправлен framework: static mount учитывает приоритет Next перед sibling dynamic/catch-all fallback; interception разрешается относительно URL segments, без учёта groups/slots. Все существующие static/dynamic descendants внутри конкретного mount остаются защищены. Две прежние проверки чрезмерного запрета заменены проверками реальной защиты вложенных маршрутов и совместимости fallback. Конвенции сверены с установленной документацией Next и [официальным описанием interception](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes).

Количество core определяется по достижимому графу установленных зависимостей, включая peers и сторонние plugins, с дедупликацией realpath. Это не подсчёт модулей, фактически импортированных приложением во время работы. Код пакетов не исполняется.

Проверки: RED 10 failures ожидаемых симптомов → targeted 28 PASS; полный CLI 289 PASS, typecheck/build/lint/docs PASS. Независимый scoped review повторил 31 test и дал PASS. Probe на том же host: activeCore=1, conflicts=[]; обход графа занял 1648 ms. Расширенный packed Next/pnpm smoke (locale + parallel modal + canonical order) завершился exit 0: init/repeat/TypeScript, HTTP `/`, `/admin`, `/ru`, `/order/1`, `/flowpanel`, shutdown; `/tmp/flowpanel-doctor-followup-onboarding.log`.

Новые frozen tarballs `0.2.1-quality.20260908.b9be0b6` собраны из `b9be0b6`; manifest и все 11 hashes независимо сверены. Host integration зафиксирована implementer как `7f85c396`; свежий Sol/high reviewer дал PASS (1 review, 0 fix rounds). В Docker deps stage vendor копируется перед frozen install; reviewer независимо установил 1361 package из такого набора файлов, сверил source/archive/builder/lockfile/artifact hashes, активную версию core/React, повторил 8 admin tests и doctor 13/13.

Первый production build упал из-за ошибочно переданных пустых Sentry DSN (schema допускает отсутствие, но не пустой URL); source schema не менялась. В отдельном test env DSN и Telegram/Resend отправка отключены отсутствием переменных. **Последний production build завершён exit 0**, status `/tmp/admin-flowpanel-preview-final-build.status`, log `/tmp/admin-flowpanel-preview-final-build.log`; прежняя неопределённость exit status снята. Итоговый установленный doctor: 13/13 PASS. Рабочий 3111, его `.env`, seeds/migrations/actions и внешние releases на этом этапе не затронуты.

Расширенный **npm** packed Next smoke тоже завершился exit 0: install/dry-run/init/repeat/TypeScript/host routes/FlowPanel render; `/tmp/flowpanel-doctor-followup-npm.log`. Оба package manager проверены с locale/parallel/intercepting routes.

### Согласованность labels: фильтры, пагинация, palette

Отдельный контракт: `docs/spec/2026-09-08-labels-consistency.md`. Configured labels теперь доходят до filter toolbar/clear/all choices/boolean values/text search, pagination accessible names/size picker и palette search/empty/loading/dialog text. Registry Pagination получает обычные label props, DefaultPagination остаётся без context dependency. Все select filters используют `allOption` (English fallback All вместо прежнего Any у двух controls); прежние English page/palette names сохранены в единых defaults. Date presets, saved views и оставшиеся shell strings этим этапом не покрыты.

RED/GREEN: 3 chrome failures, palette и explicit-undefined merge failure подтверждены до fixes. Real Radix dropdown выбирает русский пункт, callback сохраняет `paid`, reset даёт `null`; pagination callbacks сохраняют number. Core merge сохраняет default при undefined и явную пустую строку. Independent review обнаружил такую же undefined-ошибку на отдельной границе Pagination props: новый regression воспроизвёл TypeError, shared resolver исправил standalone и custom-slot/provider пути. Повтор reviewer **16/16 PASS**, finding закрыт. Итоговые full core **206**, React **456** tests PASS; оба typecheck/build/public tsd, lint, docs/snippets и release consistency PASS. Локализация ещё не включена в frozen host collection b9be0b6; для host требуется следующий reviewed package update.


### Перенос в рабочую админку после PASS

Reviewed `7f85c396` применён к пользовательской `feat/new-admin` как **`bc591689`**. `corepack pnpm install --frozen-lockfile --offline` завершился exit 0, заменил 11 FlowPanel packages; host doctor 13/13 и `type-check` PASS. Чужой untracked `docs/plans/2026-09-03-pipeline-architecture.md` сохранён. Пользовательский сервер 3111 не останавливался, его env не менялся.

В действующей пользовательской сессии на 3111: `/admin` → `/new-admin`; список показывает «Поиск: Пользователи…»; карточка существующего synthetic user показывает `E2E Test User` и «Редактировать». Click «Уведомления» → `?tab=notifications` и только нужный panel; Back → Обзор той же карточки, Forward → Уведомления, Reload сохраняет выбор. После reload viewport/document width **440/440**, dark theme, browser error log пуст. Это проверка конкретного viewport, не полный mobile/a11y аудит.

Следующий набор с локализацией **755db64** собран в `/tmp/flowpanel-preview-755db64` (11 packages, pack exit 0), но в host ещё не перенесён. Остаются полная история связанных данных, недостающие строки date/saved views/shell, UX форм/loading/errors, расширенная матрица совместимости и обычный release-процесс. Внешних push/deploy/npm publish не выполнялось.


### Ежедневный интерфейс: русский preset и согласованные состояния

Контракт `2026-09-08-daily-admin-quality.md`: добавлены navigation/table/dateRange/savedViews и полный plain-string `RU_LABELS` с browser-safe export. Даты имеют явный locale при SSR/клиентском рендере; preset keys и calendar date wire format не менялись. Sidebar/tab shell сохраняют наиболее точный родительский раздел на detail URL. Saved view получает доступное имя поля; отказ localStorage оставляет введённое имя и показывает ошибку вместо ложного успеха.

RED/GREEN: 3 daily-labels DOM failures; 2 saved-view failures; отдельно восстановленный старый failure path с реальным quota-throw подтвердил отсутствие error toast, затем был восстановлен исправленный код. Full core208, React460, Next765 tests PASS; typecheck/build core/React/Next и kit build, core/React public tsd, lint/docs/snippets/release PASS. Reviewer выявил translated preset key; исправлены key и active identity на стабильный p.key. Дополнительный regression (одинаковые переводы, разные реальные диапазоны) и scoped reviewer11/11 PASS. Последний React typecheck/build/lint PASS. Это ещё не обновление host: следующим обязательным этапом закрывается выборка запрещённых полей до регистрации session history.

### Архитектурный аудит оставшихся release blockers

Read-only Sol/high architect подтвердил: list/detail pages пропускают adapter select и смешивают detail-поля со списком; related tabs теряют total/page и обрезают историю; generated CSS включает глобальный Tailwind Preflight; init принимает объявленные dependencies за установленные, а version check разбирает range первым числом; doctor repair не учитывает custom paths.api. Текущие green tests этих контрактов недостаточны (архитектор повторил projection34, CLI61, controller/drawer26, export5). Последующие исправления выполняются отдельно с RED/GREEN и review; эти пункты не объявлены выполненными.

### Безопасная проекция строк страниц

Контракт `2026-09-08-page-projection-safety.md`: list surface теперь ровно
`columns + rowKey + resource.expose`; drawer и detail declarations не попадают
в его `select` или сериализованные строки. Добавлен `detail.expose` для header,
hidden-tab predicates, related filters и custom detail renderers. До adapter
read один раз вычисляется field policy, `select` всегда передаётся как
пересечение известных колонок, а adapter output повторно проецируется. Detail
читает base fields, затем при hidden predicates делает максимум один scoped
второй read только для visible active tab; inactive tab fields не загружаются.
RED: list не передавал `select`, detail делал один широкий read. GREEN: focused
tests проверяют known-column select, token не выбирается/не сериализуется,
active/hidden/unknown tab, per-request policy и scope обоих reads. Независимый
review этого phase обязателен до host registration.

### Projection safety — review fix round 1

Fresh Sol/high review found two real select-honoring paths missed by the
wider-row canary fixture. `delete.softDelete` is now an operational-only field:
the list includes it in adapter `select` only when the same request-level field
policy permits it, derives `deletedRowKeys` server-side, and never adds it to
list controls or serialized rows. A denied marker is neither selected nor used
for an indicator. Detail now includes a requested unconditional tab, or a
deterministic first tab, in the initial select even when other tabs have hidden
predicates; it keeps the second scoped read only when the resolved active fields
were absent from that initial projection. RED: select-honoring list probe lost
the deleted marker and unconditional tabs made two reads. GREEN: regression
fixtures assert marker/payload separation, denied behavior, one policy call,
and one active-only detail read.

MemoryCandidate: Projection tests need both an adapter-ignores-select canary
for output re-projection and a select-honoring fixture for server-side metadata
dependencies; either fixture alone misses a distinct defect class.

### Scoped, consistent admin presentation

The generated stylesheet is now a thin import of
`@flowpanel/kit/styles/admin.css`, a package-built Tailwind 3.4 artifact. Its
compiler runs with Preflight disabled, then scopes every generated and manual
rule to FlowPanel roots and portals, namespaces compiler variables, keyframes,
and layers, and rejects unsafe output. It keeps Tailwind's full utility
initializer block local without publishing a host reset, Tailwind theme token,
or utility selector. The legacy `@flowpanel/react/styles/admin.css` source
export remains opt-in for applications that deliberately compile it with
Tailwind.

The shell navigation now has a stable `data-flowpanel-nav` marker for its focus
ring, independent of translated accessible labels. `MetricCard` and its
drilldown anchor fill a metric-only flex dashboard widget slot, producing
equal-height, full-width grid rows in Chromium and WebKit. Table, chart, and
unframed custom widgets retain their normal block layout. `ThemeConfig` adds
scoped, sanitized `cssVarsDark` overrides for dark semantic tokens.

An isolated Chromium and WebKit gate records the legacy RED case (global
Preflight, English-only focus selector, and unequal real rendered card heights),
then verifies GREEN host markers stay unchanged before and after loading CSS,
translated keyboard focus, click behavior, portal-root borders, ring/transform
utilities, desktop equal card
heights, and mobile stacking. It does not start a host server or database.

MemoryCandidate: Dashboard presentation gates must assert metric child width as
well as equal height, and must cover non-metric and unframed custom fragment
layout. CSS selector transformers must test comma-separated lists whose
pseudo-element selectors carry leading formatting whitespace.

### Проверенные milestones перед CLI lifecycle phase

- Page `08c5bb9`: scoped reviewer PASS, 39 focused checks; review 2, fix round 1.
- CSS `646c16c`: scoped reviewer PASS, 20 unit + 6 browser checks (300px slot/card/anchor и 124px height в обоих браузерах); review 2, fix round 1. Packed Next npm4 root smoke завершился exit 0, лог `/tmp/flowpanel-css-npm4-onboarding.log`; остальные npm/pnpm scenarios зафиксированы как passed в `06a6fc1`.
- Form `974ce71`: fresh reviewer PASS, 142 focused checks (Drizzle 36, Prisma 32, real SQLite + scope/core 35, Next 39), review 1, fix round 0. Writer: core 209, Next 779, Drizzle 79 + 44 external skips, Prisma 94 + 6 skips; affected builds/types/tsd/lint/docs/release PASS. Host не обновлялся после `b9be0b6`.

MemoryCandidate: First-party adapter coverage needs empty, nonempty, and omitted `select` SQL/cardinality cases plus an ignore-select page canary; mocks alone missed the real `[]` rejection.
