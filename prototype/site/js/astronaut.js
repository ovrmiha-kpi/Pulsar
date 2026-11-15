// ==============================
// ОТРИМАННЯ ID ПРИСТРОЮ
// ==============================

const params = new URLSearchParams(window.location.search);

const astronautId = params.get("id");
const requestedSection = params.get("section");

let crew = [];
/** @type {any} */
let astronaut = null;


// ==============================
// HTML-ЕЛЕМЕНТИ
// ==============================

const sectionContent =
    document.getElementById("section-content");

const sectionTitle =
    document.getElementById("section-title");

const sectionDescription =
    document.getElementById("section-description");


// ==============================
// ДОПОМІЖНІ ФУНКЦІЇ
// ==============================

function escapeHTML(value) {

    return String(value ?? "—")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

}


function getStatusClass(status) {

    const statuses = [
        "Critical", "Warning", "Pending", "Normal"
    ];

    return statuses.includes(status)

        ? status.toLowerCase()

        : "pending";

}


function saveCrew() {
    return true;
}


// ==============================
// ПРОФІЛЬ АСТРОНАВТА
// ==============================

function renderProfile() {

    const initials = astronaut.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0])
        .join("");

    document.getElementById("profile-avatar")
        .textContent = initials;

    document.getElementById("profile-name")
        .textContent = astronaut.name;

    document.getElementById("profile-role")
        .textContent = astronaut.role;

    document.getElementById("profile-id")
        .textContent =
            String(astronaut.device_no || astronaut.id);

    const statusElement =
        document.getElementById("profile-status");

    statusElement.textContent =
        `${astronaut.status}`;

    statusElement.className =
        `status ${getStatusClass(astronaut.status)}`;

    document.title = `PULSAR | ${astronaut.name}`;

}


// ==============================
// ІНФОРМАЦІЯ ПРО РОЗДІЛИ
// ==============================

const sections = {

    health: {
        title: "Health Monitoring",
        description:
            "Physical health and daily well-being"
    },

    environment: {
        title: "Environment",
        description:
            "Environmental conditions and radiation exposure"
    },

    analytics: {
        title: "Analytics",
        description:
            "Measurement history and individual health trends"
    },

    guide: {
        title: "Health Guide",
        description:
            "Understand your health beyond Earth"
    },

    settings: {
        title: "Settings",
        description:
            "Medical card, reminders and preferences"
    }

};


// ==============================
// НАВІГАЦІЯ
// ==============================

function openSection(section) {

    if (!Object.hasOwn(sections, section)) {
        section = "health";
    }

    sectionTitle.textContent =
        sections[section].title;

    sectionDescription.textContent =
        sections[section].description;


    // Виділення активного пункту меню

    document.querySelectorAll(".nav-button")
        .forEach(button => {

            const isActive =
                button.dataset.section === section;

            button.classList.toggle(
                "active",
                isActive
            );

            button.setAttribute(
                "aria-current",
                isActive ? "true" : "false"
            );

        });


    // Відображення відповідного розділу

    switch (section) {

        case "health":
            renderHealth();
            break;

        case "environment":
            renderEnvironment();
            break;

        case "analytics":
            renderAnalytics();
            break;

        case "guide":
            renderGuide();
            break;

        case "settings":
            renderSettings();
            break;

    }


    // Оновлення адреси

    const url = new URL(window.location.href);

    url.searchParams.set("section", section);

    window.history.replaceState({}, "", url);

}


// ==============================
// УНІВЕРСАЛЬНА КАРТКА ПОКАЗНИКА
// ==============================

function createIndicator(indicator) {

    const hasValue =

        indicator.value !== null &&

        indicator.value !== undefined &&

        indicator.value !== "" &&

        (
            typeof indicator.value !== "number" ||
            Number.isFinite(indicator.value)
        );


    return `

        <article class="indicator-card">

            <span class="indicator-icon"
                  aria-hidden="true">

                ${escapeHTML(indicator.icon)}

            </span>

            <h4>${escapeHTML(indicator.name)}</h4>

            <div class="indicator-reading">

                <strong>

                    ${hasValue
                        ? escapeHTML(indicator.value)
                        : "—"}

                </strong>

                <span>${escapeHTML(indicator.unit)}</span>

            </div>

            <p class="indicator-description">

                ${escapeHTML(indicator.description)}

            </p>

            <small class="indicator-source">

                ${hasValue
                    ? "Last server reading"
                    : "Awaiting measurement"}

            </small>

        </article>

    `;

}


// ==============================
// ДОВІДКОВА ІНФОРМАЦІЯ
// ==============================

const healthMetadata = {

    "Heart Rate": {

        key: "pulse",
        source: "Heart rate sensor",

        description:
            "Number of heartbeats per minute.",

        measurement:
            "Use a compatible heart rate sensor according " +
            "to its operating instructions.",

        importance:
            "Heart rate can change with activity, stress " +
            "and health conditions."

    },

    "Blood Oxygen": {

        key: "oxygen",
        source: "Pulse oximeter",

        description:
            "Peripheral blood oxygen saturation (SpO₂).",

        measurement:
            "Use a compatible pulse oximeter.",

        importance:
            "Provides information about blood oxygenation."

    },

    "Skin Temperature": {

        key: "temperature",
        source: "Skin temperature sensor",

        description:
            "Temperature at the surface of the body.",

        measurement:
            "Use a compatible skin-contact temperature sensor.",

        importance:
            "Tracks skin temperature changes. It is not " +
            "equivalent to core body temperature."

    },

    "Body Mass": {

        key: "mass",
        source: "Specialized instrument",

        description:
            "Mass of the astronaut.",

        measurement:
            "Use an instrument suitable for the mission's " +
            "gravity conditions.",

        importance:
            "Helps track physical changes during missions."

    },

    "Grip Strength": {

        key: "gripStrength",
        source: "Grip dynamometer",

        description:
            "Force produced by the hand muscles.",

        measurement:
            "Use a suitable grip dynamometer and " +
            "an approved measurement procedure.",

        importance:
            "Helps track muscular performance."

    },

    "Acceleration": {

        key: "acceleration",
        source: "Accelerometer",

        description:
            "Rate of change of velocity.",

        measurement:
            "Data obtained from the accelerometer.",

        importance:
            "Helps characterize movement and activity."

    },

    "Body Movement": {

        key: "movement",
        source: "Motion sensor",

        description:
            "Movement detected by the wearable device.",

        measurement:
            "Use supported motion sensor data.",

        importance:
            "Supports movement monitoring. A wrist sensor " +
            "does not directly measure all body movements."

    },

    "Physical Activity": {

        key: "activity",
        source: "Processed motion data",

        description:
            "Recorded physical activity level.",

        measurement:
            "Use activity estimates from the approved system.",

        importance:
            "Helps visualize changes in daily activity."

    }

};


// ==============================
// ФІЗИЧНІ ПОКАЗНИКИ
// ==============================

function getHealthIndicators() {

    return [

        {
            name: "Heart Rate",
            value: astronaut.pulse,
            unit: "bpm",
            icon: "",
            description: "Current heart rate"
        },

        {
            name: "Blood Oxygen",
            value: astronaut.oxygen,
            unit: "%",
            icon: "O₂",
            description: "Blood oxygen saturation (SpO₂)"
        },

        {
            name: "Skin Temperature",
            value: astronaut.temperature,
            unit: "°C",
            icon: "",
            description: "Temperature measured at the skin"
        },

        {
            name: "Body Mass",
            value: astronaut.mass,
            unit: "kg",
            icon: "",
            description: "Body mass measurement"
        },

        {
            name: "Grip Strength",
            value: astronaut.gripStrength,
            unit: "N",
            icon: "",
            description: "Hand grip force"
        },

        {
            name: "Acceleration",
            value: astronaut.acceleration,
            unit: "m/s²",
            icon: "",
            description: "Accelerometer measurement"
        },

        {
            name: "Body Movement",
            value: astronaut.movement,
            unit: "",
            icon: "",
            description: "Device-recorded movement"
        },

        {
            name: "Physical Activity",
            value: astronaut.activity,
            unit: "",
            icon: "",
            description: "Physical activity level"
        }

    ];

}


// ==============================
// HEALTH MONITORING
// ==============================

function renderHealth() {

    const cards = getHealthIndicators()

        .map(createIndicator)

        .join("");


    sectionContent.innerHTML = `

        <div class="health-layout">


            <!-- ЛІВИЙ БЛОК -->

            <section class="health-panel">

                <div class="panel-heading">

                    <h3>Physical Health</h3>

                    <p>
                        Current physiological and activity data
                    </p>

                </div>

                <div class="indicator-grid physical-grid">

                    ${cards}

                </div>


                <div class="information-panel
                    ${getStatusClass(astronaut.status)}">

                    <h3>Current Alert Status</h3>

                    <p>${escapeHTML(astronaut.warning)}</p>

                </div>

            </section>


            <!-- ПРАВИЙ БЛОК -->

            <div class="wellbeing-column">

                ${createWellbeingPanel()}


                <section class="health-panel">

                    <div class="panel-heading">

                        <h3>Daily Check-in</h3>

                        <p>How are you feeling today?</p>

                    </div>

                    ${createCheckinForm()}

                </section>

            </div>

        </div>

    `;


    setupCheckin();

}


// ==============================
// WELL-BEING MONITORING
// ==============================

function createWellbeingPanel() {

    const sleepDuration = astronaut.sleepDuration;

    const sleepQuality = astronaut.sleepQuality;

    const stressLevel = astronaut.stressLevel;


    // Перевірка даних

    const hasSleep =

        Number.isFinite(sleepDuration) &&

        sleepDuration >= 0 && sleepDuration <= 24;


    const hasQuality =

        typeof sleepQuality === "string" &&

        sleepQuality.trim() !== "";


    const hasStress =

        Number.isFinite(stressLevel) &&

        stressLevel >= 0 && stressLevel <= 10;


    const stressPercent = hasStress

        ? stressLevel * 10

        : 0;


    return `

        <section class="health-panel">

            <div class="panel-heading">

                <h3>Well-being Monitoring</h3>

                <p>Automatic health data</p>

            </div>


            <div class="wellbeing-grid">


                <!-- Тривалість сну -->

                <article class="indicator-card">

                    <span class="indicator-icon"></span>

                    <h4>Sleep Duration</h4>

                    <div class="indicator-reading">

                        <strong>

                            ${hasSleep
                                ? escapeHTML(sleepDuration)
                                : "—"}

                        </strong>

                        <span>hours</span>

                    </div>

                    <small class="indicator-source">

                        ${hasSleep
                            ? "Automatic estimate"
                            : "Awaiting measurement"}

                    </small>

                </article>


                <!-- Якість сну -->

                <article class="indicator-card">

                    <span class="indicator-icon"></span>

                    <h4>Sleep Quality</h4>

                    <div class="indicator-reading">

                        <strong>

                            ${hasQuality
                                ? escapeHTML(sleepQuality)
                                : "—"}

                        </strong>

                    </div>

                    <small class="indicator-source">

                        ${hasQuality
                            ? "Automatic estimate"
                            : "Awaiting measurement"}

                    </small>

                </article>

            </div>


            <!-- Рівень стресу -->

            <article class="indicator-card stress-card">

                <div class="stress-heading">

                    <h4>Stress Level</h4>

                    <strong class="stress-reading">

                        ${hasStress
                            ? escapeHTML(stressLevel) + "/10"
                            : "—"}

                    </strong>

                </div>


                ${hasStress ? `

                    <div class="stress-progress"

                         role="img"

                         aria-label="Stress estimate:
                         ${stressLevel} out of 10">

                        <div class="stress-progress-fill"

                             style="width: ${stressPercent}%">

                        </div>

                    </div>

                    <div class="stress-labels">

                        <span>Low stress</span>

                        <span>High stress</span>

                    </div>

                ` : ""}


                <small class="indicator-source">

                    ${hasStress
                        ? "Automatic estimate"
                        : "Awaiting measurement"}

                </small>

            </article>


            <p class="automatic-data-note">

                Read-only data · No manual input

            </p>

        </section>

    `;

}


// ==============================
// DAILY CHECK-IN
// ==============================

function createCheckinForm() {

    const moods = [

        { name: "Poor", emoji: "" },
        { name: "Low", emoji: "" },
        { name: "Neutral", emoji: "" },
        { name: "Good", emoji: "" },
        { name: "Great", emoji: "" }

    ];


    const moodButtons = moods.map(mood => `

        <button type="button"
                class="mood-button"
                data-mood="${mood.name}"
                aria-pressed="false">

            <span aria-hidden="true">

                ${mood.emoji}

            </span>

            <small>${mood.name}</small>

        </button>

    `).join("");


    return `

        <form class="checkin-form" id="checkin-form">


            <!-- Настрій -->

            <fieldset class="checkin-field checkin-fieldset">

                <legend>Mood</legend>

                <div class="mood-options">

                    ${moodButtons}

                </div>

                <input type="hidden" id="selected-mood">

            </fieldset>


            <!-- Коментарі -->

            <div class="checkin-field">

                <label for="symptoms">

                    Symptoms & Notes (optional)

                </label>

                <textarea id="symptoms"

                          placeholder="Describe how you feel..."

                          maxlength="1000"></textarea>

            </div>


            <button type="submit"

                    class="add-button save-checkin">

                Save Check-in

            </button>


            <p class="checkin-message"

               id="checkin-message"

               role="status">

            </p>


            <p class="checkin-notice">

                Demo only. Use fictional information.
                Self-reported data is not a medical diagnosis.

            </p>

        </form>

    `;

}


// ==============================
// ЛОГІКА DAILY CHECK-IN
// ==============================

function setupCheckin() {

    const form =
        document.getElementById("checkin-form");

    const moodInput =
        document.getElementById("selected-mood");

    const symptoms =
        document.getElementById("symptoms");

    const message =
        document.getElementById("checkin-message");

    const moodButtons =
        form.querySelectorAll(".mood-button");


    // Вибір настрою

    function selectMood(mood) {

        const valid = Array.from(moodButtons).some(

            button => button.dataset.mood === mood

        );

        moodInput.value = valid ? mood : "";

        moodButtons.forEach(button => {

            const selected =
                button.dataset.mood === moodInput.value;

            button.classList.toggle(
                "selected",
                selected
            );

            button.setAttribute(
                "aria-pressed",
                String(selected)
            );

        });

    }


    // Натискання на емодзі

    moodButtons.forEach(button => {

        button.addEventListener("click", function () {

            selectMood(button.dataset.mood);

            message.textContent = "";

        });

    });


    // Відновлення попереднього запису

    const previousCheckin = astronaut.checkin;

    if (previousCheckin) {

        selectMood(previousCheckin.mood || "");

        symptoms.value =
            previousCheckin.symptoms || "";

        message.textContent =
            "Last demo check-in loaded.";

    }


    symptoms.addEventListener("input", function () {

        message.textContent = "";

    });


    // Збереження історії

    form.addEventListener("submit", function (event) {

        event.preventDefault();

        if (!moodInput.value) {

            message.textContent =
                "Please select your mood.";

            return;

        }


        const previous = astronaut.checkin;

        const previousHistory =
            astronaut.checkinHistory;


        const newCheckin = {

            mood: moodInput.value,

            symptoms: symptoms.value.trim(),

            date: new Date().toISOString()

        };


        const history = Array.isArray(previousHistory)

            ? [...previousHistory]

            : [];


        // Збереження старого запису

        if (
            previous &&
            !history.some(
                item => item?.date === previous.date
            )
        ) {

            history.push(previous);

        }


        // Додавання нового запису

        history.push(newCheckin);

        astronaut.checkin = newCheckin;

        astronaut.checkinHistory = history;


        // Збереження

        if (saveCrew()) {

            message.textContent =
                "Daily check-in saved for this demo.";

        } else {

            astronaut.checkin = previous;

            astronaut.checkinHistory = previousHistory;

            message.textContent =
                "Demo storage is unavailable.";

        }

    });

}


// ==============================
// ENVIRONMENT
// ==============================

function renderEnvironment() {

    const indicators = [

        {
            name: "Atmospheric Pressure",
            value: astronaut.pressure,
            unit: "kPa",
            icon: "",
            description: "Ambient atmospheric pressure"
        },

        {
            name: "Air Temperature",
            value: astronaut.airTemperature,
            unit: "K",
            icon: "",
            description: "Air temperature in kelvins"
        },

        {
            name: "Air Oxygen",
            value: astronaut.airOxygen,
            unit: "%",
            icon: "O₂",
            description: "Oxygen concentration in the air"
        },

        {
            name: "Air Quality",
            value: astronaut.airQuality,
            unit: "",
            icon: "≋",
            description: "Air quality sensor reading"
        },

        {
            name: "Carbon Dioxide",
            value: astronaut.co2,
            unit: "ppm",
            icon: "CO₂",
            description: "Carbon dioxide concentration"
        },

        {
            name: "Radiation Rate",
            value: astronaut.radiation,
            unit: "µSv/h",
            icon: "",
            description: "Current radiation dose rate"
        },

        {
            name: "Accumulated Radiation",
            value: astronaut.radiationDose,
            unit: "mSv",
            icon: "",
            description: "Accumulated radiation dose"
        }

    ];


    sectionContent.innerHTML = `

        <section class="health-panel">

            <div class="panel-heading">

                <h3>Environmental Conditions</h3>

                <p>
                    Conditions around the selected astronaut
                </p>

            </div>

            <div class="indicator-grid">

                ${indicators.map(createIndicator).join("")}

            </div>

        </section>

    `;

}


// ==================================================
// ANALYTICS
// ==================================================


// ==============================
// ПЕРЕЛІК ПОКАЗНИКІВ
// ==============================

const analyticsMetrics = [

    // Фізичні показники

    ["pulse", "Heart Rate", "bpm", "Physical Health"],

    ["oxygen", "Blood Oxygen", "%", "Physical Health"],

    ["temperature", "Skin Temperature", "°C", "Physical Health"],

    ["mass", "Body Mass", "kg", "Physical Health"],

    ["gripStrength", "Grip Strength", "N", "Physical Health"],

    ["acceleration", "Acceleration", "m/s²", "Physical Health"],


    // Середовище

    ["pressure", "Atmospheric Pressure", "kPa", "Environment"],

    ["airTemperature", "Air Temperature", "K", "Environment"],

    ["airOxygen", "Air Oxygen", "%", "Environment"],

    ["co2", "Carbon Dioxide", "ppm", "Environment"],


    // Радіація

    ["radiation", "Radiation Rate", "µSv/h", "Radiation"],

    ["radiationDose", "Accumulated Radiation", "mSv", "Radiation"],


    // Сон та стрес

    ["sleepDuration", "Sleep Duration", "hours", "Well-being"],

    ["stressLevel", "Stress Level", "/10", "Well-being"]

].map(([key, name, unit, group]) => ({

    key, name, unit, group

}));


// ==============================
// ФОРМАТУВАННЯ ЗНАЧЕНЬ
// ==============================

function formatAnalyticsValue(value) {

    return Number.isFinite(value)

        ? Number(value.toFixed(2)).toString()

        : "—";

}


// Форматування дати

function formatAnalyticsDate(value) {

    if (value == null || value === "") {

        return "Date unavailable";

    }

    const date = new Date(value);

    return Number.isFinite(date.getTime())

        ? date.toLocaleString("en-GB", {

            day: "2-digit",

            month: "short",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit"

        })

        : "Date unavailable";

}


// Перевірка часової мітки

function hasValidTimestamp(item) {

    return item.timestamp != null &&

        item.timestamp !== "" &&

        Number.isFinite(
            new Date(item.timestamp).getTime()
        );

}


// Повідомлення про відсутність даних

function createAnalyticsEmpty(message) {

    return `

        <div class="analytics-empty">

            <span class="analytics-empty-icon"></span>

            <span>${escapeHTML(message)}</span>

        </div>

    `;

}


// ==============================
// ІСТОРІЯ ВИМІРЮВАНЬ
// ==============================

function getMeasurementHistory(key) {

    let history = astronaut.history?.[key];


    // Підтримка попереднього графіка пульсу

    if (key === "pulse" && !Array.isArray(history)) {

        history = astronaut.pulseHistory;

    }

    if (!Array.isArray(history)) {

        return [];

    }


    // Перетворення даних на єдиний формат

    return history.map(item =>

        Number.isFinite(item)

            ? {
                value: item,
                timestamp: null
            }

            : {
                value: item?.value,
                timestamp: item?.timestamp ?? null
            }

    ).filter(item =>

        Number.isFinite(item.value) &&

        (
            key !== "sleepDuration" ||
            item.value >= 0 && item.value <= 24
        ) &&

        (
            key !== "stressLevel" ||
            item.value >= 0 && item.value <= 10
        )

    );

}


// ==============================
// ФІЛЬТРАЦІЯ ЗА ПЕРІОДОМ
// ==============================

function filterMeasurementHistory(history, period) {

    const dated = history

        .filter(hasValidTimestamp)

        .sort((a, b) =>

            new Date(a.timestamp) -
            new Date(b.timestamp)

        );


    if (period === "all") {

        return dated.length === history.length

            ? dated

            : [...history];

    }


    const duration = {

        "24h": 1,

        "7d": 7,

        "30d": 30

    }[period] * 86400000;


    const now = Date.now();


    return dated.filter(item => {

        const time =
            new Date(item.timestamp).getTime();

        return time >= now - duration && time <= now;

    });

}


// ==============================
// СТАТИСТИКА
// ==============================

function calculateMeasurementStats(history) {

    if (!history.length) {

        return {

            average: null,

            minimum: null,

            maximum: null

        };

    }


    const values = history.map(item => item.value);


    return {

        average:
            values.reduce((a, b) => a + b, 0) /
            values.length,

        minimum:
            values.reduce((a, b) => Math.min(a, b)),

        maximum:
            values.reduce((a, b) => Math.max(a, b))

    };

}


// Картка статистики

function createAnalyticsStat(name, value, unit = "") {

    const text = Number.isFinite(value)

        ? formatAnalyticsValue(value)

        : typeof value === "string" && value.trim()

            ? value

            : "—";


    return `

        <div class="analytics-stat">

            <span>${escapeHTML(name)}</span>

            <strong>${escapeHTML(text)}</strong>

            <small>${escapeHTML(unit)}</small>

        </div>

    `;

}


// ==============================
// УНІВЕРСАЛЬНИЙ ГРАФІК SVG
// ==============================

// Ширина графіка в панелі, що стоїть у двох колонках (>1200px) або в одній
function halfPanelChartWidth() {

    const full = sectionContent ? sectionContent.clientWidth : 640;

    const column = window.innerWidth > 1200
        ? (full - 24) / 2
        : full;

    // мінус поля панелі, поля графіка та рамки
    return column - 48 - 38;

}

function createAnalyticsChart(

    history,

    unit,

    color = "#288bff",

    type = "line",

    chartWidth = 640

) {

    if (!history.length) {

        return createAnalyticsEmpty(

            "No measurement history available"

        );

    }


    // Розміри графіка: ширина = реальна ширина контейнера в px,
    // тож 1 одиниця viewBox = 1 px і підписи не масштабуються.

    const width = Math.max(320, Math.round(chartWidth));
    const height = 250;

    const left = 65;
    const right = 20;
    const top = 22;
    const bottom = 48;

    const w = width - left - right;
    const h = height - top - bottom;


    // Межі значень

    const stats = calculateMeasurementStats(history);

    let min = stats.minimum;

    let max = stats.maximum;


    // Стовпчиковий графік

    if (type === "bar") {

        min = Math.min(0, min);

        max = Math.max(1, max);

    } else {

        const pad = max === min

            ? Math.max(Math.abs(max) * 0.05, 0.1)

            : (max - min) * 0.1;

        min -= pad;

        max += pad;

    }


    // Шкала стресу

    if (unit === "/10") {

        min = 0;

        max = 10;

    }


    const range = max - min || 1;


    // Перевірка часових міток

    const hasDates = history.every(hasValidTimestamp);


    const first = hasDates

        ? new Date(history[0].timestamp).getTime()

        : 0;


    const last = hasDates

        ? new Date(
            history[history.length - 1].timestamp
        ).getTime()

        : 0;


    // Координати точок

    const points = history.map((item, i) => {

        let x;

        if (type === "bar") {

            x = left + w * (i + 0.5) / history.length;

        } else if (hasDates && last > first) {

            x = left + w *

                (
                    new Date(item.timestamp).getTime() -
                    first
                ) /

                (last - first);

        } else {

            x = left + w *

                (
                    history.length === 1

                        ? 0.5

                        : i / (history.length - 1)
                );

        }


        const y = top + h -

            (item.value - min) / range * h;


        return {

            ...item,

            x,

            y

        };

    });


    // Горизонтальна сітка

    let grid = "";

    for (let i = 0; i <= 4; i++) {

        const y = top + i * h / 4;

        grid += `

            <line

                x1="${left}"

                x2="${width - right}"

                y1="${y}"

                y2="${y}"

                stroke="#2e2e32"

                stroke-dasharray="4 4"

            />

            <text

                x="${left - 10}"

                y="${y + 4}"

                text-anchor="end"

                fill="#a3a3a8"

                font-size="11"

            >

                ${formatAnalyticsValue(max - i * range / 4)}

            </text>

        `;

    }


    // Підказки на графіку

    const tooltip = point => escapeHTML(

        `${formatAnalyticsValue(point.value)} ${unit}` +

        (
            point.timestamp

                ? " · " + formatAnalyticsDate(point.timestamp)

                : ""
        )

    );


    const zeroY = top + h - (0 - min) / range * h;

    const barWidth = Math.min(

        45,

        w / history.length * 0.65

    );


    let shapes = "";


    // ==============================
    // СТОВПЧИКОВИЙ ГРАФІК
    // ==============================

    if (type === "bar") {

        shapes = points.map(point => `

            <rect

                x="${point.x - barWidth / 2}"

                y="${Math.min(point.y, zeroY)}"

                width="${barWidth}"

                height="${Math.abs(zeroY - point.y)}"

                rx="3"

                fill="${color}"

            >

                <title>${tooltip(point)}</title>

            </rect>

        `).join("");

    }


    // ==============================
    // ЛІНІЙНИЙ ГРАФІК
    // ==============================

    else {

        const linePoints = points.map(point =>

            `${point.x},${point.y}`

        ).join(" ");


        shapes = `

            <polyline

                points="${linePoints}"

                fill="none"

                stroke="${color}"

                stroke-width="2.5"

                stroke-linejoin="round"

                stroke-linecap="round"

            />

        `;


        shapes += points.map(point => `

            <circle

                cx="${point.x}"

                cy="${point.y}"

                r="4"

                fill="${color}"

            >

                <title>${tooltip(point)}</title>

            </circle>

        `).join("");

    }


    // Підписи осі X

    const firstLabel = hasDates

        ? formatAnalyticsDate(history[0].timestamp)

        : "First sample";


    const lastLabel = hasDates

        ? formatAnalyticsDate(
            history[history.length - 1].timestamp
        )

        : "Latest sample";


    // Готовий графік

    return `

        <div class="analytics-chart">

            <svg

                viewBox="0 0 ${width} ${height}"

                role="img"

                aria-label="Measurement history chart"

            >

                <text

                    x="${left}"

                    y="12"

                    fill="#a3a3a8"

                    font-size="11"

                >

                    ${escapeHTML(unit)}

                </text>


                ${grid}

                ${shapes}


                <text

                    x="${left}"

                    y="${height - 12}"

                    fill="#a3a3a8"

                    font-size="10"

                >

                    ${escapeHTML(firstLabel)}

                </text>


                ${history.length > 1 ? `

                    <text

                        x="${width - right}"

                        y="${height - 12}"

                        fill="#a3a3a8"

                        font-size="10"

                        text-anchor="end"

                    >

                        ${escapeHTML(lastLabel)}

                    </text>

                ` : ""}

            </svg>

        </div>


        <p class="analytics-chart-note">

            ${history.length} samples ·

            ${hasDates

                ? type === "bar"

                    ? "Chronological samples"

                    : "Time-based history"

                : "Sample order — timestamps unavailable"}

        </p>

    `;

}


// ==============================
// MEASUREMENT HISTORY
// ==============================

function renderMeasurementHistory() {

    const selectedKey =
        document.getElementById("analytics-metric").value;

    const period =
        document.getElementById("analytics-period").value;


    const metric = analyticsMetrics.find(

        item => item.key === selectedKey

    );

    if (!metric) return;


    const full = getMeasurementHistory(metric.key);

    const history = filterMeasurementHistory(full, period);

    const stats = calculateMeasurementStats(history);


    // Статистичні показники

    document.getElementById("analytics-summary")
        .innerHTML = [

            ["Current", astronaut[metric.key]],

            ["Average", stats.average],

            ["Minimum", stats.minimum],

            ["Maximum", stats.maximum]

        ].map(([name, value]) =>

            createAnalyticsStat(name, value, metric.unit)

        ).join("");


    // Графік

    const chart =
        document.getElementById("analytics-chart-content");


    if (

        period !== "all" &&

        full.length > 0 &&

        full.every(item => !hasValidTimestamp(item))

    ) {

        chart.innerHTML = createAnalyticsEmpty(

            "Timestamps unavailable. Select All Time."

        );

        return;

    }


    chart.innerHTML = createAnalyticsChart(

        history,

        metric.unit,

        "#288bff",

        metric.key === "sleepDuration"

            ? "bar"

            : "line",

        (chart.clientWidth || 678) - 38

    );


    if (

        period !== "all" &&

        full.some(item => !hasValidTimestamp(item))

    ) {

        chart.insertAdjacentHTML(

            "beforeend",

            `<p class="analytics-chart-note">

                Samples without timestamps are excluded.

            </p>`

        );

    }

}


// ==============================
// УНІВЕРСАЛЬНА ТАБЛИЦЯ
// ==============================

function analyticsTable(headers, rows) {

    return `

        <div class="analytics-table-wrapper">

            <table class="analytics-table">

                <thead>

                    <tr>

                        ${headers.map(header =>

                            `<th>${escapeHTML(header)}</th>`

                        ).join("")}

                    </tr>

                </thead>

                <tbody>${rows}</tbody>

            </table>

        </div>

    `;

}


// ==============================
// BASELINE COMPARISON
// ==============================

function createBaselineComparison() {

    const rows = analyticsMetrics.slice(0, 5).map(metric => {

        const baseline =
            astronaut.baseline?.[metric.key];

        const current =
            astronaut[metric.key];

        let change = "—";


        if (

            Number.isFinite(baseline) &&

            Number.isFinite(current)

        ) {

            const difference = current - baseline;


            const delta =

                metric.key === "temperature"

                    ? difference

                    : metric.key === "oxygen"

                        ? difference

                        : baseline !== 0

                            ? difference / baseline * 100

                            : null;


            if (delta !== null) {

                change =

                    (delta > 0 ? "+" : "") +

                    formatAnalyticsValue(delta) +

                    (

                        metric.key === "temperature"

                            ? " °C"

                            : metric.key === "oxygen"

                                ? " pp"

                                : "%"

                    );

            }

        }


        const reading = value =>

            Number.isFinite(value)

                ? formatAnalyticsValue(value) +
                    " " + metric.unit

                : "—";


        return `

            <tr>

                <td>${escapeHTML(metric.name)}</td>

                <td class="analytics-baseline">

                    ${escapeHTML(reading(baseline))}

                </td>

                <td class="analytics-current">

                    ${escapeHTML(reading(current))}

                </td>

                <td class="analytics-change">

                    ${escapeHTML(change)}

                </td>

            </tr>

        `;

    }).join("");


    return analyticsTable(

        ["Indicator", "Baseline", "Current", "Change"],

        rows

    ) + `

        <p class="analytics-chart-note">

            Baseline differences are not medical diagnoses.
            pp = percentage points.

        </p>

    `;

}


// ==============================
// WELL-BEING HISTORY
// ==============================

function createWellbeingHistory() {

    const sleep = filterMeasurementHistory(

        getMeasurementHistory("sleepDuration"),

        "all"

    );


    const stress = filterMeasurementHistory(

        getMeasurementHistory("stressLevel"),

        "all"

    );


    const sleepStats = calculateMeasurementStats(sleep);

    const stressStats = calculateMeasurementStats(stress);


    return `

        <div class="wellbeing-history-summary">

            ${createAnalyticsStat(

                "Average Sleep",

                sleepStats.average,

                "hours"

            )}

            ${createAnalyticsStat(

                "Latest Sleep Quality",

                astronaut.sleepQuality

            )}

            ${createAnalyticsStat(

                "Average Stress",

                stressStats.average,

                "/10"

            )}

        </div>


        <!-- СТОВПЧИКОВИЙ ГРАФІК СНУ -->

        <h4 class="analytics-subheading">

            Sleep Duration

        </h4>

        ${createAnalyticsChart(

            sleep,

            "hours",

            "#288bff",

            "bar",

            halfPanelChartWidth()

        )}


        <!-- ЛІНІЙНИЙ ГРАФІК СТРЕСУ -->

        <h4 class="analytics-subheading">

            Stress Level

        </h4>

        ${createAnalyticsChart(

            stress,

            "/10",

            "#ffbe2e",

            "line",

            halfPanelChartWidth()

        )}

    `;

}


// ==============================
// DAILY CHECK-IN HISTORY
// ==============================

function createCheckinHistory() {

    const history = Array.isArray(astronaut.checkinHistory)

        ? astronaut.checkinHistory.filter(

            item => item && typeof item === "object"

        )

        : [];


    if (!history.length && astronaut.checkin) {

        history.push(astronaut.checkin);

    }


    if (!history.length) {

        return createAnalyticsEmpty(

            "No check-ins recorded"

        );

    }


    const moods = {

        Poor: "",

        Low: "",

        Neutral: "",

        Good: "",

        Great: ""

    };


    history.sort((a, b) =>

        (Date.parse(b.date) || 0) -

        (Date.parse(a.date) || 0)

    );


    const items = history.map(item => `

        <article class="checkin-history-item">

            <div class="checkin-history-header">

                <span class="checkin-history-emoji">

                    ${Object.hasOwn(moods, item.mood)

                        ? moods[item.mood]

                        : "—"}

                </span>

                <strong>${escapeHTML(item.mood)}</strong>

                <span class="checkin-history-date">

                    ${escapeHTML(
                        formatAnalyticsDate(item.date)
                    )}

                </span>

            </div>


            <p class="checkin-history-notes">

                ${escapeHTML(

                    item.symptoms || "No additional notes"

                )}

            </p>

        </article>

    `).join("");


    return `

        <div class="checkin-history">

            ${items}

        </div>

    `;

}


// ==============================
// ALERT HISTORY
// ==============================

function createAlertHistory() {

    const alerts = Array.isArray(astronaut.alertHistory)

        ? astronaut.alertHistory.filter(

            item => item && typeof item === "object"

        )

        : [];


    if (!alerts.length) {

        return createAnalyticsEmpty(

            "No alert history available"

        );

    }


    alerts.sort((a, b) =>

        (Date.parse(b.timestamp) || 0) -

        (Date.parse(a.timestamp) || 0)

    );


    const rows = alerts.map(alert => `

        <tr>

            <td>

                ${escapeHTML(
                    formatAnalyticsDate(alert.timestamp)
                )}

            </td>

            <td>${escapeHTML(alert.message)}</td>

            <td>

                <span class="alert-history-status
                    ${getStatusClass(alert.severity)}">

                    ${escapeHTML(
                        alert.severity || "Unknown"
                    )}

                </span>

            </td>

        </tr>

    `).join("");


    return analyticsTable(

        ["Date & Time", "Alert", "Severity"],

        rows

    );

}


// ==============================
// ГОЛОВНА СТОРІНКА ANALYTICS
// ==============================

function renderAnalytics() {

    const groups = [

        "Physical Health",

        "Environment",

        "Radiation",

        "Well-being"

    ];


    // Список показників

    const options = groups.map(group => `

        <optgroup label="${escapeHTML(group)}">

            ${analyticsMetrics

                .filter(metric => metric.group === group)

                .map(metric => `

                    <option value="${metric.key}">

                        ${escapeHTML(metric.name)}

                    </option>

                `).join("")}

        </optgroup>

    `).join("");


    // Вміст сторінки

    sectionContent.innerHTML = `

        <div class="analytics-layout">


            <!-- 1. MEASUREMENT HISTORY -->

            <section class="analytics-panel">

                <h3>Measurement History</h3>

                <p class="analytics-description">

                    Explore historical measurements
                    and individual trends.

                </p>


                <div class="analytics-controls">

                    <div class="analytics-field">

                        <label for="analytics-metric">

                            Health Indicator

                        </label>

                        <select id="analytics-metric">

                            ${options}

                        </select>

                    </div>


                    <div class="analytics-field">

                        <label for="analytics-period">

                            Time Period

                        </label>

                        <select id="analytics-period">

                            <option value="24h">
                                Last 24 Hours
                            </option>

                            <option value="7d">
                                Last 7 Days
                            </option>

                            <option value="30d">
                                Last 30 Days
                            </option>

                            <option value="all" selected>
                                All Time
                            </option>

                        </select>

                    </div>

                </div>


                <div class="analytics-summary"
                     id="analytics-summary">

                </div>


                <p class="analytics-chart-note">

                    Current is the latest available reading.
                    Other statistics refer to the selected period.

                </p>


                <div id="analytics-chart-content">

                </div>

            </section>


            <!-- 2. BASELINE COMPARISON -->

            <section class="analytics-panel">

                <h3>Individual Baseline Comparison</h3>

                <p class="analytics-description">

                    Pre-flight baseline compared
                    with current measurements.

                </p>

                ${createBaselineComparison()}

            </section>


            <!-- 3 ТА 4. ДВА БЛОКИ ПОРУЧ -->

            <div class="analytics-two-columns">


                <!-- WELL-BEING HISTORY -->

                <section class="analytics-panel">

                    <h3>Well-being History</h3>

                    <p class="analytics-description">

                        Automatic sleep and stress estimates.

                    </p>

                    ${createWellbeingHistory()}

                </section>


                <!-- DAILY CHECK-IN HISTORY -->

                <section class="analytics-panel">

                    <h3>Daily Check-in History</h3>

                    <p class="analytics-description">

                        Self-reported mood and personal notes.

                    </p>

                    ${createCheckinHistory()}

                </section>

            </div>


            <!-- 5. ALERT HISTORY -->

            <section class="analytics-panel">

                <h3>Alert History</h3>

                <p class="analytics-description">

                    Previous alerts and warning events.

                </p>

                ${createAlertHistory()}

            </section>

        </div>

    `;


    // Перемикання показників

    document.getElementById("analytics-metric")

        .addEventListener(

            "change",

            renderMeasurementHistory

        );


    // Перемикання періодів

    document.getElementById("analytics-period")

        .addEventListener(

            "change",

            renderMeasurementHistory

        );


    renderMeasurementHistory();

}


// ==================================================
// HEALTH GUIDE
// ==================================================

function renderGuide() {

    const hazards = [

        {
            title: "Space Radiation",

            description:
                "Radiation exposure is monitored through " +
                "dose rate and accumulated radiation data."
        },

        {
            title: "Isolation & Confinement",

            description:
                "Well-being Monitoring displays sleep and " +
                "stress estimates. Daily Check-in records " +
                "self-reported mood and notes."
        },

        {
            title: "Distance from Earth",

            description:
                "PULSAR provides access to health data, " +
                "medical records and emergency resources."
        },

        {
            title: "Gravity Fields",

            description:
                "Body mass, grip strength and movement " +
                "help visualize physical changes."
        },

        {
            title: "≋ Hostile / Closed Environments",

            description:
                "Environmental monitoring displays air " +
                "temperature, pressure and air quality."
        }

    ];


    const hazardCards = hazards.map(hazard => `

        <details class="hazard-item">

            <summary>

                ${escapeHTML(hazard.title)}

            </summary>

            <p>

                ${escapeHTML(hazard.description)}

            </p>

        </details>

    `).join("");


    sectionContent.innerHTML = `

        <div class="information-panel">

            <h3>Measurement Instructions</h3>

            <p>

                Individual health indicator explanations
                and measurement instructions
                will be added here.

            </p>

        </div>


        <div class="information-panel">

            <h3>Spaceflight Hazards</h3>

            <div class="hazard-list">

                ${hazardCards}

            </div>

        </div>


        <!-- Інструкції перенесені з Emergency -->

        <div class="information-panel">

            <h3>Emergency Instructions</h3>

            <p>

                Validated mission-specific emergency
                protocols will be added here.

            </p>

        </div>


        <div class="information-panel">

            <h3>Scientific Resources</h3>


            <a class="resource-link"

               href="https://www.nasa.gov/hrp/"

               target="_blank"

               rel="noopener noreferrer">

                NASA Human Research Program

            </a>


            <a class="resource-link"

               href="https://www.nasa.gov/hrp/hazards/"

               target="_blank"

               rel="noopener noreferrer">

                NASA Spaceflight Hazards

            </a>


            <a class="resource-link"

               href="https://osdr.nasa.gov/"

               target="_blank"

               rel="noopener noreferrer">

                NASA Open Science Data Repository

            </a>

        </div>

    `;

}


// ==================================================
// SETTINGS
// ==================================================

function renderSettings() {

    sectionContent.innerHTML = `

        <div class="information-panel">

            <h3>Medical Card</h3>

            <p>

                Full name:
                ${escapeHTML(astronaut.name)}

            </p>

            <p>

                Crew role:
                ${escapeHTML(astronaut.role)}

            </p>

            <p>

                Astronaut ID:
                AST-${String(astronaut.id).padStart(3, "0")}

            </p>

            <p>

                Additional personal information,
                medical history and baseline indicators
                will be included in this card.

            </p>

        </div>


        <div class="information-panel">

            <h3>Reminders</h3>

            <p>

                Measurement reminders and daily schedules.

            </p>

        </div>


        <div class="information-panel">

            <h3>Notifications</h3>

            <p>Notification preferences.</p>

        </div>


        <div class="information-panel">

            <h3>Preferences</h3>

            <p>Interface language and appearance.</p>

        </div>

    `;

}


// ==================================================
// SOS — ОНОВЛЕННЯ БОКОВОЇ КНОПКИ
// ==================================================

function updateSidebarSos() {

    if (!astronaut) return;


    const button =
        document.getElementById("sidebar-sos");

    if (!button) return;


    const active = isSosActive(astronaut.id);


    button.classList.toggle(

        "is-active",

        active

    );


    button.textContent = active
        ? "SOS Active"
        : "SOS / Emergency";

}


// ==================================================
// ПОЧАТКОВИЙ ЗАПУСК (live API)
// ==================================================

async function bootAstronautPage() {
    try {
        if (window.PulsarLive?.fetchDevice && astronautId) {
            astronaut = await window.PulsarLive.fetchDevice(astronautId);
            crew = [astronaut];
        }
    } catch (e) {
        console.error(e);
        astronaut = null;
    }

    if (!astronaut) {
        if (sectionContent) {
            sectionContent.innerHTML =
                `<p class="empty-message">Device not found. Open from dashboard.</p>`;
        }
        return;
    }

    renderProfile();


    // Обробники пунктів меню

    document.querySelectorAll(".nav-button")
        .forEach(button => {

            button.addEventListener("click", function () {

                openSection(button.dataset.section);

            });

        });


    // ==============================
    // КНОПКА SOS
    // ==============================

    document.getElementById("sidebar-sos")

        .addEventListener("click", function () {

            openSosDialog(astronaut);

        });


    // Початковий стан кнопки

    updateSidebarSos();


    // Оновлення після активації SOS

    document.addEventListener(

        "pulsar:sos-change",

        updateSidebarSos

    );


    window.addEventListener(

        "pageshow",

        updateSidebarSos

    );


    // Відкриття потрібного розділу

    openSection(requestedSection || "health");
}

// Графіки Analytics малюються під реальну ширину — перемальовуємо після
// зміни розміру вікна, щоб підписи лишались 1:1.
let analyticsResizeTimer = null;

window.addEventListener("resize", () => {
    clearTimeout(analyticsResizeTimer);
    analyticsResizeTimer = setTimeout(() => {
        const active = document.querySelector(".nav-button.active");
        if (astronaut && active?.dataset.section === "analytics") {
            renderAnalytics();
        }
    }, 200);
});

bootAstronautPage().catch((e) => {
    console.error(e);
    if (sectionTitle) sectionTitle.textContent = "Astronaut not found";
    if (sectionDescription) {
        sectionDescription.textContent = "Return to the Crew Dashboard";
    }
    if (sectionContent) {
        sectionContent.innerHTML = `
        <div class="information-panel">
            <h3>Profile unavailable</h3>
            <p>Please return to the Crew Dashboard and select a device.</p>
        </div>`;
    }
});