const STORAGE_KEYS = {
  tasks: "vibe_planner_tasks",
  reflection: "vibe_planner_reflection",
  currentWeek: "vibe_planner_current_week",
  weekHistory: "vibe_planner_week_history",
};

const VALID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const VALID_CATEGORIES = ["business", "personal", "learning"];
const MAX_TASK_LENGTH = 200;
const MAX_REFLECTION_COMMENT_LENGTH = 500;
const VALIDATION_MESSAGE = "Введите текст задачи";

const DAY_LABELS = {
  mon: "Понедельник",
  tue: "Вторник",
  wed: "Среда",
  thu: "Четверг",
  fri: "Пятница",
  sat: "Суббота",
  sun: "Воскресенье",
};

const CATEGORY_LABELS = {
  business: "Бизнес-задачи",
  personal: "Личные",
  learning: "Учебные",
};

const CATEGORY_DOTS = {
  business: "business",
  personal: "personal",
  learning: "learning",
};

const INITIAL_STATE = {
  tasks: [],
  reflection: {
    productivity: 5,
    emotion: 5,
    comment: "",
    updatedAt: null,
  },
};

let appState = createInitialState();
let currentWeekStart = getSavedWeekStart();
let weekHistory = loadWeekHistory();

function createInitialState() {
  return {
    tasks: [],
    reflection: { ...INITIAL_STATE.reflection },
  };
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonday(date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day + 1);

  return result;
}

function getSavedWeekStart() {
  return localStorage.getItem(STORAGE_KEYS.currentWeek) || formatDateKey(getMonday(new Date()));
}

function getWeekEnd(weekStart) {
  const end = new Date(`${weekStart}T00:00:00`);
  end.setDate(end.getDate() + 6);

  return end;
}

function getWeekRangeLabel(weekStart) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = getWeekEnd(weekStart);
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getNumericWeekRangeLabel(weekStart) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = getWeekEnd(weekStart);
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "numeric",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getWeekOffsetFromCurrent(weekStart) {
  const baseWeek = getMonday(new Date());
  const targetWeek = new Date(`${weekStart}T00:00:00`);
  const millisecondsInWeek = 7 * 24 * 60 * 60 * 1000;

  return Math.round((targetWeek - baseWeek) / millisecondsInWeek);
}

function getWeekStartFromOffset(offset, baseWeekStart = formatDateKey(getMonday(new Date()))) {
  const targetWeek = new Date(`${baseWeekStart}T00:00:00`);
  targetWeek.setDate(targetWeek.getDate() + offset * 7);

  return formatDateKey(targetWeek);
}

function loadWeekHistory() {
  try {
    const parsedHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.weekHistory) || "{}");

    return parsedHistory && typeof parsedHistory === "object" ? parsedHistory : {};
  } catch (error) {
    return {};
  }
}

function saveWeekHistory() {
  localStorage.setItem(STORAGE_KEYS.weekHistory, JSON.stringify(weekHistory));
}

function saveCurrentWeekToHistory() {
  weekHistory[currentWeekStart] = {
    tasks: appState.tasks,
    reflection: appState.reflection,
    updatedAt: new Date().toISOString(),
  };
  saveWeekHistory();
}

function generateTaskId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isReflectionValid(reflection) {
  return (
    reflection !== null &&
    typeof reflection === "object" &&
    Number.isFinite(reflection.productivity) &&
    reflection.productivity >= 1 &&
    reflection.productivity <= 10 &&
    Number.isFinite(reflection.emotion) &&
    reflection.emotion >= 1 &&
    reflection.emotion <= 10 &&
    typeof reflection.comment === "string" &&
    reflection.comment.length <= MAX_REFLECTION_COMMENT_LENGTH &&
    (reflection.updatedAt === null || typeof reflection.updatedAt === "string")
  );
}

function isTaskValid(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.text === "string" &&
    task.text.trim().length > 0 &&
    task.text.length <= MAX_TASK_LENGTH &&
    VALID_CATEGORIES.includes(task.category) &&
    VALID_DAYS.includes(task.day) &&
    typeof task.completed === "boolean" &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string"
  );
}

function loadState() {
  const savedTasks = localStorage.getItem(STORAGE_KEYS.tasks);
  const savedReflection = localStorage.getItem(STORAGE_KEYS.reflection);
  const savedWeek = weekHistory[currentWeekStart];

  if (savedWeek && Array.isArray(savedWeek.tasks) && savedWeek.tasks.every(isTaskValid) && isReflectionValid(savedWeek.reflection)) {
    return {
      tasks: savedWeek.tasks,
      reflection: normalizeReflection(savedWeek.reflection),
    };
  }

  if (savedTasks === null || savedReflection === null) {
    return createInitialState();
  }

  try {
    const parsedTasks = JSON.parse(savedTasks);
    const parsedReflection = JSON.parse(savedReflection);

    if (!Array.isArray(parsedTasks) || !parsedTasks.every(isTaskValid) || !isReflectionValid(parsedReflection)) {
      return createInitialState();
    }

    return {
      tasks: parsedTasks,
      reflection: normalizeReflection(parsedReflection),
    };
  } catch (error) {
    return createInitialState();
  }
}

function normalizeReflection(reflection) {
  return {
    ...reflection,
    productivity: Math.max(1, Math.min(5, Number(reflection.productivity) || 5)),
    emotion: Math.max(1, Math.min(5, Number(reflection.emotion) || 5)),
    comment: typeof reflection.comment === "string"
      ? reflection.comment.slice(0, MAX_REFLECTION_COMMENT_LENGTH)
      : "",
    updatedAt: reflection.updatedAt ?? null,
  };
}

function loadWeek(weekStart) {
  const savedWeek = weekHistory[weekStart];

  if (savedWeek && Array.isArray(savedWeek.tasks) && savedWeek.tasks.every(isTaskValid) && isReflectionValid(savedWeek.reflection)) {
    return {
      tasks: savedWeek.tasks,
      reflection: normalizeReflection(savedWeek.reflection),
    };
  }

  return createInitialState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(appState.tasks));
  localStorage.setItem(STORAGE_KEYS.reflection, JSON.stringify(appState.reflection));
  localStorage.setItem(STORAGE_KEYS.currentWeek, currentWeekStart);
  saveCurrentWeekToHistory();
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(appState.tasks));
  saveCurrentWeekToHistory();
}

function saveReflection() {
  localStorage.setItem(STORAGE_KEYS.reflection, JSON.stringify(appState.reflection));
  saveCurrentWeekToHistory();
}

function validateTaskText(text) {
  const trimmedText = text.trim();

  if (trimmedText.length === 0 || trimmedText.length > MAX_TASK_LENGTH) {
    return null;
  }

  return trimmedText;
}

function createSelectOption(value, label, selectedValue) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  option.selected = value === selectedValue;

  return option;
}

function createTask(text, day, category) {
  const now = new Date().toISOString();

  return {
    id: generateTaskId(),
    text,
    category,
    day,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

function getTaskById(taskId) {
  return appState.tasks.find((task) => task.id === taskId);
}

function updateTask(task, updates) {
  Object.assign(task, updates, {
    updatedAt: new Date().toISOString(),
  });
  saveTasks();
}

function renderProgress() {
  const totalTasks = appState.tasks.length;
  const completedTasks = appState.tasks.filter((task) => task.completed).length;
  const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const counter = document.querySelector(".week-progress__counter");
  const percentText = document.querySelector(".week-progress__percent");
  const progressValue = document.querySelector(".progress-bar__value");
  const progressBar = document.querySelector(".progress-bar");

  if (counter) {
    counter.textContent = `${completedTasks} из ${totalTasks} выполнено`;
  }

  if (percentText) {
    percentText.textContent = `${percent}%`;
  }

  if (progressValue) {
    progressValue.style.width = `${percent}%`;
  }

  if (progressBar) {
    progressBar.setAttribute("aria-valuenow", String(percent));
  }
}

function getCategoryStats(tasks) {
  const stats = {
    business: 0,
    personal: 0,
    learning: 0,
  };

  tasks.forEach((task) => {
    if (VALID_CATEGORIES.includes(task.category)) {
      stats[task.category] += 1;
    }
  });

  return stats;
}

function renderWeekTools() {
  const weekRangeLabel = document.querySelector("#week-range-label");
  const yearLabel = document.querySelector("#calendar-year-label");
  const calendarGrid = document.querySelector("#month-calendar-grid");
  const shortcutButtons = document.querySelectorAll(".week-shortcuts__button");
  const currentYear = new Date(`${currentWeekStart}T00:00:00`).getFullYear();

  if (weekRangeLabel) {
    weekRangeLabel.textContent = getWeekRangeLabel(currentWeekStart);
  }

  if (yearLabel) {
    yearLabel.textContent = String(currentYear);
  }

  shortcutButtons.forEach((button) => {
    const offset = Number(button.dataset.offset);

    if (!Number.isFinite(offset)) {
      return;
    }

    const targetWeekStart = getWeekStartFromOffset(offset, currentWeekStart);
    button.textContent = `${offset} нед. (${getNumericWeekRangeLabel(targetWeekStart)})`;
  });

  if (!calendarGrid) {
    return;
  }

  calendarGrid.innerHTML = "";

  const monthFormatter = new Intl.DateTimeFormat("ru-RU", {
    month: "short",
  });

  for (let month = 0; month < 12; month += 1) {
    const monthWeeks = Object.entries(weekHistory)
      .filter(([weekStart, week]) => {
        const weekDate = new Date(`${weekStart}T00:00:00`);

        return weekDate.getFullYear() === currentYear && weekDate.getMonth() === month && isReflectionValid(week.reflection);
      });
    const total = monthWeeks.length;
    const averageScore = total === 0
      ? 0
      : monthWeeks.reduce((sum, [, week]) => {
          const reflection = normalizeReflection(week.reflection);

          return sum + (reflection.productivity + reflection.emotion) / 2;
        }, 0) / total;
    const averageLabel = total === 0 ? "0" : averageScore.toFixed(1);
    const scoreState = averageScore === 0
      ? "empty"
      : averageScore < 3
        ? "low"
        : averageScore < 4
          ? "middle"
          : "high";
    const monthItem = document.createElement("article");
    monthItem.className = "month-item";
    monthItem.dataset.score = scoreState;

    monthItem.innerHTML = `
      <div class="month-item__top">
        <span>${monthFormatter.format(new Date(currentYear, month, 1))}</span>
        <strong>${averageLabel}</strong>
      </div>
      <div class="month-item__bar" aria-label="Средняя оценка месяца ${averageLabel} из 5"></div>
    `;
    calendarGrid.append(monthItem);
  }
}

function switchWeek(offset) {
  saveCurrentWeekToHistory();

  const nextWeek = new Date(`${currentWeekStart}T00:00:00`);
  nextWeek.setDate(nextWeek.getDate() + offset * 7);
  currentWeekStart = formatDateKey(nextWeek);
  appState = loadWeek(currentWeekStart);
  saveState();
  renderTasks();
  renderReflection();
  renderWeekTools();
}

function jumpToWeekOffset(offset) {
  saveCurrentWeekToHistory();
  currentWeekStart = getWeekStartFromOffset(offset, currentWeekStart);
  appState = loadWeek(currentWeekStart);
  saveState();
  renderTasks();
  renderReflection();
  renderWeekTools();
}

function createCurrentWeekRows() {
  return appState.tasks.map((task) => [
    DAY_LABELS[task.day],
    CATEGORY_LABELS[task.category],
    task.completed ? "Выполнено" : "В работе",
    task.text,
  ]);
}

function getReflectionExportData() {
  const productivity = Math.min(5, appState.reflection.productivity);
  const emotion = Math.min(5, appState.reflection.emotion);
  const average = ((productivity + emotion) / 2).toFixed(1);

  return {
    productivity,
    emotion,
    average,
    summary: getReflectionSummary(productivity, emotion),
    comment: appState.reflection.comment || "",
  };
}

function getWeekSummaryRows() {
  return VALID_CATEGORIES.map((category) => {
    const categoryTasks = appState.tasks.filter((task) => task.category === category);
    const completedCategoryTasks = categoryTasks.filter((task) => task.completed).length;

    return [
      CATEGORY_LABELS[category],
      categoryTasks.length,
      completedCategoryTasks,
    ];
  });
}

function getWeekSummaryExportData() {
  const totalTasks = appState.tasks.length;
  const completedTasks = appState.tasks.filter((task) => task.completed).length;
  const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return {
    totalTasks,
    completedTasks,
    percent,
    rows: getWeekSummaryRows(),
    motivation: getWeekMotivation(percent),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportCurrentWeekToXls() {
  const rows = createCurrentWeekRows();
  const reflection = getReflectionExportData();
  const weekSummary = getWeekSummaryExportData();
  const tableRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const summaryRows = weekSummary.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const html = `
    <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <h2>Итоги недели</h2>
        <table>
          <tr><th>Продуктивность</th><th>Эмоциональность</th><th>Средняя оценка</th><th>Вывод</th><th>Комментарий</th></tr>
          <tr>
            <td>${escapeHtml(reflection.productivity)}</td>
            <td>${escapeHtml(reflection.emotion)}</td>
            <td>${escapeHtml(reflection.average)}</td>
            <td>${escapeHtml(reflection.summary)}</td>
            <td>${escapeHtml(reflection.comment)}</td>
          </tr>
        </table>
        <h2>Выводы недели</h2>
        <table>
          <tr><th>Категория</th><th>Запланировано</th><th>Выполнено</th></tr>
          ${summaryRows}
          <tr><td>Всего</td><td>${escapeHtml(weekSummary.totalTasks)}</td><td>${escapeHtml(weekSummary.completedTasks)}</td></tr>
          <tr><td>Мотивационный вывод</td><td colspan="2">${escapeHtml(weekSummary.motivation)}</td></tr>
        </table>
        <h2>Задачи</h2>
        <table>
          <tr><th>День</th><th>Категория</th><th>Статус</th><th>Задача</th></tr>
          ${tableRows}
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `nedelnyy-fokus-${currentWeekStart}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCurrentWeekToPdf() {
  const rows = createCurrentWeekRows();
  const reflection = getReflectionExportData();
  const weekSummary = getWeekSummaryExportData();
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    window.alert("Разрешите всплывающие окна, чтобы сохранить PDF.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <title>Недельный фокус ${currentWeekStart}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #18242b; }
          h1 { color: #7a38bd; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d8cde6; padding: 8px; text-align: left; }
          th { background: #f0e7fb; }
        </style>
      </head>
      <body>
        <h1>Недельный фокус</h1>
        <p>${getWeekRangeLabel(currentWeekStart)}</p>
        <h2>Итоги недели</h2>
        <table>
          <tbody>
            <tr><th>Продуктивность</th><td>${escapeHtml(reflection.productivity)} / 5</td></tr>
            <tr><th>Эмоциональность</th><td>${escapeHtml(reflection.emotion)} / 5</td></tr>
            <tr><th>Средняя оценка</th><td>${escapeHtml(reflection.average)} / 5</td></tr>
            <tr><th>Вывод</th><td>${escapeHtml(reflection.summary)}</td></tr>
            <tr><th>Комментарий</th><td>${escapeHtml(reflection.comment)}</td></tr>
          </tbody>
        </table>
        <h2>Выводы недели</h2>
        <table>
          <thead><tr><th>Категория</th><th>Запланировано</th><th>Выполнено</th></tr></thead>
          <tbody>
            ${weekSummary.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
            <tr><td>Всего</td><td>${escapeHtml(weekSummary.totalTasks)}</td><td>${escapeHtml(weekSummary.completedTasks)}</td></tr>
          </tbody>
        </table>
        <p><strong>${escapeHtml(weekSummary.motivation)}</strong></p>
        <h2>Задачи</h2>
        <table>
          <thead><tr><th>День</th><th>Категория</th><th>Статус</th><th>Задача</th></tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function getDayProgressColor(progress) {
  const ratio = progress / 100;
  const saturation = Math.round(58 + 34 * ratio);
  const lightness = Math.round(74 - 16 * ratio);

  return `hsl(282 ${saturation}% ${lightness}%)`;
}

function createTaskItem(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  item.dataset.taskId = task.id;

  if (task.completed) {
    item.classList.add("task-item--completed");
  }

  const checkbox = document.createElement("input");
  checkbox.className = "task-item__checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.dataset.action = "toggle-completed";
  checkbox.setAttribute("aria-label", "Отметить выполнение");

  const text = document.createElement("button");
  text.className = "task-item__text";
  text.type = "button";
  text.dataset.action = "edit-text";
  text.textContent = task.text;
  text.title = "Нажмите, чтобы изменить текст";

  const removeButton = document.createElement("button");
  removeButton.className = "task-item__remove";
  removeButton.type = "button";
  removeButton.dataset.action = "delete";
  removeButton.setAttribute("aria-label", "Удалить задачу");
  removeButton.textContent = "x";

  const menuButton = document.createElement("button");
  menuButton.className = "task-item__menu";
  menuButton.type = "button";
  menuButton.dataset.action = "toggle-task-menu";
  menuButton.setAttribute("aria-label", "Открыть настройки задачи");
  menuButton.textContent = "...";

  const actions = document.createElement("div");
  actions.className = "task-item__actions";
  actions.append(menuButton, removeButton);

  const controls = document.createElement("div");
  controls.className = "task-item__controls";
  controls.hidden = true;

  const daySelect = document.createElement("select");
  daySelect.className = "task-item__select";
  daySelect.dataset.action = "change-day";
  daySelect.setAttribute("aria-label", "Переместить задачу на другой день");

  VALID_DAYS.forEach((day) => {
    daySelect.append(createSelectOption(day, DAY_LABELS[day], task.day));
  });

  const categorySelect = document.createElement("select");
  categorySelect.className = "task-item__select";
  categorySelect.dataset.action = "change-category";
  categorySelect.setAttribute("aria-label", "Изменить категорию задачи");

  VALID_CATEGORIES.forEach((category) => {
    categorySelect.append(createSelectOption(category, CATEGORY_LABELS[category], task.category));
  });

  controls.append(daySelect, categorySelect);
  item.append(checkbox, text, actions, controls);

  return item;
}

function createCategoryBlock(day, category) {
  const categoryTasks = appState.tasks.filter(
    (task) => task.day === day && task.category === category
  );
  const block = document.createElement("section");
  block.className = "category-block";

  const header = document.createElement("div");
  header.className = "category-block__header";

  const title = document.createElement("h3");
  title.className = `category-block__title category-block__title--${CATEGORY_DOTS[category]}`;
  title.textContent = CATEGORY_LABELS[category];

  const count = document.createElement("span");
  count.className = "category-block__count";
  count.textContent = String(categoryTasks.length);

  const addButton = document.createElement("button");
  addButton.className = "category-block__add";
  addButton.type = "button";
  addButton.dataset.action = "add-category-task";
  addButton.dataset.day = day;
  addButton.dataset.category = category;
  addButton.setAttribute("aria-label", `Добавить задачу в категорию ${CATEGORY_LABELS[category]}`);
  addButton.textContent = "+";

  const headerActions = document.createElement("div");
  headerActions.className = "category-block__actions";
  headerActions.append(count, addButton);

  const list = document.createElement("ul");
  list.className = "category-block__list";

  if (categoryTasks.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "task-empty";
    emptyItem.textContent = "Пока пусто";
    list.append(emptyItem);
  } else {
    categoryTasks.forEach((task) => {
      list.append(createTaskItem(task));
    });
  }

  header.append(title, headerActions);
  block.append(header, list);

  return block;
}

function renderDay(day) {
  const card = document.querySelector(`.day-card[data-day="${day}"]`);

  if (!card) {
    return;
  }

  const dayTasks = appState.tasks.filter((task) => task.day === day);
  const completedDayTasks = dayTasks.filter((task) => task.completed).length;
  const dayProgress = dayTasks.length === 0 ? 0 : Math.round((completedDayTasks / dayTasks.length) * 100);
  card.innerHTML = "";

  const header = document.createElement("div");
  header.className = "day-card__header";

  const title = document.createElement("h2");
  title.textContent = DAY_LABELS[day];

  const count = document.createElement("span");
  count.className = "day-card__count";
  count.textContent = String(dayTasks.length);

  header.append(title, count);
  card.append(header);

  const progress = document.createElement("div");
  progress.className = "day-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", `Прогресс дня: ${DAY_LABELS[day]}`);
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", String(dayProgress));
  progress.style.setProperty("--day-progress", `${dayProgress}%`);
  progress.style.setProperty("--day-progress-color", getDayProgressColor(dayProgress));
  progress.style.setProperty("--day-progress-glow", `${0.18 + (dayProgress / 100) * 0.62}`);

  const progressMeta = document.createElement("div");
  progressMeta.className = "day-progress__meta";

  const progressText = document.createElement("span");
  progressText.textContent = `${dayProgress}% выполнено`;

  const progressCount = document.createElement("span");
  progressCount.textContent = `${completedDayTasks}/${dayTasks.length}`;

  const progressTrack = document.createElement("div");
  progressTrack.className = "day-progress__track";

  const progressValue = document.createElement("div");
  progressValue.className = "day-progress__value";

  progressTrack.append(progressValue);
  progressMeta.append(progressText, progressCount);
  progress.append(progressMeta, progressTrack);
  card.append(progress);

  VALID_CATEGORIES.forEach((category) => {
    card.append(createCategoryBlock(day, category));
  });
}

function renderTasks() {
  VALID_DAYS.forEach(renderDay);
  renderWeekSummary();
  renderProgress();
  renderWeekTools();
}

function getWeekMotivation(percent) {
  if (percent === 0) {
    return "Неделя только ждет первого шага. Начните с одной небольшой задачи.";
  }

  if (percent < 40) {
    return "Темп пока мягкий. Выберите главное и двигайтесь без перегруза.";
  }

  if (percent < 75) {
    return "Хорошая рабочая динамика. Еще немного фокуса - и неделя станет сильнее.";
  }

  if (percent < 100) {
    return "Очень достойный результат. Осталось закрыть несколько хвостов.";
  }

  return "Все задачи недели закрыты. Отличный финиш и чистая голова.";
}

function renderWeekSummary() {
  const card = document.querySelector("#week-summary-card");

  if (!card) {
    return;
  }

  const totalTasks = appState.tasks.length;
  const completedTasks = appState.tasks.filter((task) => task.completed).length;
  const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  card.innerHTML = "";

  const header = document.createElement("div");
  header.className = "week-summary-card__header";

  const title = document.createElement("h2");
  title.textContent = "Выводы недели";

  const badge = document.createElement("span");
  badge.textContent = `${percent}%`;

  header.append(title, badge);
  card.append(header);

  const list = document.createElement("div");
  list.className = "week-summary-card__list";

  VALID_CATEGORIES.forEach((category) => {
    const categoryTasks = appState.tasks.filter((task) => task.category === category);
    const completedCategoryTasks = categoryTasks.filter((task) => task.completed).length;
    const row = document.createElement("div");
    row.className = `week-summary-row week-summary-row--${category}`;

    row.innerHTML = `
      <span>${CATEGORY_LABELS[category]}</span>
      <strong>${completedCategoryTasks}/${categoryTasks.length}</strong>
      <small>выполнено из запланированных</small>
    `;
    list.append(row);
  });

  const motivation = document.createElement("p");
  motivation.className = "week-summary-card__motivation";
  motivation.textContent = getWeekMotivation(percent);

  card.append(list, motivation);
}

function getReflectionSummary(productivity, emotion) {
  const productivityHigh = productivity >= 4;
  const emotionHigh = emotion >= 4;

  if (!productivityHigh && !emotionHigh) {
    return "Неделя была тяжелой. Возможно, стоит снизить нагрузку.";
  }

  if (productivityHigh && !emotionHigh) {
    return "Много сделано, но есть риск выгорания.";
  }

  if (!productivityHigh && emotionHigh) {
    return "Неделя была ресурсной. Можно мягко вернуться к фокусу.";
  }

  return "Хороший баланс эффективности и состояния.";
}

function getReflectionHue(productivity, emotion) {
  const average = (productivity + emotion) / 2;
  return Math.round(220 + ((average - 1) / 4) * 120);
}

function getReflectionWidget(value) {
  if (value >= 4) {
    return "★";
  }

  if (value <= 2) {
    return "🥀";
  }

  return "•";
}

function getAverageReflectionWidget(averageValue) {
  if (averageValue <= 2) {
    return {
      icon: "🥀",
      state: "flower",
      text: "Вам нужен хороший отдых",
    };
  }

  if (averageValue < 3.9) {
    return {
      icon: "🐱",
      state: "kitten",
      text: "Спокойное восстановление",
    };
  }

  if (averageValue <= 4.5) {
    return {
      icon: "☀",
      state: "sun",
      text: "Теплая устойчивая неделя",
    };
  }

  return {
    icon: "★",
    state: "star",
    text: "Яркая сильная неделя",
  };
}

function renderReflection() {
  const card = document.querySelector(".reflection-card");
  const productivity = document.querySelector("#productivity-range");
  const emotion = document.querySelector("#emotion-range");
  const average = document.querySelector("#reflection-average");
  const summary = document.querySelector("#reflection-summary");
  const comment = document.querySelector("#reflection-comment");
  const productivityWidget = document.querySelector("#productivity-widget");
  const emotionWidget = document.querySelector("#emotion-widget");
  const averageWidget = document.querySelector("#reflection-average-widget");

  if (!card || !productivity || !emotion || !average || !summary || !comment) {
    return;
  }

  const productivityValue = Math.min(5, appState.reflection.productivity);
  const emotionValue = Math.min(5, appState.reflection.emotion);
  const rawAverageValue = (productivityValue + emotionValue) / 2;
  const averageValue = rawAverageValue.toFixed(1);
  productivity.value = String(productivityValue);
  emotion.value = String(emotionValue);
  average.textContent = `Средняя оценка: ${averageValue}/5`;
  summary.textContent = getReflectionSummary(productivityValue, emotionValue);

  if (averageWidget) {
    const widget = getAverageReflectionWidget(rawAverageValue);
    const icon = averageWidget.querySelector(".reflection-average-widget__icon");
    const text = averageWidget.querySelector(".reflection-average-widget__text");

    averageWidget.dataset.state = widget.state;

    if (icon) {
      icon.textContent = widget.icon;
    }

    if (text) {
      text.textContent = widget.text;
    }
  }

  if (productivityWidget) {
    productivityWidget.textContent = getReflectionWidget(productivityValue);
    productivityWidget.dataset.level = productivityValue >= 4 ? "high" : productivityValue <= 2 ? "low" : "middle";
  }

  if (emotionWidget) {
    emotionWidget.textContent = getReflectionWidget(emotionValue);
    emotionWidget.dataset.level = emotionValue >= 4 ? "high" : emotionValue <= 2 ? "low" : "middle";
  }

  if (document.activeElement !== comment) {
    comment.value = appState.reflection.comment;
  }
}

function updateReflection(updates) {
  appState.reflection = {
    ...appState.reflection,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveReflection();
  renderReflection();
}

function showAddError(message) {
  const error = document.querySelector(".form-error");

  if (error) {
    error.textContent = message;
  }
}

function clearAddError() {
  showAddError("");
}

function handleQuickAdd(event) {
  event.preventDefault();

  const input = document.querySelector("#quick-task-text");
  const daySelect = document.querySelector("#quick-task-day");
  const categorySelect = document.querySelector("#quick-task-category");
  const text = validateTaskText(input.value);
  const day = daySelect.value;
  const category = categorySelect.value;

  if (text === null || !VALID_DAYS.includes(day) || !VALID_CATEGORIES.includes(category)) {
    showAddError(VALIDATION_MESSAGE);
    return;
  }

  appState.tasks.push(createTask(text, day, category));
  saveTasks();
  renderTasks();
  clearAddError();
  input.value = "";
  input.focus();
}

function handleTaskClick(event) {
  const actionElement = event.target.closest("[data-action]");

  if (!actionElement) {
    return;
  }

  if (actionElement.dataset.action === "add-category-task") {
    const day = actionElement.dataset.day;
    const category = actionElement.dataset.category;
    const newText = window.prompt("Новая задача");

    if (newText === null) {
      return;
    }

    const validatedText = validateTaskText(newText);

    if (
      validatedText === null ||
      !VALID_DAYS.includes(day) ||
      !VALID_CATEGORIES.includes(category)
    ) {
      window.alert(VALIDATION_MESSAGE);
      return;
    }

    appState.tasks.push(createTask(validatedText, day, category));
    saveTasks();
    renderTasks();
    return;
  }

  const taskItem = actionElement.closest(".task-item");
  const task = taskItem ? getTaskById(taskItem.dataset.taskId) : null;

  if (!task) {
    return;
  }

  if (actionElement.dataset.action === "toggle-task-menu") {
    const controls = taskItem.querySelector(".task-item__controls");

    if (controls) {
      controls.hidden = !controls.hidden;
      actionElement.setAttribute("aria-expanded", String(!controls.hidden));
    }

    return;
  }

  if (actionElement.dataset.action === "delete" && window.confirm("Удалить задачу?")) {
    appState.tasks = appState.tasks.filter((item) => item.id !== task.id);
    saveTasks();
    renderTasks();
    return;
  }

  if (actionElement.dataset.action === "edit-text") {
    const newText = window.prompt("Изменить текст задачи", task.text);

    if (newText === null) {
      return;
    }

    const validatedText = validateTaskText(newText);

    if (validatedText === null) {
      window.alert(VALIDATION_MESSAGE);
      return;
    }

    updateTask(task, { text: validatedText });
    renderTasks();
  }
}

function handleTaskChange(event) {
  const control = event.target.closest("[data-action]");

  if (!control) {
    return;
  }

  const taskItem = control.closest(".task-item");
  const task = taskItem ? getTaskById(taskItem.dataset.taskId) : null;

  if (!task) {
    return;
  }

  if (control.dataset.action === "toggle-completed") {
    updateTask(task, { completed: control.checked });
    renderTasks();
    return;
  }

  if (control.dataset.action === "change-day" && VALID_DAYS.includes(control.value)) {
    updateTask(task, { day: control.value });
    renderTasks();
    return;
  }

  if (
    control.dataset.action === "change-category" &&
    VALID_CATEGORIES.includes(control.value)
  ) {
    updateTask(task, { category: control.value });
    renderTasks();
  }
}

function resetWeek() {
  appState = createInitialState();
  saveState();
  renderTasks();
  renderReflection();
}

function setupEvents() {
  const quickAdd = document.querySelector(".quick-add");
  const weekTools = document.querySelector(".week-tools");
  const weekGrid = document.querySelector(".week-grid");
  const resetButton = document.querySelector(".reset-button");
  const productivity = document.querySelector("#productivity-range");
  const emotion = document.querySelector("#emotion-range");
  const comment = document.querySelector("#reflection-comment");

  quickAdd.addEventListener("submit", handleQuickAdd);
  quickAdd.addEventListener("input", clearAddError);
  weekTools.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (action === "prev-week") {
      switchWeek(-1);
      return;
    }

    if (action === "next-week") {
      switchWeek(1);
      return;
    }

    if (action === "jump-week") {
      const offset = Number(event.target.closest("[data-action]").dataset.offset);

      if (Number.isFinite(offset)) {
        jumpToWeekOffset(offset);
      }

      return;
    }

    if (action === "export-pdf") {
      exportCurrentWeekToPdf();
      return;
    }

    if (action === "export-xls") {
      exportCurrentWeekToXls();
    }
  });
  weekGrid.addEventListener("click", handleTaskClick);
  weekGrid.addEventListener("change", handleTaskChange);

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (window.confirm("Очистить текущую неделю и начать заново?")) {
        resetWeek();
      }
    });
  }

  productivity.addEventListener("change", (event) => {
    updateReflection({ productivity: Number(event.target.value) });
  });

  emotion.addEventListener("change", (event) => {
    updateReflection({ emotion: Number(event.target.value) });
  });

  comment.addEventListener("input", (event) => {
    updateReflection({
      comment: event.target.value.slice(0, MAX_REFLECTION_COMMENT_LENGTH),
    });
  });
}

function initApp() {
  appState = loadState();
  saveState();
  setupEvents();
  renderTasks();
  renderReflection();
}

document.addEventListener("DOMContentLoaded", initApp);
