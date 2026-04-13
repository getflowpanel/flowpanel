/**
 * Russian locale for FlowPanel UI.
 * Keys match FlowPanelLocale from @flowpanel/react.
 */
export const ru = {
  searchPlaceholder: "Поиск запусков...",
  loadMore: "Загрузить ещё",
  noRunsTitle: "Нет запусков",
  noRunsDescription: "Добавьте withRun() в ваши воркеры для отслеживания запусков.",
  noMatchTitle: "Нет подходящих запусков",
  noMatchDescription: "Попробуйте изменить поиск или фильтры.",
  statusAll: "Все",
  statusRunning: "Выполняется",
  statusFailed: "Ошибка",
  statusSucceeded: "Успешно",
  justNow: "только что",
  liveStatus: "Онлайн",
  reconnecting: "Переподключение...",
  polling: "Опрос",
  paused: "Пауза",
  commandPlaceholder: "Введите для поиска...",
  noCommands: "Команды не найдены",
  clearFilters: "Сбросить фильтры",
  refreshData: "Обновить данные",
  close: "Закрыть",
  retry: "Повторить",
  sessionExpired: "Сессия истекла",
  serverError: "Ошибка сервера",
  connectionLost: "Соединение потеряно",
  skipToMain: "Перейти к содержимому",
  prevRun: "Предыдущий запуск",
  nextRun: "Следующий запуск",
  newRuns: (count: number) =>
    `${count} ${count === 1 ? "новый запуск" : count < 5 ? "новых запуска" : "новых запусков"}`,
} as const;
