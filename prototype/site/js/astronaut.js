
// ==================================================
// PULSAR — ASTRONAUT PROFILE
// ==================================================

// ==================================================
// ОТРИМАННЯ ID АСТРОНАВТА
// ==================================================

const params = new URLSearchParams(window.location.search);

const astronautId = params.get("id");
const requestedSection = params.get("section");

const STORAGE_KEY = "pulsar_live_crew_cache";

let crew = [];
let astronaut = null;

async function loadAstronautFromServer() {
    if (!astronautId) return null;
    if (window.PulsarLive?.fetchDevice) {
        return window.PulsarLive.fetchDevice(astronautId);
    }
    return null;
}

try {
    crew = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(crew)) crew = [];
} catch (_) {
    crew = [];
}

astronaut =
    crew.find((person) => String(person.id) === String(astronautId)) || null;


// ==================================================
// HTML-ЕЛЕМЕНТИ
// ==================================================

const sectionContent =
    document.getElementById("section-content");

const sectionTitle =
    document.getElementById("section-title");

const sectionDescription =
    document.getElementById("section-description");

// ==================================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ==================================================

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
        "Critical",
        "Warning",
        "Pending",
        "Normal"
    ];

    return statuses.includes(status)
        ? status.toLowerCase()
        : "pending";
}

// ==================================================
// ЗБЕРЕЖЕННЯ ДАНИХ
// СИНХРОНІЗАЦІЯ З NOTIFICATION CENTER
// ==================================================

function saveCrew() {

    try {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(crew)
        );

    } catch (error) {

        console.error(
            "Cannot save demo data:",
            error
        );

        return false;
    }

    // Повідомляємо інші модулі про оновлення

    try {
        document.dispatchEvent(
            new CustomEvent("pulsar:crew-change", {
                detail: {
                    crew: crew
                }
            })
        );

    } catch (error) {

        console.error(
            "Cannot synchronize notifications:",
            error
        );
    }

    return true;
}

// ==================================================
// ПРОФІЛЬ АСТРОНАВТА
// ==================================================

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
            `AST-${String(astronaut.id).padStart(3, "0")}`;

    const statusElement =
        document.getElementById("profile-status");

    statusElement.textContent =
        `● ${astronaut.status}`;

    statusElement.className =
        `status ${getStatusClass(astronaut.status)}`;

    document.title = `PULSAR | ${astronaut.name}`;
}

// ==================================================
// ІНФОРМАЦІЯ ПРО РОЗДІЛИ
// ==================================================

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

    insights: {
        title: "AI Health Insights",
        description:
            "Early trend detection and proactive health monitoring"
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

// ==================================================
// НАВІГАЦІЯ ТА АНІМАЦІЇ
// ==================================================

let currentSection = null;
let sectionAnimations = [];

function animateSection() {

    sectionAnimations.forEach(animation => {
        animation.cancel();
    });

    sectionAnimations = [];

    // Персональні налаштування

    if (astronaut?.settings?.animations === false) {
        return;
    }

    // Системні налаштування

    if (
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
    ) {
        return;
    }

    const elements = [
        sectionTitle,
        sectionDescription,
        sectionContent
    ];

    elements.forEach(element => {

        if (typeof element?.animate !== "function") {
            return;
        }

        const animation = element.animate(

            [
                {
                    opacity: 0,
                    transform: "translateY(8px)"
                },
                {
                    opacity: 1,
                    transform: "translateY(0)"
                }
            ],

            {
                duration: 250,
                easing: "ease-out"
            }
        );

        sectionAnimations.push(animation);
    });
}

// ==================================================
// ВІДКРИТТЯ РОЗДІЛУ
// ==================================================

function openSection(section) {

    if (!Object.hasOwn(sections, section)) {
        section = "health";
    }

    const sectionChanged =
        currentSection !== null &&
        currentSection !== section;

    sectionTitle.textContent =
        sections[section].title;

    sectionDescription.textContent =
        sections[section].description;

    // Активний пункт меню

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

    // Відображення розділу

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

        case "insights":
            renderInsights();
            break;

        case "guide":
            renderGuide();
            break;

        case "settings":
            renderSettings();
            break;
    }

    // Оновлення адреси сторінки

    const url = new URL(window.location.href);

    url.searchParams.set("section", section);

    window.history.replaceState({}, "", url);

    currentSection = section;

    if (sectionChanged) {
        animateSection();
    }
}

// ==================================================
// УНІВЕРСАЛЬНА КАРТКА ПОКАЗНИКА
// ==================================================

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
                    ? "Demo measurement"
                    : "Awaiting measurement"}

            </small>

        </article>

    `;
}

// ==================================================
// ДОВІДКОВА ІНФОРМАЦІЯ
// ==================================================

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

// ==================================================
// ФІЗИЧНІ ПОКАЗНИКИ
// ==================================================

function getHealthIndicators() {

    return [

        {
            name: "Heart Rate",
            value: astronaut.pulse,
            unit: "bpm",
            icon: "♡",
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
            icon: "♨",
            description: "Temperature measured at the skin"
        },

        {
            name: "Body Mass",
            value: astronaut.mass,
            unit: "kg",
            icon: "◫",
            description: "Body mass measurement"
        },

        {
            name: "Grip Strength",
            value: astronaut.gripStrength,
            unit: "N",
            icon: "✊",
            description: "Hand grip force"
        },

        {
            name: "Acceleration",
            value: astronaut.acceleration,
            unit: "m/s²",
            icon: "↗",
            description: "Accelerometer measurement"
        },

        {
            name: "Body Movement",
            value: astronaut.movement,
            unit: "",
            icon: "↔",
            description: "Device-recorded movement"
        },

        {
            name: "Physical Activity",
            value: astronaut.activity,
            unit: "",
            icon: "⚡",
            description: "Physical activity level"
        }

    ];
}

// ==================================================
// HEALTH MONITORING
// ==================================================

function renderHealth() {

    const cards = getHealthIndicators()
        .map(createIndicator)
        .join("");

    sectionContent.innerHTML = `

        <div class="health-layout">

            <!-- ФІЗИЧНЕ ЗДОРОВ'Я -->

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


            <!-- ПСИХОЛОГІЧНЕ САМОПОЧУТТЯ -->

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

// ==================================================
// WELL-BEING MONITORING
// ==================================================

function createWellbeingPanel() {

    const sleepDuration = astronaut.sleepDuration;
    const sleepQuality = astronaut.sleepQuality;
    const stressLevel = astronaut.stressLevel;

    // Перевірка тривалості сну

    const hasSleep =
        Number.isFinite(sleepDuration) &&
        sleepDuration >= 0 &&
        sleepDuration <= 24;

    // Перевірка якості сну

    const hasQuality =
        typeof sleepQuality === "string" &&
        sleepQuality.trim() !== "";

    // Перевірка рівня стресу

    const hasStress =
        Number.isFinite(stressLevel) &&
        stressLevel >= 0 &&
        stressLevel <= 10;

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

                <!-- ТРИВАЛІСТЬ СНУ -->

                <article class="indicator-card">

                    <span class="indicator-icon">☾</span>

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


                <!-- ЯКІСТЬ СНУ -->

                <article class="indicator-card">

                    <span class="indicator-icon">◇</span>

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


            <!-- РІВЕНЬ СТРЕСУ -->

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

// ==================================================
// DAILY CHECK-IN
// СТРУКТУРОВАНІ СИМПТОМИ
// CREW ENVIRONMENTAL ANALYSIS
// ==================================================

const CHECKIN_SYMPTOMS = [

    {
        code: "headache",
        label: "Headache"
    },

    {
        code: "fatigue",
        label: "Fatigue"
    },

    {
        code: "dizziness",
        label: "Dizziness"
    },

    {
        code: "nausea",
        label: "Nausea"
    },

    {
        code: "shortness_of_breath",
        label: "Shortness of breath"
    },

    {
        code: "muscle_weakness",
        label: "Muscle weakness"
    },

    {
        code: "sleep_difficulties",
        label: "Sleep difficulties"
    },

    {
        code: "eye_discomfort",
        label: "Eye discomfort"
    }

];

// Ідентифікатор демонстраційного модуля

const CHECKIN_DEMO_HABITAT = "DEMO-HABITAT-01";

// ==================================================
// СТВОРЕННЯ ФОРМИ DAILY CHECK-IN
// ==================================================

function createCheckinForm() {

    const moods = [

        { name: "Poor", emoji: "😞" },

        { name: "Low", emoji: "🙁" },

        { name: "Neutral", emoji: "😐" },

        { name: "Good", emoji: "🙂" },

        { name: "Great", emoji: "😄" }

    ];

    // Кнопки вибору настрою

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

    // Структуровані симптоми

    const symptomOptions = CHECKIN_SYMPTOMS.map(item => `

        <label class="checkin-symptom-option">

            <input type="checkbox"
                   name="reported-symptom"
                   value="${escapeHTML(item.code)}">

            <span>

                ${escapeHTML(item.label)}

            </span>

        </label>

    `).join("");

    return `

        <form class="checkin-form" id="checkin-form">

            <!-- ВИБІР НАСТРОЮ -->

            <fieldset class="checkin-field checkin-fieldset">

                <legend>Mood</legend>

                <div class="mood-options">

                    ${moodButtons}

                </div>

                <input type="hidden" id="selected-mood">

            </fieldset>


            <!-- СТРУКТУРОВАНІ СИМПТОМИ -->

            <fieldset class="checkin-field checkin-fieldset">

                <legend>Reported Symptoms</legend>

                <div class="checkin-symptom-grid">

                    ${symptomOptions}

                </div>

                <label class="checkin-symptom-option
                              checkin-no-symptoms">

                    <input type="checkbox"
                           id="checkin-no-symptoms">

                    <span>No symptoms to report</span>

                </label>

                <small class="checkin-symptom-help">

                    Select all that apply.
                    Leaving this section blank
                    means symptoms were not assessed.

                </small>

            </fieldset>


            <!-- ДОДАТКОВІ НОТАТКИ -->

            <div class="checkin-field">

                <label for="symptoms">

                    Additional Notes (optional)

                </label>

                <textarea id="symptoms"
                          placeholder="Describe any additional observations..."
                          maxlength="1000"></textarea>

            </div>


            <!-- КОСМІЧНИЙ МОДУЛЬ -->

            <p class="checkin-symptom-help">

                Habitat: Lunar Habitat — Simulation

            </p>


            <!-- ПОПЕРЕДНЄ ОПИТУВАННЯ -->

            ${astronaut.checkin?.date ? `

                <p class="checkin-symptom-help">

                    Last check-in:

                    ${escapeHTML(
                        formatAnalyticsDate(
                            astronaut.checkin.date
                        )
                    )}

                </p>

            ` : ""}


            <!-- КНОПКА ЗБЕРЕЖЕННЯ -->

            <button type="submit"
                    class="add-button save-checkin">

                Save Check-in

            </button>

            <p class="checkin-message"
               id="checkin-message"
               role="status"></p>

            <p class="checkin-notice">

                Demo only. Use fictional information.

                Structured symptoms are stored
                for demo crew analysis.

                They do not generate operational
                alerts or medical diagnoses.

            </p>

        </form>

    `;
}

// ==================================================
// ЛОГІКА DAILY CHECK-IN
// ==================================================

function setupCheckin() {

    const form =
        document.getElementById("checkin-form");

    const moodInput =
        document.getElementById("selected-mood");

    const notes =
        document.getElementById("symptoms");

    const message =
        document.getElementById("checkin-message");

    const moodButtons =
        form.querySelectorAll(".mood-button");

    const symptomInputs = Array.from(
        form.querySelectorAll(
            'input[name="reported-symptom"]'
        )
    );

    const noSymptoms =
        document.getElementById("checkin-no-symptoms");

    // ==================================================
    // ВИБІР НАСТРОЮ
    // ==================================================

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

    moodButtons.forEach(button => {

        button.addEventListener("click", function () {

            selectMood(button.dataset.mood);

            message.textContent = "";
        });
    });

    // ==================================================
    // ВІДСУТНІСТЬ СИМПТОМІВ
    // ==================================================

    noSymptoms.addEventListener("change", function () {

        if (noSymptoms.checked) {

            symptomInputs.forEach(input => {
                input.checked = false;
            });
        }

        message.textContent = "";
    });

    // ==================================================
    // ВИБІР ОКРЕМИХ СИМПТОМІВ
    // ==================================================

    symptomInputs.forEach(input => {

        input.addEventListener("change", function () {

            if (input.checked) {
                noSymptoms.checked = false;
            }

            message.textContent = "";
        });
    });

    notes.addEventListener("input", function () {
        message.textContent = "";
    });

    // ==================================================
    // ЗБЕРЕЖЕННЯ ОПИТУВАННЯ
    // ==================================================

    form.addEventListener("submit", function (event) {

        event.preventDefault();

        // Перевірка настрою

        if (!Array.from(moodButtons).some(
            button => button.dataset.mood === moodInput.value
        )) {

            message.textContent =
                "Please select your mood.";

            return;
        }

        // Дозволені коди симптомів

        const allowedCodes = new Set(
            CHECKIN_SYMPTOMS.map(item => item.code)
        );

        // Отримання вибраних симптомів

        const selectedCodes = [...new Set(

            symptomInputs
                .filter(input => input.checked)
                .map(input => input.value)
                .filter(code => allowedCodes.has(code))

        )];

        // Розрізняємо відсутність інформації
        // та явне повідомлення про відсутність симптомів

        const structuredSymptoms = selectedCodes.length

            ? selectedCodes

            : noSymptoms.checked

                ? []

                : null;

        // Попередні дані

        const previous = astronaut.checkin;

        const previousHistory =
            astronaut.checkinHistory;

        // Часова мітка

        const timestamp = new Date().toISOString();

        // Новий запис

        const newCheckin = {

            mood: moodInput.value,

            // Довільні нотатки у старому форматі

            symptoms: notes.value.trim(),

            // Структуровані симптоми

            structuredSymptoms,

            date: timestamp,

            habitatId: CHECKIN_DEMO_HABITAT,

            source: "demo"
        };

        // Історія опитувань

        const history = Array.isArray(previousHistory)

            ? [...previousHistory]

            : [];

        // Зберігаємо старий запис

        if (
            previous &&
            !history.some(
                item => item?.date === previous.date
            )
        ) {
            history.push(previous);
        }

        // Додаємо новий запис

        history.push(newCheckin);

        astronaut.checkin = newCheckin;

        astronaut.checkinHistory = history;

        // Збереження даних

        // Демонстраційні записи не додаються
        // до healthObservations із джерелом actual.

        message.textContent = "Saving…";
        (async () => {
            try {
                if (window.PulsarLive?.postCheckin) {
                    const res = await window.PulsarLive.postCheckin(astronaut.id, newCheckin);
                    if (res.device) {
                        Object.assign(astronaut, window.PulsarLive.mapDevice
                            ? window.PulsarLive.mapDevice(res.device)
                            : res.device);
                    } else {
                        astronaut.checkin = res.checkin || newCheckin;
                    }
                }
                saveCrew();
                form.reset();
                selectMood("");
                message.textContent = "✓ Daily check-in saved.";
            } catch (err) {
                astronaut.checkin = previous;
                astronaut.checkinHistory = previousHistory;
                message.textContent = err.message || "Check-in failed.";
            }
        })();
    });
}

// ==================================================
// ENVIRONMENT
// ==================================================

function renderEnvironment() {

    const indicators = [

        {
            name: "Atmospheric Pressure",
            value: astronaut.pressure,
            unit: "kPa",
            icon: "◴",
            description: "Ambient atmospheric pressure"
        },

        {
            name: "Air Temperature",
            value: astronaut.airTemperature,
            unit: "K",
            icon: "♨",
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
            icon: "☢",
            description: "Current radiation dose rate"
        },

        {
            name: "Accumulated Radiation",
            value: astronaut.radiationDose,
            unit: "mSv",
            icon: "☢",
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

    key,
    name,
    unit,
    group

}));

// ==================================================
// ФОРМАТУВАННЯ ЗНАЧЕНЬ
// ==================================================

function formatAnalyticsValue(value) {

    return Number.isFinite(value)

        ? Number(value.toFixed(2)).toString()

        : "—";
}

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

function hasValidTimestamp(item) {

    return item.timestamp != null &&
        item.timestamp !== "" &&
        Number.isFinite(
            new Date(item.timestamp).getTime()
        );
}

// ==================================================
// ВІДСУТНІСТЬ ДАНИХ
// ==================================================

function createAnalyticsEmpty(message) {

    return `

        <div class="analytics-empty">

            <span class="analytics-empty-icon">▥</span>

            <span>${escapeHTML(message)}</span>

        </div>

    `;
}

// ==================================================
// ІСТОРІЯ ВИМІРЮВАНЬ
// ==================================================

function getMeasurementHistory(key) {

    let history = astronaut.history?.[key];

    if (!Array.isArray(history) && astronaut.analyticsSeries?.[key]) {
        history = astronaut.analyticsSeries[key].map((p) => ({
            value: Number(p.v),
            timestamp: p.t ?? null,
        }));
    }

    if (!Array.isArray(history) && Array.isArray(astronaut.measurementHistory)) {
        history = astronaut.measurementHistory
            .map((row) => ({
                value: Number(row?.[key]),
                timestamp: row?.timestamp ?? null,
            }))
            .filter((item) => Number.isFinite(item.value));
    }

    if (key === "pulse" && !Array.isArray(history)) {
        history = astronaut.pulseHistory;
    }

    if (!Array.isArray(history)) {
        return [];
    }

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

// ==================================================
// ФІЛЬТРАЦІЯ ЗА ПЕРІОДОМ
// ==================================================

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

// ==================================================
// СТАТИСТИКА
// ==================================================

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

// ==================================================
// КАРТКА СТАТИСТИЧНОГО ПОКАЗНИКА
// ==================================================

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

// ==================================================
// УНІВЕРСАЛЬНИЙ SVG-ГРАФІК
// ==================================================

function createAnalyticsChart(
    history,
    unit,
    color = "#4dd9ec",
    type = "line"
) {

    if (!history.length) {

        return createAnalyticsEmpty(
            "No measurement history available"
        );
    }

    // Розміри графіка

    const width = 640;
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

    // Часові мітки

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

        const y =
            top + h -
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
                stroke="#304258"
                stroke-dasharray="4 4"
            />

            <text
                x="${left - 10}"
                y="${y + 4}"
                text-anchor="end"
                fill="#91a5bd"
                font-size="11">

                ${formatAnalyticsValue(
                    max - i * range / 4
                )}

            </text>

        `;
    }

    // Підказка

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

    // Стовпчиковий графік

    if (type === "bar") {

        shapes = points.map(point => `

            <rect
                x="${point.x - barWidth / 2}"
                y="${Math.min(point.y, zeroY)}"
                width="${barWidth}"
                height="${Math.abs(zeroY - point.y)}"
                rx="3"
                fill="${color}">

                <title>${tooltip(point)}</title>

            </rect>

        `).join("");

    } else {

        // Лінійний графік

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
                fill="${color}">

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
                aria-label="Measurement history chart">

                <text
                    x="${left}"
                    y="12"
                    fill="#91a5bd"
                    font-size="11">

                    ${escapeHTML(unit)}

                </text>

                ${grid}

                ${shapes}

                <text
                    x="${left}"
                    y="${height - 12}"
                    fill="#91a5bd"
                    font-size="10">

                    ${escapeHTML(firstLabel)}

                </text>

                ${history.length > 1 ? `

                    <text
                        x="${width - right}"
                        y="${height - 12}"
                        fill="#91a5bd"
                        font-size="10"
                        text-anchor="end">

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

// ==================================================
// MEASUREMENT HISTORY
// ==================================================

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

    const history =
        filterMeasurementHistory(full, period);

    const stats =
        calculateMeasurementStats(history);

    // Статистика

    document.getElementById("analytics-summary")
        .innerHTML = [

            ["Current", astronaut[metric.key]],

            ["Average", stats.average],

            ["Minimum", stats.minimum],

            ["Maximum", stats.maximum]

        ].map(([name, value]) =>

            createAnalyticsStat(
                name,
                value,
                metric.unit
            )

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

        "#4dd9ec",

        metric.key === "sleepDuration"

            ? "bar"

            : "line"
    );

    // Повідомлення про відсутні часові мітки

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

// ==================================================
// УНІВЕРСАЛЬНА ТАБЛИЦЯ
// ==================================================

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

// ==================================================
// BASELINE COMPARISON
// ==================================================

function createBaselineComparison() {

    const rows = analyticsMetrics.slice(0, 5).map(metric => {

        const baseline =
            astronaut.baseline?.[metric.key];

        const current =
            astronaut[metric.key];

        let change = "—";

        // Перевірка відповідності кисті

        const referenceHand =
            astronaut.baseline?.gripReferenceHand;

        const sameHand =

            metric.key !== "gripStrength" ||

            (
                ["Right", "Left"].includes(referenceHand) &&
                astronaut.gripHand === referenceHand
            );

        // Обчислення різниці

        if (
            sameHand &&
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

            Grip strength changes require matching
            hand information.

        </p>

    `;
}

// ==================================================
// WELL-BEING HISTORY
// ==================================================

function createWellbeingHistory() {

    const sleep = filterMeasurementHistory(

        getMeasurementHistory("sleepDuration"),

        "all"
    );

    const stress = filterMeasurementHistory(

        getMeasurementHistory("stressLevel"),

        "all"
    );

    const sleepStats =
        calculateMeasurementStats(sleep);

    const stressStats =
        calculateMeasurementStats(stress);

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

        <!-- ГРАФІК ТРИВАЛОСТІ СНУ -->

        <h4 class="analytics-subheading">

            Sleep Duration

        </h4>

        ${createAnalyticsChart(
            sleep,
            "hours",
            "#4dd9ec",
            "bar"
        )}

        <!-- ГРАФІК РІВНЯ СТРЕСУ -->

        <h4 class="analytics-subheading">

            Stress Level

        </h4>

        ${createAnalyticsChart(
            stress,
            "/10",
            "#b6a2ff",
            "line"
        )}

    `;
}

// ==================================================
// ФОРМАТУВАННЯ СТРУКТУРОВАНИХ СИМПТОМІВ
// ==================================================

function formatCheckinSymptoms(item) {

    // Дані відсутні або запис старого формату

    if (!Array.isArray(item?.structuredSymptoms)) {

        return "Not assessed / not recorded";
    }

    // Явна відсутність симптомів

    if (item.structuredSymptoms.length === 0) {

        return "No symptoms reported";
    }

    // Перетворення кодів на назви

    return item.structuredSymptoms.map(code => {

        const definition = CHECKIN_SYMPTOMS.find(
            symptom => symptom.code === code
        );

        return definition?.label || String(code);

    }).join(", ");
}

// ==================================================
// DAILY CHECK-IN HISTORY
// ==================================================

function createCheckinHistory() {

    const history = Array.isArray(astronaut.checkinHistory)

        ? astronaut.checkinHistory.filter(
            item => item && typeof item === "object"
        )

        : [];

    // Підтримка попереднього формату

    if (!history.length && astronaut.checkin) {

        history.push(astronaut.checkin);
    }

    if (!history.length) {

        return createAnalyticsEmpty(
            "No check-ins recorded"
        );
    }

    // Іконки настрою

    const moods = {

        Poor: "😞",
        Low: "🙁",
        Neutral: "😐",
        Good: "🙂",
        Great: "😄"

    };

    // Сортування за датою

    history.sort((a, b) =>

        (Date.parse(b.date) || 0) -
        (Date.parse(a.date) || 0)

    );

    // Створення записів

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

            <!-- Структуровані симптоми -->

            <p class="checkin-history-notes">

                <strong>Reported symptoms:</strong>

                ${escapeHTML(
                    formatCheckinSymptoms(item)
                )}

            </p>

            <!-- Додаткові нотатки -->

            <p class="checkin-history-notes">

                <strong>Additional notes:</strong>

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

// ==================================================
// ALERT HISTORY
// ==================================================

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

                    ● ${escapeHTML(
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

// ==================================================
// ГОЛОВНА СТОРІНКА ANALYTICS
// ==================================================

function renderAnalytics() {

    const groups = [

        "Physical Health",
        "Environment",
        "Radiation",
        "Well-being"

    ];

    // Список показників за категоріями

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

    sectionContent.innerHTML = `

        <div class="analytics-layout">

            <!-- MEASUREMENT HISTORY -->

            <section class="analytics-panel">

                <h3>Measurement History</h3>

                <p class="analytics-description">

                    Explore historical measurements
                    and individual trends.

                </p>

                <!-- ФІЛЬТРИ ГРАФІКА -->

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
                     id="analytics-summary"></div>

                <p class="analytics-chart-note">

                    Current is the latest available reading.

                    Other statistics refer to the selected period.

                </p>

                <div id="analytics-chart-content"></div>

            </section>


            <!-- BASELINE COMPARISON -->

            <section class="analytics-panel">

                <h3>Individual Baseline Comparison</h3>

                <p class="analytics-description">

                    Pre-flight baseline compared
                    with current measurements.

                </p>

                ${createBaselineComparison()}

            </section>


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


            <!-- ALERT HISTORY -->

            <section class="analytics-panel">

                <h3>Alert History</h3>

                <p class="analytics-description">

                    Previous alerts and warning events.

                </p>

                ${createAlertHistory()}

            </section>

        </div>

    `;

    // Обробники подій

    document.getElementById("analytics-metric")

        .addEventListener(
            "change",
            renderMeasurementHistory
        );

    document.getElementById("analytics-period")

        .addEventListener(
            "change",
            renderMeasurementHistory
        );

    renderMeasurementHistory();
}

// ==================================================
// AI HEALTH INSIGHTS
// ==================================================

function renderInsights() {

    if (typeof window.renderHealthInsights !== "function") {

        sectionContent.innerHTML = `

            <div class="information-panel">

                <h3>Health Insights unavailable</h3>

                <p>Unable to load the analysis module.</p>

            </div>

        `;

        return;
    }

    window.renderHealthInsights(
        sectionContent,
        astronaut
    );
}

// ==================================================
// HEALTH GUIDE
// ==================================================

function renderGuide() {

    renderHealthGuide(sectionContent);
}

// ==================================================
// MEDICAL CARD
// ==================================================

// Універсальне створення медичного поля

function medicalField(
    key,
    label,
    type = "text",
    options = {}
) {

    return {
        key,
        label,
        type,
        ...options
    };
}

// ==================================================
// СТРУКТУРА МЕДИЧНОЇ КАРТКИ
// ==================================================

const medicalSections = [

    // ==================================================
    // 1. PERSONAL INFORMATION
    // ==================================================

    {
        key: "personal",

        title: "Personal Information",

        icon: "◎",

        fields: [

            medicalField(
                "name",
                "Full Name",
                "readonly"
            ),

            medicalField(
                "id",
                "Astronaut ID",
                "readonly"
            ),

            medicalField(
                "birthDate",
                "Date of Birth",
                "date",
                { past: true }
            ),

            medicalField(
                "age",
                "Age",
                "calculated",
                { unit: "years" }
            ),

            medicalField("sex", "Sex", "select", {

                options: [
                    "Female",
                    "Male",
                    "Other",
                    "Not specified"
                ]
            }),

            medicalField("bloodType", "Blood Type", "select", {

                options: [
                    "A+", "A-",
                    "B+", "B-",
                    "AB+", "AB-",
                    "O+", "O-"
                ]
            }),

            medicalField(
                "role",
                "Crew Role",
                "readonly"
            ),

            medicalField(
                "mission",
                "Mission",
                "readonly"
            ),

            medicalField(
                "missionStart",
                "Mission Start Date",
                "date"
            ),

            medicalField(
                "missionEnvironment",
                "Mission Environment",
                "select",
                {
                    options: [
                        "Earth",
                        "Space Station",
                        "Spacecraft",
                        "Lunar Surface",
                        "Mars Surface",
                        "Other"
                    ]
                }
            )

        ]
    },

    // ==================================================
    // 2. PHYSICAL DEVELOPMENT
    // ==================================================

    {
        key: "physical",

        title: "Physical Development",

        icon: "♡",

        description:
            "Pre-flight reference measurements entered by " +
            "medical personnel. Not live sensor readings.",

        fields: [

            medicalField(
                "height",
                "Height",
                "number",
                { unit: "cm", min: 1 }
            ),

            medicalField(
                "mass",
                "Body Mass",
                "number",
                { unit: "kg", min: 1 }
            ),

            medicalField(
                "chestRest",
                "Chest Circumference — Rest",
                "number",
                { unit: "cm", min: 1 }
            ),

            medicalField(
                "chestInhale",
                "Chest Circumference — Inhale",
                "number",
                { unit: "cm", min: 1 }
            ),

            medicalField(
                "chestExhale",
                "Chest Circumference — Exhale",
                "number",
                { unit: "cm", min: 1 }
            ),

            medicalField(
                "lungCapacity",
                "Vital Lung Capacity",
                "number",
                { unit: "L", min: 0 }
            ),

            medicalField(
                "rightGrip",
                "Right Hand Grip",
                "number",
                { unit: "N", min: 0 }
            ),

            medicalField(
                "leftGrip",
                "Left Hand Grip",
                "number",
                { unit: "N", min: 0 }
            ),

            medicalField(
                "pulse",
                "Resting Heart Rate",
                "number",
                { unit: "bpm", min: 0 }
            ),

            medicalField(
                "oxygen",
                "Blood Oxygen",
                "number",
                {
                    unit: "%",
                    min: 0,
                    max: 100
                }
            ),

            medicalField(
                "temperature",
                "Skin Temperature",
                "number",
                { unit: "°C" }
            ),

            medicalField(
                "bmi",
                "Body Mass Index",
                "calculated",
                { unit: "kg/m²" }
            ),

            medicalField(
                "gripReferenceHand",
                "Grip Strength Reference Hand",
                "select",
                {
                    options: ["Right", "Left"]
                }
            )

        ]
    },

    // ==================================================
    // 3. OBJECTIVE EXAMINATION
    // ==================================================

    {
        key: "objective",

        title: "Objective Examination",

        icon: "✚",

        description:
            "Clinical findings recorded during " +
            "a medical examination.",

        fields: [

            medicalField(
                "constitution",
                "Body Constitution"
            ),

            medicalField(
                "skin",
                "Skin Condition",
                "textarea"
            ),

            medicalField(
                "musculoskeletal",
                "Musculoskeletal System",
                "textarea"
            ),

            medicalField(
                "respiratory",
                "Respiratory System",
                "textarea"
            ),

            medicalField(
                "respiratoryRate",
                "Respiratory Rate",
                "number",
                {
                    unit: "breaths/min",
                    min: 0
                }
            ),

            medicalField(
                "chestShape",
                "Chest Shape"
            ),

            medicalField(
                "bloodPressure",
                "Blood Pressure",
                "text",
                {
                    unit: "mmHg",
                    placeholder: "Systolic / Diastolic"
                }
            ),

            medicalField(
                "cardiovascular",
                "Cardiovascular System",
                "textarea"
            ),

            medicalField(
                "digestive",
                "Digestive System",
                "textarea"
            ),

            medicalField(
                "rightEye",
                "Right Eye Vision"
            ),

            medicalField(
                "leftEye",
                "Left Eye Vision"
            ),

            medicalField(
                "hearing",
                "Hearing"
            ),

            medicalField(
                "nervous",
                "Nervous System",
                "textarea"
            ),

            medicalField(
                "otherSystems",
                "Other Organs & Systems",
                "textarea"
            ),

            medicalField(
                "boneHealth",
                "Bone Health",
                "textarea"
            ),

            medicalField(
                "muscleHealth",
                "Muscle Health",
                "textarea"
            ),

            medicalField(
                "vestibular",
                "Vestibular Function",
                "textarea"
            ),

            medicalField(
                "coordination",
                "Motor Coordination",
                "textarea"
            ),

            medicalField(
                "psychological",
                "Psychological Assessment",
                "textarea"
            )

        ]
    },

    // ==================================================
    // 4. HEALTH ASSESSMENT
    // ==================================================

    {
        key: "assessment",

        title: "Health Assessment",

        icon: "✓",

        description:
            "Medical conclusions are entered by a specialist, " +
            "not generated automatically.",

        fields: [

            medicalField(
                "physicalAssessment",
                "Physical Development Assessment",
                "textarea"
            ),

            medicalField(
                "generalAssessment",
                "General Health Assessment",
                "select",
                {
                    options: [
                        "Healthy",
                        "Generally Healthy",
                        "Requires Medical Observation",
                        "Requires Medical Evaluation"
                    ]
                }
            ),

            medicalField(
                "fitness",
                "Medical Fitness for Mission Duties",
                "select",
                {
                    options: [
                        "Fit for Mission Duties",
                        "Fit with Restrictions",
                        "Temporarily Unfit",
                        "Unfit for Mission Duties",
                        "Pending Medical Evaluation"
                    ]
                }
            ),

            medicalField(
                "recommendations",
                "Medical Recommendations",
                "textarea"
            ),

            medicalField(
                "additionalExams",
                "Additional Examinations",
                "textarea"
            ),

            medicalField(
                "examDate",
                "Examination Date",
                "date",
                { past: true }
            ),

            medicalField(
                "nextExam",
                "Next Examination Date",
                "date"
            ),

            medicalField(
                "examiner",
                "Medical Examiner"
            )

        ]
    },

    // ==================================================
    // 5. MEDICAL HISTORY
    // ==================================================

    {
        key: "medicalHistory",

        title: "Medical History",

        icon: "▤",

        fields: [

            medicalField(
                "allergies",
                "Allergies",
                "textarea"
            ),

            medicalField(
                "conditions",
                "Chronic Conditions",
                "textarea"
            ),

            medicalField(
                "illnesses",
                "Previous Illnesses",
                "textarea"
            ),

            medicalField(
                "injuries",
                "Previous Injuries",
                "textarea"
            ),

            medicalField(
                "surgeries",
                "Previous Surgeries",
                "textarea"
            ),

            medicalField(
                "medications",
                "Current Medications",
                "textarea"
            ),

            medicalField(
                "contraindications",
                "Medical Contraindications",
                "textarea"
            ),

            medicalField(
                "restrictions",
                "Physical Activity Restrictions",
                "textarea"
            ),

            medicalField(
                "vaccinations",
                "Vaccination History",
                "textarea"
            ),

            medicalField(
                "notes",
                "Medical Notes",
                "textarea"
            )

        ]
    }

];

// ==================================================
// ПОТОЧНА ДАТА
// ==================================================

function medicalToday() {

    const date = new Date();

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;
}

// ==================================================
// ОБЧИСЛЕННЯ ВІКУ
// ==================================================

function calculateMedicalAge(birthDate) {

    if (!birthDate) return null;

    const birth = new Date(
        birthDate + "T00:00:00"
    );

    const today = new Date();

    if (
        !Number.isFinite(birth.getTime()) ||
        birth > today
    ) {
        return null;
    }

    let age =
        today.getFullYear() - birth.getFullYear();

    if (
        today.getMonth() < birth.getMonth() ||
        (
            today.getMonth() === birth.getMonth() &&
            today.getDate() < birth.getDate()
        )
    ) {
        age--;
    }

    return age;
}

// ==================================================
// ОБЧИСЛЕННЯ BMI
// ==================================================

function calculateMedicalBMI(height, mass) {

    if (
        !Number.isFinite(height) ||
        !Number.isFinite(mass) ||
        height <= 0 ||
        mass <= 0
    ) {
        return null;
    }

    return Number(
        (mass / (height / 100) ** 2).toFixed(2)
    );
}

// ==================================================
// ОТРИМАННЯ ДАНИХ МЕДИЧНОЇ КАРТКИ
// ==================================================

function getMedicalCardData() {

    const saved = astronaut.medicalCard || {};

    const baseline = astronaut.baseline || {};

    return {

        personal: {

            birthDate: saved.birthDate ?? "",

            bloodType: saved.bloodType ?? "",

            ...saved.personal
        },

        physical: {

            height: saved.height ?? null,

            mass: baseline.mass ?? null,

            pulse: baseline.pulse ?? null,

            oxygen: baseline.oxygen ?? null,

            temperature: baseline.temperature ?? null,

            ...saved.physical
        },

        objective: {

            ...saved.objective
        },

        assessment: {

            ...saved.assessment
        },

        medicalHistory: {

            allergies: saved.allergies ?? "",

            conditions: saved.conditions ?? "",

            medications: saved.medications ?? "",

            notes: typeof saved.history === "string"

                ? saved.history

                : "",

            ...saved.medicalHistory
        }
    };
}

// ==================================================
// ОТРИМАННЯ ЗНАЧЕННЯ ПОЛЯ
// ==================================================

function getMedicalFieldValue(section, field, data) {

    const profile = {

        name: astronaut.name,

        id: `AST-${String(astronaut.id)
            .padStart(3, "0")}`,

        role: astronaut.role,

        mission: astronaut.mission ||
            "Lunar Exploration Mission"
    };

    // Дані профілю не редагуються

    if (field.type === "readonly") {

        return profile[field.key];
    }

    // Автоматичне обчислення віку

    if (field.key === "age") {

        return calculateMedicalAge(
            data.personal.birthDate
        );
    }

    // Автоматичне обчислення BMI

    if (field.key === "bmi") {

        return calculateMedicalBMI(
            data.physical.height,
            data.physical.mass
        );
    }

    return data[section.key]?.[field.key] ?? null;
}

// ==================================================
// СТВОРЕННЯ ПОЛЯ МЕДИЧНОЇ КАРТКИ
// ==================================================

function createMedicalField(
    section,
    field,
    data,
    editing
) {

    const id =
        `med-${section.key}-${field.key}`;

    const value =
        getMedicalFieldValue(section, field, data);

    const hasValue =
        value != null && value !== "";

    const label =
        field.label +
        (field.unit ? ` (${field.unit})` : "");

    // Режим перегляду

    if (
        !editing ||
        ["readonly", "calculated"].includes(field.type)
    ) {

        return `

            <div class="med-field-view">

                <span class="med-field-label">

                    ${escapeHTML(label)}

                </span>

                <strong id="${id}"
                        class="${hasValue ? "" : "med-empty"}">

                    ${hasValue

                        ? escapeHTML(value)

                        : "Not recorded"}

                </strong>

                ${field.type === "calculated" ? `

                    <small class="med-auto-label">

                        Automatically calculated

                    </small>

                ` : ""}

                ${field.type === "readonly" ? `

                    <small class="med-auto-label">

                        Profile information

                    </small>

                ` : ""}

            </div>

        `;
    }

    // Режим редагування

    let input;

    // Випадаючий список

    if (field.type === "select") {

        input = `

            <select id="${id}">

                <option value="">

                    Select an option

                </option>

                ${field.options.map(option => `

                    <option
                        value="${escapeHTML(option)}"
                        ${value === option
                            ? "selected"
                            : ""}>

                        ${escapeHTML(option)}

                    </option>

                `).join("")}

            </select>

        `;

    } else if (field.type === "textarea") {

        // Багаторядкове текстове поле

        input = `

            <textarea
                id="${id}"
                rows="3"
                maxlength="2000"
                placeholder="Enter medical information..."
            >${escapeHTML(value ?? "")}</textarea>

        `;

    } else {

        // Звичайне поле введення

        const min = field.min != null

            ? `min="${field.min}"`

            : "";

        const max = field.max != null

            ? `max="${field.max}"`

            : field.past

                ? `max="${medicalToday()}"`

                : "";

        const step = field.type === "number"

            ? 'step="any"'

            : "";

        input = `

            <input
                id="${id}"
                type="${field.type}"
                value="${escapeHTML(value ?? "")}"
                placeholder="${escapeHTML(
                    field.placeholder || "Enter value"
                )}"
                ${min}
                ${max}
                ${step}
                ${field.type === "text"
                    ? 'maxlength="500"'
                    : ""}
            >

        `;
    }

    return `

        <div class="med-field-edit">

            <label for="${id}">

                ${escapeHTML(label)}

            </label>

            ${input}

        </div>

    `;
}

// ==================================================
// СТВОРЕННЯ РОЗДІЛУ МЕДИЧНОЇ КАРТКИ
// ==================================================

function createMedicalSection(
    section,
    data,
    editing,
    openSections
) {

    return `

        <details class="med-section"
                 data-medical-section="${section.key}"
                 ${openSections.includes(section.key)
                     ? "open"
                     : ""}>

            <!-- ЗАГОЛОВОК РОЗДІЛУ -->

            <summary class="med-section-heading">

                <span class="med-section-icon">

                    ${section.icon}

                </span>

                <span>

                    <strong>${section.title}</strong>

                    <small>

                        ${section.fields.length} fields

                    </small>

                </span>

                <span class="med-chevron"
                      aria-hidden="true">

                    ⌄

                </span>

            </summary>


            <!-- ВМІСТ РОЗДІЛУ -->

            <div class="med-section-content">

                ${section.description ? `

                    <p class="med-description">

                        ${escapeHTML(section.description)}

                    </p>

                ` : ""}

                <div class="med-fields-grid">

                    ${section.fields.map(field =>

                        createMedicalField(
                            section,
                            field,
                            data,
                            editing
                        )

                    ).join("")}

                </div>

            </div>

        </details>

    `;
}

// ==================================================
// ВІДОБРАЖЕННЯ МЕДИЧНОЇ КАРТКИ
// ==================================================

function renderMedicalCard(
    container,
    editing = false,
    message = "",
    openSections = ["personal"]
) {

    const data = getMedicalCardData();

    container.innerHTML = `

        <div class="med-card">

            <!-- ЗАГОЛОВОК -->

            <div class="med-card-heading">

                <div>

                    <h3>Medical Card</h3>

                    <p>Medical examination records</p>

                </div>

                ${editing ? "" : `

                    <button
                        type="button"
                        class="med-edit-button"
                        id="edit-medical-card">

                        Edit Medical Card

                    </button>

                `}

            </div>


            <!-- ДЖЕРЕЛО МЕДИЧНИХ ДАНИХ -->

            <div class="med-notice">

                Manual medical records.

                Live sensor measurements never
                overwrite these values.

            </div>


            <!-- УСІ РОЗДІЛИ -->

            <form id="medical-card-form" novalidate>

                ${medicalSections.map(section =>

                    createMedicalSection(
                        section,
                        data,
                        editing,
                        openSections
                    )

                ).join("")}


                <!-- КНОПКИ РЕДАГУВАННЯ -->

                ${editing ? `

                    <div class="med-form-actions">

                        <button
                            type="button"
                            class="med-cancel-button"
                            id="cancel-medical-card">

                            Cancel

                        </button>

                        <button
                            type="submit"
                            class="add-button">

                            Save Medical Card

                        </button>

                    </div>

                ` : ""}


                <!-- ПОВІДОМЛЕННЯ -->

                <p class="med-save-message"
                   id="medical-card-message"
                   role="status">

                    ${escapeHTML(message)}

                </p>

            </form>


            <!-- DEMO MODE -->

            <p class="med-demo-note">

                Demo mode · Use fictional medical
                information only.

            </p>

        </div>

    `;

    // Отримання відкритих розділів

    const getOpenSections = () => Array.from(

        container.querySelectorAll(
            ".med-section[open]"
        ),

        element => element.dataset.medicalSection
    );

    // Отримання поля

    const getInput = (section, field) =>

        container.querySelector(
            `#med-${section}-${field}`
        );

    // Режим перегляду

    if (!editing) {

        container.querySelector("#edit-medical-card")

            .addEventListener("click", () => {

                renderMedicalCard(
                    container,
                    true,
                    "",
                    getOpenSections()
                );
            });

        return;
    }

    // ==================================================
    // РЕЖИМ РЕДАГУВАННЯ
    // ==================================================

    const form =
        container.querySelector("#medical-card-form");

    const status =
        container.querySelector("#medical-card-message");

    // Отримання числового значення

    const readNumber = (section, field) => {

        const input = getInput(section, field);

        return input.value !== "" &&
            Number.isFinite(input.valueAsNumber)

            ? input.valueAsNumber

            : null;
    };

    // Відображення автоматично обчисленого значення

    const showCalculated = (section, field, value) => {

        const element = getInput(section, field);

        element.textContent =
            value ?? "Not recorded";

        element.classList.toggle(
            "med-empty",
            value == null
        );
    };

    // Автоматичне обчислення віку та BMI

    form.addEventListener("input", () => {

        showCalculated(
            "personal",
            "age",
            calculateMedicalAge(
                getInput("personal", "birthDate").value
            )
        );

        showCalculated(
            "physical",
            "bmi",
            calculateMedicalBMI(
                readNumber("physical", "height"),
                readNumber("physical", "mass")
            )
        );
    });

    // Скасування редагування

    container.querySelector("#cancel-medical-card")

        .addEventListener("click", () => {

            renderMedicalCard(
                container,
                false,
                "",
                getOpenSections()
            );
        });

    // Відображення помилки

    function showError(input, text) {

        input.closest("details").open = true;

        status.textContent = text;

        input.focus();
    }

    // ==================================================
    // ЗБЕРЕЖЕННЯ МЕДИЧНОЇ КАРТКИ
    // ==================================================

    form.addEventListener("submit", event => {

        event.preventDefault();

        status.textContent = "";

        // Перевірка коректності полів

        if (!form.checkValidity()) {

            const invalid = form.querySelector(
                "input:invalid, " +
                "select:invalid, " +
                "textarea:invalid"
            );

            if (invalid) {

                showError(
                    invalid,
                    "Please correct the highlighted field."
                );

                invalid.reportValidity();
            }

            return;
        }

        // Формування оновлених даних

        const updated = {};

        medicalSections.forEach(section => {

            updated[section.key] = {

                ...data[section.key]
            };

            section.fields.forEach(field => {

                if (
                    ["readonly", "calculated"]
                        .includes(field.type)
                ) {
                    return;
                }

                updated[section.key][field.key] =

                    field.type === "number"

                        ? readNumber(
                            section.key,
                            field.key
                        )

                        : getInput(
                            section.key,
                            field.key
                        ).value.trim();
            });
        });

        // Перевірка дат медичних обстежень

        const assessment = updated.assessment;

        if (
            assessment.examDate &&
            assessment.nextExam &&
            assessment.nextExam < assessment.examDate
        ) {

            showError(
                getInput("assessment", "nextExam"),
                "Next examination cannot precede " +
                "the examination date."
            );

            return;
        }

        // Перевірка дати народження

        if (
            updated.personal.birthDate &&
            assessment.examDate &&
            assessment.examDate <
                updated.personal.birthDate
        ) {

            showError(
                getInput("assessment", "examDate"),
                "Examination cannot precede " +
                "the date of birth."
            );

            return;
        }

        // Перевірка сили хвату

        const physical = updated.physical;

        const hand = physical.gripReferenceHand;

        const gripKey = hand === "Right"

            ? "rightGrip"

            : "leftGrip";

        if (hand && physical[gripKey] == null) {

            showError(
                getInput("physical", gripKey),
                "Enter the measurement for the " +
                "selected reference hand."
            );

            return;
        }

        // Попередні дані

        const previousMedical = astronaut.medicalCard;

        const previousBaseline = astronaut.baseline;

        // Оновлення медичної картки

        astronaut.medicalCard = {

            ...previousMedical,

            ...updated,

            updatedAt: new Date().toISOString()
        };

        // Оновлення індивідуальних
        // передпольотних показників

        astronaut.baseline = {

            ...previousBaseline,

            pulse: physical.pulse,

            oxygen: physical.oxygen,

            temperature: physical.temperature,

            mass: physical.mass,

            gripStrength: hand

                ? physical[gripKey]

                : null,

            gripReferenceHand: hand || ""
        };

        // Збереження

        status.textContent = "Saving…";
        (async () => {
            try {
                if (window.PulsarLive?.putMedical) {
                    await window.PulsarLive.putMedical(astronaut.id, {
                        medicalCard: astronaut.medicalCard,
                        baseline: astronaut.baseline,
                    });
                }
                saveCrew();
                renderMedicalCard(
                    container,
                    false,
                    "✓ Medical card saved.",
                    getOpenSections()
                );
            } catch (err) {
                astronaut.medicalCard = previousMedical;
                astronaut.baseline = previousBaseline;
                status.textContent = err.message || "Save failed.";
            }
        })();
    });
}

// ==================================================
// ADDITIONAL PREFERENCES
// ==================================================

function renderMedicalPreferences(container) {

    const settings = astronaut.settings || {};

    const reminders = settings.reminders || {};

    const notifications = settings.notifications || {};

    // Універсальний перемикач

    const toggle = (id, title, checked) => `

        <label class="med-preference-row">

            <span>${escapeHTML(title)}</span>

            <input
                type="checkbox"
                class="med-switch"
                id="${id}"
                ${checked ? "checked" : ""}>

        </label>

    `;

    container.innerHTML = `

        <details class="med-section med-preferences">

            <!-- ЗАГОЛОВОК -->

            <summary class="med-section-heading">

                <span class="med-section-icon">

                    ⚙

                </span>

                <strong>Additional Preferences</strong>

                <span class="med-chevron">⌄</span>

            </summary>


            <!-- ВМІСТ НАЛАШТУВАНЬ -->

            <div class="med-section-content">

                <form id="medical-preferences-form">

                    <div class="med-preferences-grid">

                        <!-- ==========================
                             REMINDERS
                        =========================== -->

                        <section class="med-preference-panel">

                            <h4>Reminders</h4>

                            <!-- ЩОДЕННЕ ОПИТУВАННЯ -->

                            ${toggle(
                                "reminder-checkin",
                                "Daily Check-in",
                                reminders.checkinEnabled ?? false
                            )}

                            <div class="med-field-edit">

                                <label for="checkin-time">

                                    Check-in Time

                                </label>

                                <input
                                    type="time"
                                    id="checkin-time"
                                    value="${escapeHTML(
                                        reminders.checkinTime ||
                                        "20:00"
                                    )}">

                            </div>


                            <!-- ВИМІРЮВАННЯ ПОКАЗНИКІВ -->

                            ${toggle(
                                "reminder-measurement",
                                "Health Measurements",
                                reminders.measurementEnabled ??
                                false
                            )}

                            <div class="med-field-edit">

                                <label for="measurement-time">

                                    Measurement Time

                                </label>

                                <input
                                    type="time"
                                    id="measurement-time"
                                    value="${escapeHTML(
                                        reminders.measurementTime ||
                                        "08:00"
                                    )}">

                            </div>

                        </section>


                        <!-- ==========================
                             NOTIFICATIONS
                        =========================== -->

                        <section class="med-preference-panel">

                            <h4>Notifications</h4>

                            ${toggle(
                                "notify-health",
                                "Additional Health Warnings",
                                notifications.health ?? true
                            )}

                            ${toggle(
                                "notify-device",
                                "Device Connection",
                                notifications.device ?? true
                            )}

                            ${toggle(
                                "notify-battery",
                                "Battery Alerts",
                                notifications.battery ?? true
                            )}

                            <p class="med-description">

                                Critical alerts and SOS
                                are not controlled by
                                these preferences.

                            </p>

                        </section>


                        <!-- ==========================
                             INTERFACE
                        =========================== -->

                        <section class="med-preference-panel">

                            <h4>Interface</h4>

                            ${toggle(
                                "enable-animations",
                                "Section Animations",
                                settings.animations ?? true
                            )}

                            <!-- МОВА -->

                            <div class="med-preference-row">

                                <span>Language</span>

                                <strong>English</strong>

                            </div>


                            <!-- ТЕМА -->

                            <div class="med-preference-row">

                                <span>Appearance</span>

                                <strong>Dark Mode</strong>

                            </div>

                        </section>

                    </div>


                    <!-- ІНФОРМАЦІЯ -->

                    <p class="med-description">

                        Reminder and notification preferences
                        are stored in demo mode.

                        Automatic delivery is not connected yet.

                    </p>


                    <!-- КНОПКА ЗБЕРЕЖЕННЯ -->

                    <div class="med-form-actions">

                        <button
                            type="submit"
                            class="add-button">

                            Save Preferences

                        </button>

                    </div>


                    <!-- ПОВІДОМЛЕННЯ -->

                    <p class="med-save-message"
                       id="medical-preferences-message"
                       role="status"></p>

                </form>

            </div>

        </details>

    `;

    const get = id =>
        container.querySelector("#" + id);

    // ==================================================
    // ЗБЕРЕЖЕННЯ НАЛАШТУВАНЬ
    // ==================================================

    get("medical-preferences-form")

        .addEventListener("submit", event => {

            event.preventDefault();

            const status =
                get("medical-preferences-message");

            const checkinEnabled =
                get("reminder-checkin").checked;

            const measurementEnabled =
                get("reminder-measurement").checked;

            const checkinTime =
                get("checkin-time").value;

            const measurementTime =
                get("measurement-time").value;

            // Перевірка часу нагадувань

            if (
                (checkinEnabled && !checkinTime) ||
                (measurementEnabled && !measurementTime)
            ) {

                status.textContent =
                    "Please select the reminder time.";

                return;
            }

            // Попередні налаштування

            const previous = astronaut.settings;

            // Оновлення налаштувань

            astronaut.settings = {

                ...previous,

                reminders: {

                    ...previous?.reminders,

                    checkinEnabled,

                    checkinTime,

                    measurementEnabled,

                    measurementTime
                },

                notifications: {

                    ...previous?.notifications,

                    health:
                        get("notify-health").checked,

                    device:
                        get("notify-device").checked,

                    battery:
                        get("notify-battery").checked
                },

                animations:
                    get("enable-animations").checked
            };

            // Збереження

            status.textContent = "Saving…";
            (async () => {
                try {
                    if (window.PulsarLive?.putSettings) {
                        await window.PulsarLive.putSettings(astronaut.id, {
                            settings: astronaut.settings,
                        });
                    }
                    saveCrew();
                    status.textContent = "✓ Preferences saved.";
                } catch (err) {
                    astronaut.settings = previous;
                    status.textContent = err.message || "Save failed.";
                }
            })();
        });
}

// ==================================================
// SETTINGS
// ==================================================

function renderSettings() {

    sectionContent.innerHTML = `

        <div class="medical-page">

            <div id="medical-card-content"></div>

            <div id="medical-preferences-content"></div>

        </div>

    `;

    renderMedicalCard(

        document.getElementById(
            "medical-card-content"
        )
    );

    renderMedicalPreferences(

        document.getElementById(
            "medical-preferences-content"
        )
    );
}

function updateSidebarSos() {

    if (!astronaut) return;

    const button = document.getElementById("sidebar-sos");
    if (!button) return;

    const sosOn = isSosActive(astronaut.id) || !!astronaut.sos;
    button.classList.toggle("is-active", sosOn);
    button.textContent = sosOn ? "SOS Active" : "SOS / Emergency";
}

function showAstronautMissing() {
    sectionTitle.textContent = "Astronaut not found";
    sectionDescription.textContent = "Return to the Crew Dashboard";
    const nameEl = document.getElementById("profile-name");
    if (nameEl) nameEl.textContent = "Unknown astronaut";
    sectionContent.innerHTML = `
        <div class="information-panel">
            <h3>Profile unavailable</h3>
            <p>Device not found on server. Open Crew Dashboard and pick a live device.</p>
        </div>
    `;
    document.querySelectorAll(".nav-button, #sidebar-sos").forEach((button) => {
        button.disabled = true;
    });
}

function bootAstronautPage() {
    if (!astronaut) {
        showAstronautMissing();
        return;
    }

    renderProfile();

    document.querySelectorAll(".nav-button").forEach((button) => {
        button.addEventListener("click", function () {
            openSection(button.dataset.section);
        });
    });

    document.getElementById("sidebar-sos")?.addEventListener("click", function () {
        openSosDialog(astronaut);
    });

    updateSidebarSos();
    document.addEventListener("pulsar:sos-change", updateSidebarSos);
    window.addEventListener("pageshow", updateSidebarSos);
    openSection(requestedSection || "health");
}

(async function initAstronautLive() {
    try {
        const live = await loadAstronautFromServer();
        if (live) {
            astronaut = live;
            const i = crew.findIndex((p) => String(p.id) === String(live.id));
            if (i >= 0) crew[i] = live;
            else crew.push(live);
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(crew));
            } catch (_) {}
        }
    } catch (err) {
        console.error("Cannot load device from server:", err);
    }
    bootAstronautPage();

    if (window.PulsarLive && astronautId) {
        window.PulsarLive.connect({
            linkEl: document.getElementById("link-chip"),
            onDashboard(list) {
                const next = (list || []).find(
                    (p) => String(p.id) === String(astronautId)
                );
                if (!next) return;
                astronaut = next;
                const i = crew.findIndex((p) => String(p.id) === String(next.id));
                if (i >= 0) crew[i] = next;
                else crew.push(next);
                try {
                    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(crew));
                } catch (_) {}
                if (typeof renderProfile === "function") renderProfile();
                updateSidebarSos();
            },
            onSample(person) {
                if (String(person.id) !== String(astronautId)) return;
                astronaut = { ...astronaut, ...person };
                if (typeof renderProfile === "function") renderProfile();
                updateSidebarSos();
            },
        });
    }
})();

// ==================================================
// КІНЕЦЬ ASTRONAUT PROFILE
// ==================================================
