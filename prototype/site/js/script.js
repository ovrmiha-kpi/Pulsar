
// ==================================================
// PULSAR — CREW DASHBOARD
// ==================================================


// ==================================================
// LIVE CREW (prototype/server)
// ==================================================

let astronauts = [];

const STORAGE_KEY = "pulsar_live_crew_cache";

function upsertPerson(person) {
    if (!person || person.id == null) return;
    const id = String(person.id);
    const i = astronauts.findIndex((p) => String(p.id) === id);
    if (i >= 0) astronauts[i] = { ...astronauts[i], ...person };
    else astronauts.push(person);
}

const demoPulseProfiles = new Map();


// ==================================================
// ВІДНОВЛЕННЯ ІСТОРІЇ ПУЛЬСУ
// ==================================================

function restorePulseHistory(person) {

    if (person.pulseHistory !== undefined) {

        return person;

    }

    const demo = demoPulseProfiles.get(person.id);

    const matchesDemo =
        demo &&
        demo.name === person.name &&
        demo.pulse === person.pulse;

    return {

        ...person,

        pulseHistory: matchesDemo
            ? [...demo.history]
            : []

    };

}


// ==================================================
// ВІДНОВЛЕННЯ ДАНИХ ЗІ СХОВИЩА
// ==================================================

function restoreCrew() {

    try {

        const savedCrew =
            sessionStorage.getItem(STORAGE_KEY);

        if (savedCrew) {

            const parsedCrew = JSON.parse(savedCrew);

            if (Array.isArray(parsedCrew)) {

                astronauts.splice(

                    0,
                    astronauts.length,
                    ...parsedCrew.map(restorePulseHistory)

                );

            }

        }

    } catch (error) {

        console.error(
            "Cannot load demo crew:",
            error
        );

    }

}




// ==================================================
// ЗБЕРЕЖЕННЯ ДАНИХ
// ==================================================

function saveCrew() {

    try {

        sessionStorage.setItem(

            STORAGE_KEY,

            JSON.stringify(astronauts)

        );


        // ==========================================
        // NOTIFICATION CENTER
        // Повідомляємо про оновлення даних екіпажу
        // ==========================================

        document.dispatchEvent(

            new CustomEvent(

                "pulsar:crew-change",

                {

                    detail: {

                        crew: astronauts

                    }

                }

            )

        );

        return true;

    } catch (error) {

        console.error(
            "Cannot save demo crew:",
            error
        );

        return false;

    }

}


// ==================================================
// ПРІОРИТЕТИ СТАТУСІВ
// ==================================================

const priority = {

    Critical: 0,
    Warning: 1,
    Pending: 2,
    Normal: 3

};

let currentFilter = "All";


// ==================================================
// HTML-ЕЛЕМЕНТИ
// ==================================================

const crewGrid =
    document.getElementById("crew-grid");

const searchInput =
    document.getElementById("search");

const visibleCount =
    document.getElementById("visible-count");


// ==================================================
// ЕЛЕМЕНТИ ВЕРХНЬОЇ ПАНЕЛІ
// ==================================================

const menuToggle =
    document.getElementById("menu-toggle");

const crewMenu =
    document.getElementById("crew-menu");

const searchToggle =
    document.getElementById("search-toggle");

const searchPanel =
    document.getElementById("search-panel");

const searchClose =
    document.getElementById("search-close");


// ==================================================
// ЗАХИСТ ТЕКСТОВИХ ДАНИХ
// ==================================================

function escapeHTML(value) {

    return String(value ?? "—")

        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

}


// ==================================================
// ОНОВЛЕННЯ СТАТИСТИКИ
// ==================================================

function updateStatistics() {

    // Загальна кількість астронавтів

    document.getElementById("total-count")
        .textContent = astronauts.length;


    // Критичний стан

    document.getElementById("critical-count")
        .textContent = astronauts.filter(

            person => person.status === "Critical"

        ).length;


    // Попередження

    document.getElementById("warning-count")
        .textContent = astronauts.filter(

            person => person.status === "Warning"

        ).length;


    // Очікування даних

    document.getElementById("pending-count")
        .textContent = astronauts.filter(

            person => person.status === "Pending"

        ).length;


    // Нормальний стан

    document.getElementById("normal-count")
        .textContent = astronauts.filter(

            person => person.status === "Normal"

        ).length;

}


// ==================================================
// АДАПТИВНИЙ ГРАФІК ПУЛЬСУ
// ==================================================

function createPulseChart(person) {

    // Отримуємо останні 10 вимірювань

    const values = Array.isArray(person.pulseHistory)

        ? person.pulseHistory.slice(-10)

        : [];


    // Колір графіка залежно від статусу

    const statusClass = Object.hasOwn(
        priority,
        person.status
    )

        ? person.status.toLowerCase()

        : "pending";


    // ==============================================
    // ЯКЩО ІСТОРІЯ ВІДСУТНЯ
    // ==============================================

    if (

        values.length < 2 ||

        !values.every(Number.isFinite)

    ) {

        return `

            <div class="pulse-chart-container
                ${statusClass}">

                <div class="pulse-chart-header">

                    <span class="pulse-chart-title">

                        Heart Rate Trend

                    </span>

                </div>

                <div class="pulse-chart-empty">

                    No pulse history available

                </div>

            </div>

        `;

    }


    // ==============================================
    // СТВОРЕННЯ КОНТЕЙНЕРА ГРАФІКА
    // ==============================================

    // Сам графік малюватиметься після того,
    // як картка буде додана на сторінку.
    //
    // Це дозволяє визначити її фактичну ширину
    // та уникнути деформації SVG.

    return `

        <div class="pulse-chart-container
            ${statusClass}">

            <div class="pulse-chart-header">

                <span class="pulse-chart-title">

                    ♡ Heart Rate Trend (bpm)

                </span>

                <span class="pulse-chart-period">

                    Last ${values.length} samples

                </span>

            </div>


            <!-- АДАПТИВНИЙ SVG-ГРАФІК -->

            <svg

                class="pulse-chart"

                data-values="${values.join(",")}"

                style="
                    display: block;
                    width: 100%;
                    height: var(--pulse-responsive-height, 110px);
                    min-height: 90px;
                    flex-shrink: 0;
                "

                preserveAspectRatio="xMidYMid meet"

                role="img"

                aria-label="Demo heart rate history">

            </svg>


            <!-- ПІДПИСИ ОСІ X -->

            <div class="pulse-chart-labels">

                <span>Earlier</span>

                <span>Latest</span>

            </div>

        </div>

    `;

}


// ==================================================
// МАЛЮВАННЯ АДАПТИВНОГО ГРАФІКА
// ==================================================

function drawResponsivePulseChart(svg) {

    // Отримання значень пульсу

    const values = (svg.dataset.values || "")

        .split(",")
        .map(Number);


    // Перевірка отриманих даних

    if (

        values.length < 2 ||

        !values.every(Number.isFinite)

    ) {

        return;

    }


    // ==============================================
    // ФАКТИЧНІ РОЗМІРИ ГРАФІКА
    // ==============================================

    const width = svg.clientWidth;

    const height = svg.clientHeight;


    if (width < 80 || height < 80) {

        return;

    }


    // ==============================================
    // АДАПТИВНА СИСТЕМА КООРДИНАТ
    // ==============================================

    svg.setAttribute(

        "viewBox",

        `0 0 ${width} ${height}`

    );


    // ==============================================
    // ВІДСТУПИ ГРАФІКА
    // ==============================================

    const left = 42;

    const right = 12;

    const top = 12;

    const bottom = 12;


    const chartWidth = width - left - right;

    const chartHeight = height - top - bottom;


    // ==============================================
    // МЕЖІ ПОКАЗНИКІВ
    // ==============================================

    const min = Math.min(...values) - 5;

    const max = Math.max(...values) + 5;

    const range = max - min || 1;


    // ==============================================
    // КООРДИНАТИ ТОЧОК
    // ==============================================

    const points = values.map((value, index) => ({

        value,

        x: left +

            index / (values.length - 1) *

            chartWidth,

        y: top + chartHeight -

            (value - min) / range *

            chartHeight

    }));


    // ==============================================
    // ГОРИЗОНТАЛЬНА СІТКА
    // ==============================================

    let grid = "";

    const divisions = 3;

    for (let i = 0; i <= divisions; i++) {

        const y = top +

            i / divisions * chartHeight;


        const label = Math.round(

            max - i / divisions * range

        );


        grid += `

            <line

                class="pulse-chart-grid"

                x1="${left}"

                y1="${y}"

                x2="${width - right}"

                y2="${y}"

                stroke-width="1"

                stroke-dasharray="4 4"

            />

            <text

                x="${left - 9}"

                y="${y}"

                dominant-baseline="middle"

                text-anchor="end"

                style="
                    font-size: 12px;
                    font-weight: 400;
                "

                fill="#91a5bd">

                ${label}

            </text>

        `;

    }


    // ==============================================
    // ФОРМУВАННЯ ЛІНІЇ ГРАФІКА
    // ==============================================

    const linePoints = points

        .map(point => `${point.x},${point.y}`)

        .join(" ");


    // ==============================================
    // ТОЧКИ ВИМІРЮВАНЬ
    // ==============================================

    const circles = points.map((point, index) => `

        <circle

            class="pulse-point"

            cx="${point.x}"

            cy="${point.y}"

            r="${index === points.length - 1
                ? 3.5
                : 2.5}">

            <title>

                ${point.value} bpm

            </title>

        </circle>

    `).join("");


    // ==============================================
    // ГОТОВИЙ SVG-ГРАФІК
    // ==============================================

    svg.innerHTML = `

        ${grid}

        <polyline

            class="pulse-line"

            points="${linePoints}"

            fill="none"

            stroke-width="2.5"

            stroke-linecap="round"

            stroke-linejoin="round"

            vector-effect="non-scaling-stroke"

        />

        ${circles}

    `;

}


// ==================================================
// АВТОМАТИЧНЕ МАСШТАБУВАННЯ ГРАФІКІВ
// ==================================================

const pulseChartObserver =

    typeof ResizeObserver === "function"

        ? new ResizeObserver(entries => {

            entries.forEach(entry => {

                drawResponsivePulseChart(

                    entry.target

                );

            });

        })

        : null;


// ==================================================
// ПІДКЛЮЧЕННЯ АДАПТИВНИХ ГРАФІКІВ
// ==================================================

function setupResponsivePulseCharts() {

    // Припиняємо спостереження
    // за попередніми графіками.

    pulseChartObserver?.disconnect();


    // Знаходимо всі графіки на головній сторінці

    crewGrid.querySelectorAll(

        ".pulse-chart[data-values]"

    ).forEach(svg => {

        // Початкове малювання

        drawResponsivePulseChart(svg);


        // Спостереження за зміною розмірів

        pulseChartObserver?.observe(svg);

    });

}


// ==================================================
// РЕЗЕРВНЕ МАСШТАБУВАННЯ
// ==================================================

if (!pulseChartObserver) {

    window.addEventListener(

        "resize",

        setupResponsivePulseCharts

    );

}


// ==================================================
// СТВОРЕННЯ КАРТКИ АСТРОНАВТА
// ==================================================

function createAstronautCard(person) {

    const statusClass = Object.hasOwn(
        priority,
        person.status
    )

        ? person.status.toLowerCase()

        : "pending";


    // ==============================================
    // ІНІЦІАЛИ АСТРОНАВТА
    // ==============================================

    const initials = person.name

        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0])
        .join("");


    // Створення картки

    const card = document.createElement("article");

    card.className =
        `astronaut-card ${statusClass}`;


    // ==============================================
    // ПЕРЕВІРКА АКТИВНОГО SOS
    // ==============================================

    const sosActive = !!(person.sos || isSosActive(person.id));

    card.classList.toggle(

        "sos-active",

        sosActive

    );


    // ==============================================
    // ВМІСТ КАРТКИ АСТРОНАВТА
    // ==============================================

    card.innerHTML = `

        <!-- ІНФОРМАЦІЯ ПРО АСТРОНАВТА -->

        <div class="astronaut-header">

            <div class="avatar">

                ${escapeHTML(initials)}

            </div>

            <div class="astronaut-info">

                <h3>

                    ${escapeHTML(person.name)}

                </h3>

                <p>

                    ${escapeHTML(person.role)}

                </p>

            </div>

            <span class="status ${statusClass}">

                ● ${escapeHTML(person.status)}

            </span>

        </div>


        <!-- ======================================
             ОСНОВНІ ПОКАЗНИКИ
        ======================================= -->

        <div class="metrics">


            <!-- ПУЛЬС -->

            <div class="metric">

                <span class="metric-name">

                    Heart Rate

                </span>

                <span class="metric-value">

                    ${escapeHTML(person.pulse ?? "—")}

                </span>

                <span class="metric-unit">

                    bpm

                </span>

            </div>


            <!-- НАСИЧЕННЯ КРОВІ КИСНЕМ -->

            <div class="metric">

                <span class="metric-name">

                    SpO₂

                </span>

                <span class="metric-value">

                    ${escapeHTML(person.oxygen ?? "—")}

                </span>

                <span class="metric-unit">

                    %

                </span>

            </div>


            <!-- ТЕМПЕРАТУРА ШКІРИ -->

            <div class="metric">

                <span class="metric-name">

                    Skin Temperature

                </span>

                <span class="metric-value">

                    ${escapeHTML(person.temperature ?? "—")}

                </span>

                <span class="metric-unit">

                    °C

                </span>

            </div>

        </div>


        <!-- ======================================
             АДАПТИВНИЙ ГРАФІК ПУЛЬСУ
        ======================================= -->

        ${createPulseChart(person)}


        <!-- ======================================
             ПОПЕРЕДЖЕННЯ
        ======================================= -->

        <div class="alert-message ${statusClass}">

            ${escapeHTML(person.warning)}

        </div>


        <!-- ======================================
             АКТИВНИЙ SOS
        ======================================= -->

        ${sosActive ? `

            <div class="sos-active-banner">

                ⚠ SOS Activated — Simulation

            </div>

        ` : ""}


        <!-- ======================================
             СТАН ПРИСТРОЮ
        ======================================= -->

        <div class="device-info">

            <span class="${person.connected
                ? "connected"
                : ""}">

                ● ${person.connected

                    ? "Live"

                    : "Offline"}

            </span>

            <span>

                Battery:

                ${person.battery == null

                    ? "—"

                    : escapeHTML(person.battery) + "%"}

            </span>

        </div>


        <!-- ======================================
             КНОПКИ КАРТКИ
        ======================================= -->

        <div class="card-actions">

            <button class="details-button">

                View Details →

            </button>

            <button class="sos-button
                ${sosActive ? "is-active" : ""}">

                ${sosActive

                    ? "SOS Active"

                    : "SOS / Emergency"}

            </button>

        </div>

    `;


    // ==============================================
    // КНОПКА VIEW DETAILS
    // ==============================================

    card.querySelector(".details-button")

        .addEventListener("click", function () {

            openAstronaut(person.id);

        });


    // ==============================================
    // КНОПКА SOS
    // ==============================================

    card.querySelector(".sos-button")

        .addEventListener("click", function () {

            openEmergency(person.id);

        });


    // ==============================================
    // НАТИСКАННЯ НА ВСЮ КАРТКУ
    // ==============================================

    card.style.cursor = "pointer";

    card.addEventListener("click", function (event) {

        if (event.target.closest("button")) {

            return;

        }

        openAstronaut(person.id);

    });

    return card;

}


// ==================================================
// ВІДОБРАЖЕННЯ АСТРОНАВТІВ
// ==================================================

function renderAstronauts() {

    // Поточний пошуковий запит

    const search = searchInput.value

        .toLowerCase()
        .trim();


    // ==============================================
    // ФІЛЬТРАЦІЯ АСТРОНАВТІВ
    // ==============================================

    const filteredAstronauts = astronauts.filter(person => {

        const matchesStatus =

            currentFilter === "All" ||

            person.status === currentFilter;

        const matchesSearch =

            String(person.name || "").toLowerCase().includes(search) ||
            String(person.id || "").toLowerCase().includes(search);

        return matchesStatus && matchesSearch;

    });


    // ==============================================
    // СОРТУВАННЯ ЗА КРИТИЧНІСТЮ
    // ==============================================

    filteredAstronauts.sort((a, b) => {

        return (priority[a.status] ?? 2) -

               (priority[b.status] ?? 2);

    });


    // Очищення попередніх карток

    crewGrid.innerHTML = "";


    // ==============================================
    // АДАПТИВНЕ РОЗТАШУВАННЯ КАРТОК
    // ==============================================

    const count = filteredAstronauts.length;

    let columns;


    // Один або два астронавти

    if (count <= 2) {

        columns = Math.max(1, count);

    }


    // Три або чотири астронавти

    else if (count <= 4) {

        columns = 2;

    }


    // П'ять або шість астронавтів

    else if (count <= 6) {

        columns = 3;

    }


    // Сім і більше астронавтів

    else {

        columns = 4;

    }


    // Передаємо кількість стовпчиків у CSS

    crewGrid.style.setProperty(

        "--crew-columns",

        columns

    );


    // Компактний режим від п'яти астронавтів

    crewGrid.classList.toggle(

        "compact",

        count > 4

    );


    // Максимально компактний режим від семи

    crewGrid.classList.toggle(

        "extra-compact",

        count > 6

    );


    // ==============================================
    // СТВОРЕННЯ КАРТОК
    // ==============================================

    filteredAstronauts.forEach(person => {

        crewGrid.appendChild(

            createAstronautCard(person)

        );

    });


    // Кількість видимих астронавтів

    visibleCount.textContent =

        `${filteredAstronauts.length} astronauts`;


    // ==============================================
    // ЯКЩО НІКОГО НЕ ЗНАЙДЕНО
    // ==============================================

    if (filteredAstronauts.length === 0) {

        crewGrid.innerHTML = `

            <p class="empty-message">

                No astronauts found

            </p>

        `;

    }


    // ==============================================
    // АДАПТИВНЕ МАСШТАБУВАННЯ ГРАФІКІВ
    // ==============================================

    setupResponsivePulseCharts();


    // ==============================================
    // ОНОВЛЕННЯ СТАТИСТИКИ
    // ==============================================

    updateStatistics();


    // ==============================================
    // ЗБЕРЕЖЕННЯ ДАНИХ
    // ==============================================

    // saveCrew() також повідомляє Notification Center
    // про актуальний стан усього екіпажу.

    saveCrew();

}


// ==================================================
// ВИПАДАЮЧЕ МЕНЮ СТАТИСТИКИ
// ==================================================


// Закриття меню

function closeCrewMenu() {

    crewMenu.hidden = true;

    menuToggle.classList.remove("active");

    menuToggle.setAttribute(

        "aria-expanded",

        "false"

    );

}


// Відкриття меню

function openCrewMenu() {

    // Закриваємо центр сповіщень

    window.PulsarNotifications?.closePanel();


    // Закриваємо пошук

    closeCrewSearch();


    // Відкриваємо статистику

    crewMenu.hidden = false;

    menuToggle.classList.add("active");

    menuToggle.setAttribute(

        "aria-expanded",

        "true"

    );

}


// ==================================================
// НАТИСКАННЯ НА ТРИ РИСОЧКИ
// ==================================================

menuToggle.addEventListener("click", function () {

    if (crewMenu.hidden) {

        openCrewMenu();

    } else {

        closeCrewMenu();

    }

});


// ==================================================
// ЗАКРИТТЯ ПРИ НАТИСКАННІ ПОЗА МЕНЮ
// ==================================================

document.addEventListener("click", function (event) {

    if (

        !crewMenu.contains(event.target) &&

        !menuToggle.contains(event.target)

    ) {

        closeCrewMenu();

    }

});


// ==================================================
// КОМПАКТНИЙ ПОШУК
// ==================================================


// Відкриття поля пошуку

function openCrewSearch() {

    // Закриваємо центр сповіщень

    window.PulsarNotifications?.closePanel();


    // Закриваємо меню статистики

    closeCrewMenu();


    // Відкриваємо пошук

    searchPanel.hidden = false;

    searchToggle.classList.add("active");

    searchToggle.setAttribute(

        "aria-expanded",

        "true"

    );

    searchInput.focus();

}


// Закриття поля пошуку

function closeCrewSearch() {

    searchPanel.hidden = true;

    searchToggle.classList.remove("active");

    searchToggle.setAttribute(

        "aria-expanded",

        "false"

    );


    // Очищення пошукового запиту

    if (searchInput.value !== "") {

        searchInput.value = "";

        renderAstronauts();

    }

}


// ==================================================
// НАТИСКАННЯ НА ЛУПУ
// ==================================================

searchToggle.addEventListener("click", function () {

    if (searchPanel.hidden) {

        openCrewSearch();

    } else {

        closeCrewSearch();

    }

});


// ==================================================
// НАТИСКАННЯ НА ХРЕСТИК ПОШУКУ
// ==================================================

searchClose.addEventListener("click", function () {

    closeCrewSearch();

    searchToggle.focus();

});


// ==================================================
// ПОШУК ПІД ЧАС ВВЕДЕННЯ ТЕКСТУ
// ==================================================

searchInput.addEventListener("input", function () {
    renderAstronauts();
    clearTimeout(searchInput._uiTimer);
    searchInput._uiTimer = setTimeout(persistMissionUi, 400);
});


// ==================================================
// ФІЛЬТРАЦІЯ АСТРОНАВТІВ
// ==================================================

document.querySelectorAll("[data-filter]")

    .forEach(button => {

        button.addEventListener("click", function () {

            // Зберігаємо вибраний фільтр

            currentFilter = button.dataset.filter;
            persistMissionUi();


            // Виділення активного фільтра

            document.querySelectorAll(".filter-button")

                .forEach(filterButton => {

                    const isActive =

                        filterButton.dataset.filter ===

                        currentFilter;

                    filterButton.classList.toggle(

                        "active",

                        isActive

                    );

                    filterButton.setAttribute(

                        "aria-pressed",

                        String(isActive)

                    );

                });


            // Оновлення карток

            renderAstronauts();


            // Закриття випадаючого меню

            closeCrewMenu();

            menuToggle.focus();

        });

    });


// ==================================================
// ЗАКРИТТЯ МЕНЮ ТА ПОШУКУ
// ЗА ДОПОМОГОЮ ESCAPE
// ==================================================

document.addEventListener("keydown", function (event) {

    if (event.key !== "Escape") {

        return;

    }


    // Не втручаємося в роботу модальних вікон

    if (document.querySelector("dialog[open]")) {

        return;

    }


    // Закриття випадаючого меню

    if (!crewMenu.hidden) {

        closeCrewMenu();

        menuToggle.focus();

        return;

    }


    // Закриття пошуку

    if (!searchPanel.hidden) {

        closeCrewSearch();

        searchToggle.focus();

    }

});


// ==================================================
// ДЕТАЛЬНА ІНФОРМАЦІЯ ПРО АСТРОНАВТА
// ==================================================

function openAstronaut(id) {

    // Зберігаємо актуальні дані

    if (!saveCrew()) {

        alert("Demo storage is unavailable.");

        return;

    }


    // Перехід до індивідуальної панелі

    window.location.href =

        `pages/astronaut.html?id=${encodeURIComponent(id)}`;

}


// ==================================================
// SOS — ЕКСТРЕНА ДОПОМОГА
// ==================================================

function openEmergency(id) {

    const person = astronauts.find(

        astronaut => astronaut.id === id

    );

    if (person) {

        openSosDialog(person);

    }

}


// ==================================================
// ПОЧАТКОВИЙ ЗАПУСК
// ==================================================


// Початковий стан верхньої панелі

closeCrewMenu();

closeCrewSearch();


// Початковий стан фільтрів

document.querySelectorAll(".filter-button")

    .forEach(button => {

        const isActive =

            button.dataset.filter === currentFilter;

        button.classList.toggle(

            "active",

            isActive

        );

        button.setAttribute(

            "aria-pressed",

            String(isActive)

        );

    });


renderAstronauts();

document.addEventListener("pulsar:sos-change", renderAstronauts);

function persistMissionUi() {
    if (window.PulsarLive?.putMissionUi) {
        window.PulsarLive.putMissionUi({
            filter: currentFilter,
            search: searchInput?.value || "",
        }).catch(() => {});
    }
}

function applyMissionUi(ui) {
    if (!ui) return;
    if (ui.filter) {
        currentFilter = ui.filter;
        document.querySelectorAll(".filter-button").forEach((button) => {
            const isActive = button.dataset.filter === currentFilter;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }
    if (ui.search != null && searchInput && searchInput.value !== ui.search) {
        searchInput.value = ui.search;
    }
    renderAstronauts();
}

if (window.PulsarLive) {
    window.PulsarLive.connect({
        linkEl: document.getElementById("link-chip"),
        onDashboard(crew) {
            astronauts.splice(0, astronauts.length, ...(Array.isArray(crew) ? crew : []));
            saveCrew();
            renderAstronauts();
        },
        onSample(person) {
            upsertPerson(person);
            saveCrew();
            renderAstronauts();
        },
        onUi(ui) {
            applyMissionUi(ui);
        },
    });
}


// ==================================================
// CREW ENVIRONMENTAL ANALYSIS
// ПРИЙМАННЯ ДАНИХ ДЛЯ СПІЛЬНОГО АНАЛІЗУ
// ==================================================


// Окреме сховище параметрів космічного модуля

const HABITAT_STORAGE_KEY = "pulsar_habitat_data";


// ==================================================
// ПЕРЕВІРКА ТА НОРМАЛІЗАЦІЯ ВИМІРЮВАНЬ
// ==================================================

function normalizeObservation(record, keys) {

    // ==============================================
    // ПЕРЕВІРКА ДЖЕРЕЛА, ЯКОСТІ ТА ІДЕНТИФІКАТОРА
    // ==============================================

    if (

        !record ||

        record.source !== "actual" ||

        record.quality !== "valid" ||

        typeof record.habitatId !== "string" ||

        !record.habitatId.trim()

    ) {

        return null;

    }


    // ==============================================
    // ПЕРЕВІРКА ЧАСОВОЇ МІТКИ
    // ==============================================

    // Підтримуються числові часові мітки
    // у мілісекундах або ISO-дати
    // з указаним часовим поясом.

    const timestamp = typeof record.timestamp === "number"

        ? record.timestamp

        : typeof record.timestamp === "string" &&

            /(?:Z|[+-]\d{2}:\d{2})$/i.test(record.timestamp)

                ? Date.parse(record.timestamp)

                : NaN;


    // Відхиляємо некоректні та майбутні дати.

    if (

        !Number.isFinite(timestamp) ||

        timestamp <= 0 ||

        timestamp > Date.now()

    ) {

        return null;

    }


    // ==============================================
    // ОСНОВНА ІНФОРМАЦІЯ ПРО ВИМІРЮВАННЯ
    // ==============================================

    const result = {

        source: "actual",

        quality: "valid",

        habitatId: record.habitatId,

        timestamp

    };


    // ==============================================
    // ПЕРЕВІРКА ОКРЕМИХ ПОКАЗНИКІВ
    // ==============================================

    for (const key of keys) {

        if (!Object.hasOwn(record, key)) {

            continue;

        }


        const value = record[key];


        // ==========================================
        // СТРУКТУРОВАНІ СИМПТОМИ
        // ==========================================

        if (key === "symptoms") {

            if (

                !Array.isArray(value) ||

                !value.every(v =>

                    typeof v === "string" &&

                    v.trim()

                )

            ) {

                return null;

            }


            // Нормалізація тексту симптомів
            // та видалення повторів.

            result[key] = [

                ...new Set(

                    value.map(v =>

                        v.trim().toLowerCase()

                    )

                )

            ];

        }


        // ==========================================
        // ЯКІСТЬ ПОВІТРЯ
        // ==========================================

        else if (key === "airQuality") {

            if (

                value !== null &&

                (

                    typeof value !== "string" ||

                    !value.trim()

                )

            ) {

                return null;

            }

            result[key] = value;

        }


        // ==========================================
        // ЧИСЛОВІ ПОКАЗНИКИ
        // ==========================================

        else {

            if (

                value !== null &&

                (

                    typeof value !== "number" ||

                    !Number.isFinite(value) ||

                    (

                        ["oxygen", "airOxygen"].includes(key) &&

                        (value < 0 || value > 100)

                    ) ||

                    (

                        [

                            "pulse",

                            "pressure",

                            "airTemperature"

                        ].includes(key) &&

                        value <= 0

                    ) ||

                    (

                        ["co2", "radiation"].includes(key) &&

                        value < 0

                    )

                )

            ) {

                return null;

            }

            result[key] = value;

        }

    }


    // ==============================================
    // ПОВЕРНЕННЯ ПЕРЕВІРЕНОГО ЗАПИСУ
    // ==============================================

    // Запис повинен містити хоча б одне
    // передане поле вимірювання.

    return keys.some(key =>

        Object.hasOwn(result, key)

    )

        ? result

        : null;

}


// ==================================================
// ОБ'ЄДНАННЯ ІСТОРІЇ ВИМІРЮВАНЬ
// ==================================================

function mergeObservations(previous, incoming) {

    const records = new Map();


    // Об'єднуємо попередні та нові вимірювання.

    for (const record of [

        ...(Array.isArray(previous) ? previous : []),

        ...incoming

    ]) {

        // Не змішуємо демонстраційні
        // та фактичні спостереження.

        if (!record || record.source !== "actual") {

            continue;

        }


        // Унікальний ключ спостереження:
        // космічний модуль + час вимірювання.

        const key = JSON.stringify([

            record.habitatId,

            record.timestamp

        ]);


        // Якщо запис із таким часом уже існує,
        // доповнюємо його новими полями.

        records.set(key, {

            ...records.get(key),

            ...record

        });

    }


    // Повертаємо історію в хронологічному порядку.

    return [...records.values()].sort(

        (a, b) => a.timestamp - b.timestamp

    );

}


// ==================================================
// ОНОВЛЕННЯ ДАНИХ КОСМІЧНОГО МОДУЛЯ
// ==================================================

function updateHabitatData(payload) {

    // ==============================================
    // ПЕРЕВІРКА ФОРМАТУ ОТРИМАНИХ ДАНИХ
    // ==============================================

    if (

        !payload ||

        payload.source !== "actual" ||

        typeof payload.habitatId !== "string" ||

        !payload.habitatId.trim() ||

        !Array.isArray(payload.environment)

    ) {

        return false;

    }


    // ==============================================
    // ДОЗВОЛЕНІ ПОКАЗНИКИ СЕРЕДОВИЩА
    // ==============================================

    const keys = [

        // Вуглекислий газ — ppm

        "co2",


        // Концентрація кисню — %

        "airOxygen",


        // Атмосферний тиск — kPa

        "pressure",


        // Температура повітря — K

        "airTemperature",


        // Потужність дози опромінення — µSv/h

        "radiation",


        // Якість повітря — стан датчика

        "airQuality"

    ];


    // ==============================================
    // ПЕРЕВІРКА ВСІХ ВИМІРЮВАНЬ
    // ==============================================

    const records = payload.environment.map(record =>

        normalizeObservation(record, keys)

    );


    // Перевіряємо, що всі вимірювання
    // належать одному космічному модулю.

    if (records.some(record =>

        !record ||

        record.habitatId !== payload.habitatId

    )) {

        return false;

    }


    // ==============================================
    // ЗБЕРЕЖЕННЯ ДАНИХ СЕРЕДОВИЩА
    // ==============================================

    try {

        const previous = JSON.parse(

            sessionStorage.getItem(

                HABITAT_STORAGE_KEY

            ) || "null"

        );


        // Чи належать нові дані тому самому модулю?

        const same =

            previous?.source === "actual" &&

            previous.habitatId === payload.habitatId;


        // ==========================================
        // ФОРМУВАННЯ СПІЛЬНОГО ОБ'ЄКТА СЕРЕДОВИЩА
        // ==========================================

        const data = {

            source: "actual",

            habitatId: payload.habitatId,


            // Назва космічного модуля

            habitatName:

                typeof payload.habitatName === "string"

                    ? payload.habitatName

                    : (

                        same

                            ? previous.habitatName

                            : payload.habitatId

                    ),


            // Історія параметрів середовища

            environment: mergeObservations(

                same ? previous.environment : [],

                records

            ),


            // Критерії аналізу, отримані від сервера.
            //
            // Умовні демонстраційні пороги
            // автоматично не підставляються.

            criteria:

                Object.hasOwn(payload, "criteria")

                    ? payload.criteria

                    : (

                        same

                            ? previous.criteria

                            : {}

                    )

        };


        // ==========================================
        // ЗБЕРЕЖЕННЯ У SESSION STORAGE
        // ==========================================

        sessionStorage.setItem(

            HABITAT_STORAGE_KEY,

            JSON.stringify(data)

        );
        if (window.PulsarLive?.putHabitat) {
            window.PulsarLive.putHabitat(data).catch(() => {});
        }


        // ==========================================
        // ПОВІДОМЛЕННЯ ПРО ОНОВЛЕННЯ СЕРЕДОВИЩА
        // ==========================================

        document.dispatchEvent(

            new CustomEvent(

                "pulsar:habitat-change",

                {

                    detail: {

                        habitatId: data.habitatId

                    }

                }

            )

        );

        return true;

    } catch (error) {

        console.error(

            "Cannot save habitat data:",

            error

        );

        return false;

    }

}


// ==================================================
// ОНОВЛЕННЯ ДАНИХ ЕКІПАЖУ
// ДЛЯ МАЙБУТНЬОЇ ІНТЕГРАЦІЇ ІЗ СЕРВЕРОМ
// ==================================================

function updateCrewData(updates) {

    // Перевірка формату отриманих даних

    if (!Array.isArray(updates)) {

        return false;

    }


    // Оновлення даних кожного астронавта

    updates.forEach(update => {

        if (!update || typeof update !== "object") {

            return;

        }


        // Знаходимо відповідного астронавта

        const person = astronauts.find(

            item => String(item.id) === String(update.id)

        );

        if (!person) {

            return;

        }


        // ==========================================
        // ПОКАЗНИКИ, ЯКІ МОЖНА ОНОВЛЮВАТИ
        // ==========================================

        const keys = [

            // Статус здоров'я

            "status",

            "warning",


            // Основні фізичні показники

            "pulse",

            "oxygen",

            "temperature",

            "mass",

            "gripStrength",

            "gripHand",

            "restingHeartRate",


            // Стан пристрою

            "battery",

            "connected",


            // Історія вимірювань

            "pulseHistory",

            "history",

            "alertHistory",


            // Рухова активність

            "acceleration",

            "movement",

            "activity",


            // Самопочуття

            "sleepDuration",

            "sleepQuality",

            "stressLevel",


            // Навколишнє середовище

            "pressure",

            "airTemperature",

            "airOxygen",

            "airQuality",

            "co2",


            // Радіація

            "radiation",

            "radiationDose"

        ];


        // ==========================================
        // CREW ENVIRONMENTAL ANALYSIS
        // СИНХРОНІЗОВАНІ СПОСТЕРЕЖЕННЯ ЗДОРОВ'Я
        // ==========================================

        if (Object.hasOwn(update, "healthObservations")) {

            // Перевіряємо формат історії.

            if (!Array.isArray(update.healthObservations)) {

                return;

            }


            // Перевіряємо всі нові спостереження.

            const records = update.healthObservations.map(

                record => normalizeObservation(

                    record,

                    [

                        "pulse",

                        "oxygen",

                        "temperature",

                        "symptoms"

                    ]

                )

            );


            // Некоректні записи не зберігаємо.

            if (records.some(record => !record)) {

                return;

            }


            // Доповнюємо історію спостережень.
            //
            // Не видаляємо попередні вимірювання,
            // коли надходять нові.

            person.healthObservations = mergeObservations(

                person.healthObservations,

                records

            );

        }


        // ==========================================
        // ОНОВЛЕННЯ ЗВИЧАЙНИХ ПОКАЗНИКІВ
        // ==========================================

        keys.forEach(key => {

            if (Object.hasOwn(update, key)) {

                person[key] = update[key];

            }

        });

    });


    // ==============================================
    // ОНОВЛЕННЯ ГОЛОВНОЇ СТОРІНКИ
    // ==============================================

    // renderAstronauts():
    //
    // 1. Оновлює картки астронавтів.
    // 2. Перемальовує графіки.
    // 3. Оновлює статистику.
    // 4. Викликає saveCrew().
    // 5. Повідомляє Notification Center.

    renderAstronauts();

    return true;

}


// ==================================================
// ПІДКЛЮЧЕННЯ ДО ІНШИХ МОДУЛІВ
// ==================================================

window.PulsarCrew = Object.freeze({

    // Оновлення показників астронавтів

    updateCrewData,


    // Оновлення параметрів космічного модуля

    updateHabitatData

});


// ==================================================
// КІНЕЦЬ CREW DASHBOARD
// ==================================================
