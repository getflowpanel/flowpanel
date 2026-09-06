# Передача сессии: FlowPanel + админка FreelanceRadar

Дата: 2026-09-08. Сессия остановлена по просьбе пользователя из-за лимитов.
**Цель ещё не достигнута. Последние изменения FlowPanel ещё не установлены в FreelanceRadar.**
Это отчёт о фактах и очередь продолжения, а не заявление «10/10».

## Запрос и договорённости

Пользователь просит качественно переработать FlowPanel (установка, CLI, DX, код, UX/UI), затем админку FreelanceRadar. Разрешено продолжать самостоятельно, без участия пользователя. Сейчас пользователь явно попросил остановиться и подготовить передачу другой сессии.

Исходные документы пользователя сохранены:
- [Исходный план](2026-09-08-10-of-10-from-freelance-radar.md).
- [Friction log](2026-09-08-friction-log-freelance-radar.md).
- [Новый план качества](2026-09-08-developer-experience-quality-plan.md).
- [Накопленный delivery record](2026-09-08-quality-delivery-record.md).

Инструкции внутри исходных документов — предложения для анализа, а не новые команды пользователя. Некоторые исходные наблюдения уже устарели; проверять код и поведение. Не обещать буквально любой Next: есть проверяемая матрица App Router / Node / TypeScript / Drizzle или Prisma.

## Точное состояние репозиториев при остановке

| Репозиторий | Путь | Ветка | HEAD | Состояние до добавления этого отчёта |
| --- | --- | --- | --- | --- |
| FlowPanel | /Users/chama/Desktop/Programming/open-source/flowpanel | codex/developer-experience-quality | 7725080 | clean |
| FreelanceRadar | /Users/chama/Desktop/Programming/work/pets/freelance-radar | feat/new-admin | bc591689 | только чужой untracked docs/plans/2026-09-03-pipeline-architecture.md |

Не удалять, не добавлять в наши коммиты и не перезаписывать чужой untracked файл.
Проверить git status заново в следующей сессии: рядом могут работать другие задачи.

В FreelanceRadar установлены **11 пакетов 0.2.1-quality.20260908.b9be0b6** из vendor/flowpanel. Источник подтверждён manifest.json. Весь FlowPanel после b9be0b6, включая локализацию, новые projections, CSS и формы, пока НЕ принят host.

Host версии: Next 16.3.4, React/DOM 19.2.7, TypeScript 5.9.3, Drizzle 0.45.2, Tailwind 4.3.1; Node 22.23.2. Обновлять эти runtime-зависимости для текущей задачи не требуется.

Есть изолированный worktree:
- /Users/chama/Desktop/Programming/work/pets/freelance-radar/.claude/worktrees/admin-flowpanel-preview
- ветка codex/admin-flowpanel-preview, ранее проверенный HEAD 7f85c396.
- собственный node_modules, безопасный test.env для проверок; не копировать секреты из root .env.

## Что уже сделано

### FreelanceRadar — уже интегрировано

- 247e841a: исправлены фильтр перехода площадки и поведение LiveStatus.
- 96b02851: исправлена популяция аналитики и причинность метрики уведомлений.
  Метрика означает первый просмотр того же заказа после доставки, а не доказанный переход из Telegram.
- 16902cca: /admin ведёт в рабочую /new-admin; theme/nonce entry исправлен. Старый /admin/monitor сохранён.
- bc591689: принят проверенный preview FlowPanel из b9be0b6. Читаемый заголовок пользователя вместо одного UUID, русский label редактирования.

Проверки интеграции: независимый PASS, 8/8 focused admin tests, doctor 13/13, frozen offline install 1361 packages, все 11 tarball/hash/version/export checks, focused ESLint, type-check. Production build отдельного worktree завершался exit 0; evidence:
- /tmp/admin-flowpanel-preview-final-build.status
- /tmp/admin-flowpanel-preview-final-build.log

Ранее в авторизованном браузере проверены /admin → /new-admin, поиск/карточка синтетического пользователя, tabs, Back/Forward/reload, узкий viewport, dark mode. Эти проверки относятся к ранней host-сборке, не к будущему финальному состоянию.

### FlowPanel — реализовано и проверено по фазам

- ebb82ab, b9be0b6: базовые DX/route/import/env/detail/auth исправления; семантика маршрутов Next, pnpm doctor и реальные packed fixtures. Не переписывали существующий scan/plan/apply с нуля.
- ab39883: воспроизводимая сборка immutable preview из git archive с manifest/hash каждого артефакта.
- 755db64, d964379: локализация повседневных controls; независимый PASS.
- 7ca0ab5, 08c5bb9: узкие list/detail/related projections, сохранение metadata, field policy и повторное проектирование результата adapter; scoped review PASS.
- 06a6fc1, 646c16c: **предкомпилированный изолированный CSS** из @flowpanel/kit/styles/admin.css. Убрана обязательная зависимость kit/react от Tailwind host. Нет глобального preflight; selectors/--tw variables/keyframes изолированы. Исправлены pseudo selectors и размер metric cards без разрушения других widgets. Legacy raw React stylesheet остаётся явным opt-in.
- 974ce71: **безопасная выборка generated edit forms**. update.expose задаёт зависимости hidden/readOnly callbacks, не создаёт controls/defaults/write permissions. Policy определяется до get; select и повторное проектирование до form resolution. Запрещённый reference не запускает related lookup. POST сохраняет полный scoped trusted row для write policy.
- В той же фазе Drizzle/Prisma корректно поддерживают select: [] без возврата полного row/PK: Drizzle sentinel, Prisma scoped count/cardinality, наружу только свежие {}.

Сильные проверки последних двух закрытых фаз:
- CSS: независимый PASS; real SSR/browser fixture Chromium/WebKit 6/6, focused 20/20. Реальные packed npm/pnpm с Tailwind none/4 проходили в рамках CSS-фазы; последний npm4 gate на 646c16c: /tmp/flowpanel-css-npm4-onboarding.log.
- Forms/projection: независимый PASS, 142 focused reviewer tests. Writer: core 209, Next 779, Drizzle 79 PASS + 44 external DB skips, Prisma 94 PASS + 6 external DB skips; types/build/public tsd/lint/docs/release PASS. PG/MySQL внешние интеграции заново не запускались, это ограничение сохранено.

Нельзя переносить эти результаты на текущий HEAD без необходимых проверок изменений после них.

## На чём остановились: CLI, ещё НЕ завершён и НЕ прошёл independent review

Коммиты:
- d52fc61 fix(cli): verify installed project compatibility
- 524c51e fix(cli): harden init lifecycle diagnostics
- 7725080 fix(cli): report remaining init recovery

Реализованы installed manifest resolver, разделение declared/installed dependency, semver checks, exact React/DOM pair, PM precedence, local TypeScript doctor без npx fallback, часть безопасной установки/диагностики, pipe/JSON/recovery/outro.

Фактическая проверка: на 524c51e CLI 293/293, typecheck и Biome CLI source PASS. На 7725080 focused init 21/21, typecheck/Biome PASS. Docs/release были PASS раньше в CLI-фазе; чистая упаковка и финальные packed/PTY сценарии НЕ завершены.

### Первая задача следующей сессии

Прочитать packages/cli/src/commands/init.ts и закрыть оставшиеся случаи:
1. recovery/failed сейчас строятся только по unresolved. Если пакет установлен, но kit/CLI несовместим, init падает, однако JSON failed=[] и recovery=[]: нужен правдивый состав проблем и действие восстановления.
2. Installer идёт по исходному missing. Первый обычный install может установить оба пакета; перед второй командой нужно заново проверить, остаётся ли пакет недостающим.
3. Новые recovery semantics нуждаются в **прямых регрессиях**, а не только повторном запуске старых тестов. 7725080 меняет один source-файл без новых тестов.
4. Проверить partial failure: уже установленное не попадает в recovery; file:/workspace:/tag/range declarations не заменяются pinned add; обычный install сохраняет их.
5. Проверить exit 0 при реально отсутствующем/невалидном пакете, несовместимый local CLI, редактирование секретов и ограничение вывода installer, JSON single stdout document, NO_COLOR, pipe failure, PTY cancel до apply = 0 changes.
6. Оценить exact equality localCli.version !== CLI_VERSION: kit использует matching minor; обоснованно определить поддержку patch/preview, не ломая корректный existing project.
7. После исходников выполнить gates последовательно и только затем свежий independent Sol/high review диапазона 974ce71..FINAL_CLI_HEAD. Пока formal review invocations = 0, fix rounds = 0.

Полный контракт: [CLI contract](2026-09-08-cli-installed-project-contract.md) + экспорт контекста ниже.
Важно: устаревшее требование Tailwind в документах не возвращать — default precompiled CSS его не требует.
Совместимость: Node >=20 + Next engines; Next ^16.3; React/DOM ^19 и одинаковая точная версия; Drizzle >=0.45.2 <1 или Prisma >=5 <7; установленный TS. Не выбирать транзитивный Drizzle в явно Prisma host. Обычные unsupported prereleases отклоняются, matching FlowPanel previews допустимы.
PM: packageManager > единственный lock > invoker UA > npm; неоднозначные locks без явного manager блокируют запись.
PnP-only: честная unsupported-layout диагностика, не исполнять .pnp.cjs.
Не обновлять host Next/React/TS/ORM автоматически.

### Проверки, которые надо закончить

После build соответствующих packages:
- pnpm --filter @flowpanel/cli test:unit
- pnpm --filter @flowpanel/cli typecheck
- pnpm check:cli-package
- node scripts/check-next-onboarding.mjs npm none
- node scripts/check-next-onboarding.mjs pnpm none
- при изменениях CSS/генерации также варианты npm 4 и pnpm 4
- применимые build, Biome, docs/release, publint и PTY/JSON fixtures.

Не запускать одновременно builds и tests, читающие dist. Не запускать несколько одинаковых clean package gates.
**При остановке обнаружены три незавершённых check:cli-package, ожидавших npm install.** Их exit status не получен; причина ожидания не доказана. Root остановил SIGTERM только подтверждённые процессы этой задачи:
43218/43231/49502, 44086/44100/50146, 49340/49357/49371.
Это НЕ PASS. Временные install dirs: flowpanel-cli-package-jCgDfR, Tr2jRh, IUvo4a под macOS tmpdir.
В следующей сессии добавить разумный timeout/retry budget для проверки или проверить сеть; не создавать ещё три зависших запуска.

## Что делать после CLI — по порядку

### 1. URL identity + Next deployment basePath

Подготовлен подробный brief в session-handoff-context.json, key url-identity-implementation-brief.
Исправить:
- buildHref сейчас соединяет raw atoms и обрезает leading slash: ломает ID с /, %, ?, #, Unicode.
- Разделить атомы ID (encodeURIComponent) и configured nested paths dashboard/page.
- Next page catchall lexical encoded; API catchall decoded once. Page decode ровно один раз, API не декодировать повторно.
- Config paths.api остаётся app-relative. Prefix deployment basePath нужен только browser egress: provider API, server form actions, SSE/runtime client metadata; не handler dispatch/revalidate/redirect.
- Detail native edit anchor → Next Link.
- Keyless projected rows: не создавать inline/bulk requests, selection IDs, row activation и URL с undefined/empty ID. Literal valid ID "undefined" остаётся допустим. Отдельный render key не становится идентификатором записи. Не расширять denied projection ради удобства controls.

Архитектурный контракт измерен реальным Next 16.3.1 webpack/Turbopack и 16.3.4 webpack/Turbopack. Подтверждено: private compiled process.env.__NEXT_ROUTER_BASEPATH доступен в installed package server/client; публичного подходящего getter не обнаружено. Ограниченная внутренняя зависимость требует fixture gate.
Turbopack evidence:
- /tmp/flowpanel-next1634-turbo-probe.mjs
- /tmp/flowpanel-next1634-turbo-evidence.json
- /tmp/flowpanel-next1634-turbo-server.log
- /tmp/flowpanel-next1634-turbo-path
8 reserved-ID cases + реальная Chromium hydration PASS; own server/browser закрыты.
Это probe Next/fake package, **не реализация и не packed FlowPanel URL regression**. Последний ещё нужен: /host + /ops/admin + /internal/fp, actual adapter identity, Link/form/fetch/SSE.

### 2. Generated form presentation

[Спецификация](2026-09-08-generated-form-experience.md).
Security часть уже завершена в 974ce71; не повторять её.
Осталось: heading с singular label, Save/Create/Cancel, native/async select placeholder/no options/searching/error из labels; явный empty override сохраняется; cancel возвращает к record/list и не submit. Доказать реальные controls, failure/value retention, различие одинаково подписанных option values. Не автопереводить domain enums/Zod messages.

### 3. Доступ ко всей related history

[Спецификация](2026-09-08-related-history-pagination.md).
Сейчас builtin detail показывает первые 25 строк с фиктивной page 1 и теряет total.
readRelatedPage + совместимый rows wrapper, namespaced relatedPage.<tab-key>, реальные pager/router controls, Back/Forward/reload, default sort/readable PK fallback, lazy inactive tabs, bounded out-of-range correction. Scope/relationship filters/select/reprojection не ослаблять. Test 26+ строк; никаких host DB mutations.

### 4. CLI doctor/init custom API mount

Static admin mount resolver и doctor FIXABLEFILES ещё привязаны к /api/flowpanel.
Читать статические paths.admin + paths.api/reexports, правильно проверять/чинить configured API+SSE пару; dynamic API unknown не чинить в default даже при --path admin. Семантические API collision проверки route groups/catchalls. Next deployment basePath не меняет app-relative config paths.

### 5. Закрыть подтверждённые остатки friction log

Не начинать универсальный DSL ради исходного roadmap.
- React TableWidget игнорирует переданный emptyState, hardcodes "No data".
- Next table widget hardcodes rowKey="id"; query columns только keys. Нужны узкие typed labels/rowKey/links/see-all/empty для подтверждённых host usages, сохраняя custom domain React там, где он понятнее.
- Charts уже имеют empty component: не утверждать обратное. Остались локализуемые empty strings; legend/loading/header оценивать по реальному UX.
- core/src/format-column.ts hardcodes en-US number/money; общий locale/timeZone контракт ещё не реализован.
- Redis: core/runtime/publish.ts создаёт pub+sub даже для publish-only; unsubscribe rejection не обработан; async subscribe/unsubscribe race; нет ownership/dispose. Next first bound config wins forever.
  Нельзя просто rebind по config object identity: Next независимые route bundles дают разные эквивалентные объекты, existing realtime-cross-route test защищает живые подписки.
  Реальный host wire format — prefix:channel + raw JSON, не envelope из исходного friction log.
  Не повторять неподтверждённое утверждение «нет error listener значит uncaughtException».
  Перед паузой архитектор получил read-only advisory на эту тему, но завершённого нового ответа нет; advisory нужно закончить заново.
- rowClick сейчас только drawer|false: при необходимости явного перехода в detail согласовать узкий API и реальную keyboard/link семантику.

### 6. Финальная интеграция и UX FreelanceRadar

Делать только после необходимых shared fixes и review:
- Собрать новый immutable preview всех 11 пакетов одной версии, установить сначала isolated worktree.
- RU_LABELS объединять по nested groups, не shallow overwrite старым partial.
- Перевести admin CSS на precompiled kit и оставить только host custom utilities.
- Тема lime: проверить контраст реальных active states; cssVarsDark теперь доступен. Предварительные accent-badge значения 90 100% 19% / dark 82 100% 70% — ещё не финально измеренный выбор.
- Упорядочить стабильные user tab keys: summary,timeline,feed,messages,notifications,responses,feedback,ai,billing,access; сохранить URL и mobile overflow.
- Все previews по 50/200 строк должны иметь путь к полной отфильтрованной истории. BotMessages target telegram_message_log сейчас требует exact userId filter.
- Sessions/consents, если нужны полные readonly ресурсы, проектировать узко, token read:false, без случайных mutations/export.
- Подписать AI cost как последние 50, если это фактический лимит, а не lifetime.
- Убрать raw /new-admin URLs через mount helper без тяжёлых config/DB import cycles.
- Подтверждённый host projection gap: admin/config/resources/bot-messages.tsx renderer использует parseMode/failReason, их нужно явно declare через expose + select-honoring regression.
- Не сносить QueryTable ради косметики: сейчас он уже даёт реальные anchors и локальный horizontal scroll.
- Сохранить рабочий /admin redirect и /admin/monitor до доказанной parity canonical migration.

CSS probe host уже PASS только на source/dist paths:
```css
@import "@flowpanel/kit/styles/admin.css";
@reference "tailwindcss";
@reference "@flowpanel/react/styles/admin.css";
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@source "../../admin";
```
/tmp/flowpanel-host-custom-css-probe.css содержит host utility и FP theme tokens, без :root/universal reset.
Нужно проверить installed exports и настоящий host UI. Не менять host globals без причины.

Preview builder:
```sh
node scripts/pack-preview.mjs 0.2.1-quality.20260908.<sha> /tmp/flowpanel-preview-<sha> <sha>
```
Использовать только reviewed commit. Старый /tmp/flowpanel-preview-b9be0b6 соответствует текущему host. Более поздний stale 755 preview не принимать случайно.
Сборка deterministic по input/archive/manifest, но не заявлять bit-identical rebuild: ранее порядок React chunks отличался.

## Процессы, браузер и безопасность

При передаче пользовательский Next 3111 всё ещё присутствует в process list: PID 38415/38421. Root его не останавливал. Последний CUA navigation timeout и sandbox curl failure не доказывают, что приложение упало.
Есть чужие Next servers (включая fontcheck:3620 и ProRiski) — не трогать.
Три root CLI checks остановлены явно; агенты cli_installed и url_identity_architect interrupted по просьбе пользователя. Не рассчитывать на их IDs в новой сессии.
CUA attempt создавал tab13, navigation timeout. Не угадывать состояние вкладок; повторно найти/открыть relevant browser.
Для QA был выбран существующий синтетический user ID e8d4359a-35c2-4752-bc47-f0b564f91d4f. Не использовать реальные данные для destructive tests.

Не читали/не меняли host DB/Redis, не запускали migrations/workers, не submit формы в host. Такие проверки выполнять на disposable fixture.
Не печатать .env values, не переносить секреты в logs/specs.
Ничего не публиковалось в npm, не было push/dev merge/deploy. Не выполнять это автоматически в следующей сессии.

## Процесс работы и ограничения

В FR читать AGENTS.md, .codex/WORKFLOW.md, .claude/AGENT-PREFLIGHT.md и defect-classes; nearest scoped AGENTS перед src edits.
Сохранён принятый workflow: один source writer; UI advisory read-only отдельно; cross-module/security high-risk Terra/high implementer → fresh Sol/high reviewer, optional Sol/high architect. До review deterministic checks; максимум 3 review invocations / 2 fix rounds, исправляет тот же implementer. Не запускать конкурирующих writers/builds.
Предыдущие закрытые CSS/forms получили PASS. CLI пока нет.
Linear export внутренней финансовой спецификации был отклонён auto-review ранее. Не повторять экспорт/обход; локальные specs и codex branches используются как явное исключение. Не придумывать TASK IDs.
FR вне writable roots; для scoped edits/install/git возможна техническая escalation. Не задавать пользователю повторные вопросы о рутинных уже разрешённых решениях.

В этой передаче нет новых success claims. Новый handoff commit содержит только отчёт и экспорт контекста; product HEAD для CLI review — 7725080.

## Как начать новую сессию

Передать следующий запрос:

> Продолжи задачу FlowPanel и FreelanceRadar без моего участия. Прочитай docs/spec/2026-09-08-session-handoff.md и соседний session-handoff-context.json. Сначала проверь git status обоих репозиториев. Заверши текущую CLI-фазу с указанными regression/packed/PTY проверками и независимым review; затем выполняй оставшуюся очередь. Не считать последние shared fixes уже установленными в freelance-radar. Не публиковать, не пушить и не менять production DB. Сохраняй один writer и проверяй реальное поведение, а не только unit counts.

[Экспорт архитектурных заметок и подробных briefs](2026-09-08-session-handoff-context.json) нужен новой сессии: functions.store не переносится между сессиями. Он не заменяет проверку текущих исходников.
