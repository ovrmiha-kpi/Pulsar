
// ==================================================
// PULSAR — HEALTH GUIDE
// ==================================================


// ==================================================
// 1. НАУКОВІ ДЖЕРЕЛА
// ==================================================

const guideSources = {

    challenge: {
        title: "NASA Space Apps Challenge 2026",
        description: "Health monitoring software challenge",
        url: "https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/"
    },

    hrp: {
        title: "NASA Human Research Program",
        description: "Human health and performance in space",
        url: "https://www.nasa.gov/hrp/"
    },

    hazards: {
        title: "Five Hazards of Human Spaceflight",
        description: "NASA classification of spaceflight hazards",
        url: "https://www.nasa.gov/hrp/hazards/"
    },

    body: {
        title: "The Human Body in Space",
        description: "Effects of spaceflight on the human body",
        url: "https://www.nasa.gov/humans-in-space/the-human-body-in-space/"
    },

    radiation: {
        title: "NASA — Space Radiation",
        description: "Radiation exposure and associated health risks",
        url: "https://www.nasa.gov/hrp/hazard-space-radiation/"
    },

    isolation: {
        title: "NASA — Isolation and Confinement",
        description: "Behavioral health and crew performance",
        url: "https://www.nasa.gov/hrp/hazard-isolation-and-confinement/"
    },

    gravity: {
        title: "NASA — Gravity Fields",
        description: "Human adaptation to altered gravity",
        url: "https://www.nasa.gov/hrp/hazard-gravity-fields/"
    },

    environment: {
        title: "NASA — Hostile/Closed Environments",
        description: "Spacecraft environmental health risks",
        url: "https://www.nasa.gov/hrp/hazard-hostile-closed-environments/"
    },

    medical: {
        title: "NASA — In-flight Medical Care",
        description: "Medical care during space missions",
        url: "https://www.nasa.gov/ochmo/health-and-medical-systems/in-flight-medical-care/"
    },

    operations: {
        title: "NASA — Medical Operations",
        description: "Crew health, fatigue and medical operations",
        url: "https://www.nasa.gov/reference/6-0-medical-operations/"
    },

    standards: {
        title: "NASA-STD-3001 — Crew Health",
        description: "Human spaceflight health requirements",
        url: "https://www.nasa.gov/reference/nasa-std-3001v1/"
    },

    training: {
        title: "NASA — Medical Training",
        description: "Medical training requirements for space crews",
        url: "https://www.nasa.gov/reference/5-0-training/"
    },

    osdr: {
        title: "NASA Open Science Data Repository",
        description: "Open spaceflight biology and scientific data",
        url: "https://science.nasa.gov/biological-physical/data/osdr/"
    }

};


// ==================================================
// 2. ПІДКЛЮЧЕННЯ ЗОБРАЖЕНЬ
// ==================================================

// Шляхи відповідають твоїй структурі папок!
// PULSAR/images/

const guideHazardImages = {

    R: "../images/radiation.jpg",

    I: "../images/isolation.jpg",

    D: "../images/distance.jpg",

    G: "../images/gravity.jpg",

    E: "../images/enviroment.jpg"

};


// ==================================================
// 3. ДОВІДНИК ПОКАЗНИКІВ
// ==================================================

const guideIndicators = [

    // ==============================================
    // PHYSICAL HEALTH
    // ==============================================

    {
        id: "pulse",
        name: "Heart Rate",
        category: "Physical Health",
        icon: "♡",
        unit: "bpm",

        sensor: "Optical heart rate sensor / PPG",

        description:
            "Heart rate is the number of heartbeats per minute.",

        importance:
            "Tracking heart rate helps identify changes " +
            "in cardiovascular activity during rest, " +
            "exercise and other mission activities.",

        measurement:
            "Wear the compatible heart rate sensor " +
            "as specified by its operating instructions. " +
            "Check sensor contact and measurement quality.",

        factors:
            "Movement, physical activity, sensor contact, " +
            "stress and individual physiological differences.",

        response:
            "Review the reading together with symptoms, " +
            "activity and the individual baseline. " +
            "Follow approved medical guidance when needed.",

        sources: ["body", "medical"]
    },


    {
        id: "oxygen",
        name: "Blood Oxygen",
        category: "Physical Health",
        icon: "O₂",
        unit: "%",

        sensor: "Compatible pulse oximeter",

        description:
            "SpO₂ estimates peripheral blood oxygen saturation.",

        importance:
            "Provides information about blood oxygenation.",

        measurement:
            "Use a compatible pulse oximetry sensor " +
            "according to its instructions and check signal quality.",

        factors:
            "Poor circulation, skin pigmentation, skin temperature, " +
            "motion and sensor placement may affect accuracy.",

        response:
            "Do not rely on SpO₂ alone to assess health. " +
            "Concerning symptoms require medical attention " +
            "regardless of the displayed value.",

        sources: ["medical"]
    },


    {
        id: "temperature",
        name: "Skin Temperature",
        category: "Physical Health",
        icon: "♨",
        unit: "°C",

        sensor: "Skin-contact temperature sensor",

        description:
            "Temperature measured at the surface of the skin.",

        importance:
            "Helps track changes in skin temperature " +
            "and the body's interaction with its environment.",

        measurement:
            "Use an appropriate skin-contact sensor " +
            "and follow the device instructions.",

        factors:
            "Air temperature, clothing, sensor position, " +
            "blood circulation and physical activity.",

        response:
            "Interpret readings in context. Skin temperature " +
            "is not equivalent to core body temperature " +
            "and cannot independently confirm fever.",

        sources: ["body", "medical"]
    },


    {
        id: "mass",
        name: "Body Mass",
        category: "Physical Health",
        icon: "◫",
        unit: "kg",

        sensor: "Gravity-compatible mass measurement instrument",

        description:
            "The mass of the astronaut's body.",

        importance:
            "Long-term changes may provide information " +
            "about nutrition and physical adaptation.",

        measurement:
            "Use a specialized mass measurement instrument " +
            "suitable for the mission's gravity conditions. " +
            "The wrist device alone cannot measure body mass.",

        factors:
            "Hydration, nutrition, measurement technique " +
            "and equipment calibration.",

        response:
            "Compare measurements with the individual " +
            "baseline and discuss unexpected changes " +
            "with the medical team.",

        sources: ["gravity", "body"]
    },


    {
        id: "gripStrength",
        name: "Grip Strength",
        category: "Physical Health",
        icon: "✊",
        unit: "N",

        sensor: "Grip dynamometer / calibrated force sensor",

        description:
            "The force produced by the hand muscles " +
            "during a grip measurement.",

        importance:
            "Repeated measurements can help track " +
            "changes in muscular performance.",

        measurement:
            "Use a calibrated grip measurement instrument " +
            "and the approved testing procedure.",

        factors:
            "Hand position, effort, fatigue, injury " +
            "and measurement technique.",

        response:
            "Compare results obtained under similar " +
            "conditions. Review persistent changes " +
            "with the medical team.",

        sources: ["gravity", "body"]
    },


    {
        id: "acceleration",
        name: "Acceleration",
        category: "Physical Health",
        icon: "↗",
        unit: "m/s²",

        sensor: "Accelerometer",

        description:
            "Sensor readings describing acceleration " +
            "along one or more axes.",

        importance:
            "Supports the analysis of movement, exercise " +
            "and changes in activity.",

        measurement:
            "The wearable accelerometer records motion. " +
            "Data interpretation depends on sensor " +
            "orientation and processing methods.",

        factors:
            "Sensor placement, vibration, orientation " +
            "and gravity conditions.",

        response:
            "Review unexpected signals together with " +
            "activity context and sensor quality. " +
            "Acceleration alone does not establish injury.",

        sources: ["gravity"]
    },


    {
        id: "movement",
        name: "Body Movement",
        category: "Physical Health",
        icon: "↔",
        unit: "Motion data",

        sensor: "Accelerometer / motion sensor",

        description:
            "Movement information obtained from " +
            "the wearable device.",

        importance:
            "Helps visualize changes in recorded " +
            "movement patterns during the mission.",

        measurement:
            "Wear the motion sensor in its specified position. " +
            "Movement data is processed by the system.",

        factors:
            "Wrist placement, activity type and movement " +
            "of the spacecraft or equipment.",

        response:
            "Check unusual movement patterns against " +
            "the astronaut's activity and reported symptoms.",

        sources: ["gravity"]
    },


    {
        id: "activity",
        name: "Physical Activity",
        category: "Physical Health",
        icon: "⚡",
        unit: "Activity estimate",

        sensor: "Processed wearable motion data",

        description:
            "An estimate of physical activity derived " +
            "from supported sensor data.",

        importance:
            "Supports monitoring of exercise routines " +
            "and changes in daily activity.",

        measurement:
            "Use the validated activity estimation method " +
            "provided by the monitoring system.",

        factors:
            "Exercise type, sensor placement, gravity " +
            "conditions and algorithm accuracy.",

        response:
            "Review changes alongside the mission schedule " +
            "and the approved exercise program.",

        sources: ["gravity", "body"]
    },


    // ==============================================
    // ENVIRONMENT & RADIATION
    // ==============================================

    {
        id: "pressure",
        name: "Atmospheric Pressure",
        category: "Environment & Radiation",
        icon: "◴",
        unit: "kPa",

        sensor: "Barometric pressure sensor",

        description:
            "The pressure exerted by the surrounding gas.",

        importance:
            "Pressure monitoring supports awareness " +
            "of spacecraft and habitat conditions.",

        measurement:
            "Use a calibrated atmospheric pressure sensor " +
            "within its supported operating range.",

        factors:
            "Sensor calibration, temperature, location " +
            "and spacecraft operating conditions.",

        response:
            "Follow the vehicle's approved procedures " +
            "for abnormal cabin pressure readings.",

        sources: ["environment", "standards"]
    },


    {
        id: "airTemperature",
        name: "Air Temperature",
        category: "Environment & Radiation",
        icon: "♨",
        unit: "K",

        sensor: "Ambient temperature sensor",

        description:
            "Temperature of the surrounding air, " +
            "expressed in kelvins.",

        importance:
            "Helps monitor thermal conditions inside " +
            "the spacecraft or habitat.",

        measurement:
            "Use an ambient temperature sensor. " +
            "Avoid interpreting body heat as air temperature.",

        factors:
            "Nearby equipment, airflow, body heat " +
            "and sensor placement.",

        response:
            "Review abnormal conditions using approved " +
            "habitat environmental procedures.",

        sources: ["environment"]
    },


    {
        id: "airOxygen",
        name: "Air Oxygen",
        category: "Environment & Radiation",
        icon: "O₂",
        unit: "%",

        sensor: "Environmental oxygen sensor",

        description:
            "The concentration of oxygen in the surrounding atmosphere.",

        importance:
            "Oxygen concentration and total pressure " +
            "are important for assessing breathing conditions.",

        measurement:
            "Use a calibrated environmental oxygen sensor " +
            "and the corresponding pressure measurement.",

        factors:
            "Total pressure, gas composition, sensor " +
            "calibration and sampling location.",

        response:
            "Follow approved cabin atmosphere procedures. " +
            "Do not confuse air oxygen with blood oxygen saturation.",

        sources: ["environment", "standards"]
    },


    {
        id: "airQuality",
        name: "Air Quality",
        category: "Environment & Radiation",
        icon: "≋",
        unit: "Sensor-specific",

        sensor: "Compatible air quality sensor",

        description:
            "Information about selected airborne pollutants " +
            "or other sensor-defined air quality parameters.",

        importance:
            "Supports monitoring of environmental conditions " +
            "inside enclosed habitats.",

        measurement:
            "Use the supported sensor according to its " +
            "calibration and operating instructions.",

        factors:
            "Sensor type, humidity, temperature, " +
            "cross-sensitivity and airflow.",

        response:
            "Interpret readings using the actual sensor's " +
            "measurement method and approved habitat procedures.",

        sources: ["environment"]
    },


    {
        id: "co2",
        name: "Carbon Dioxide",
        category: "Environment & Radiation",
        icon: "CO₂",
        unit: "ppm",

        sensor: "Carbon dioxide sensor",

        description:
            "The concentration of carbon dioxide " +
            "in the surrounding atmosphere.",

        importance:
            "CO₂ monitoring supports assessment of " +
            "ventilation and cabin environmental conditions.",

        measurement:
            "Use a calibrated CO₂ sensor with an " +
            "appropriate measurement range.",

        factors:
            "Ventilation, sampling location, nearby " +
            "breathing and calibration.",

        response:
            "Follow approved spacecraft procedures when " +
            "abnormal atmospheric conditions are reported.",

        sources: ["environment", "standards"]
    },


    {
        id: "radiation",
        name: "Radiation Rate",
        category: "Environment & Radiation",
        icon: "☢",
        unit: "µSv/h",

        sensor: "Calibrated radiation dosimeter",

        description:
            "The reported radiation dose-equivalent " +
            "rate at the detector location.",

        importance:
            "Helps monitor changes in radiation exposure " +
            "during a mission.",

        measurement:
            "Use a dosimeter suitable for the expected " +
            "radiation environment and measurement quantity.",

        factors:
            "Particle type, energy, detector response, " +
            "shielding and detector placement.",

        response:
            "Follow the mission's radiation safety procedures. " +
            "A wrist dosimeter may not represent the entire " +
            "body's exposure.",

        sources: ["radiation", "standards"]
    },


    {
        id: "radiationDose",
        name: "Accumulated Radiation",
        category: "Environment & Radiation",
        icon: "☢",
        unit: "mSv",

        sensor: "Dosimeter / validated dose processing",

        description:
            "The cumulative reported dose-equivalent " +
            "over a defined monitoring period.",

        importance:
            "Provides a history of recorded exposure " +
            "for long-duration mission monitoring.",

        measurement:
            "Use cumulative readings or validated dose " +
            "integration provided by the monitoring system.",

        factors:
            "Monitoring duration, missing measurements, " +
            "detector limitations and radiation type.",

        response:
            "Review cumulative exposure with the radiation " +
            "protection team and mission-specific limits.",

        sources: ["radiation", "standards"]
    },


    // ==============================================
    // WELL-BEING
    // ==============================================

    {
        id: "sleepDuration",
        name: "Sleep Duration",
        category: "Well-being",
        icon: "☾",
        unit: "hours",

        sensor: "Wearable motion data / validated sleep algorithm",

        description:
            "An estimate of time spent asleep.",

        importance:
            "Sleep monitoring supports the assessment " +
            "of fatigue and recovery patterns.",

        measurement:
            "Use the sleep estimate supplied by " +
            "the validated monitoring system.",

        factors:
            "Movement, sleep schedule, sensor contact " +
            "and the estimation algorithm.",

        response:
            "Review persistent changes with the crew's " +
            "approved fatigue management program.",

        sources: ["isolation", "operations"]
    },


    {
        id: "sleepQuality",
        name: "Sleep Quality",
        category: "Well-being",
        icon: "◇",
        unit: "Estimated category",

        sensor: "Validated sleep estimation algorithm",

        description:
            "An algorithm-based estimate of sleep quality.",

        importance:
            "Provides additional context for monitoring " +
            "rest and recovery.",

        measurement:
            "Display the sleep quality estimate received " +
            "from the monitoring system.",

        factors:
            "Movement, interruptions, sensor performance " +
            "and algorithm limitations.",

        response:
            "Treat wearable sleep quality as an estimate, " +
            "not a clinical sleep assessment.",

        sources: ["isolation", "operations"]
    },


    {
        id: "stressLevel",
        name: "Stress Level",
        category: "Well-being",
        icon: "◎",
        unit: "0–10 estimate",

        sensor: "Validated physiological data processing",

        description:
            "A system-defined estimate of physiological " +
            "stress based on supported measurements.",

        importance:
            "May provide context for changes in daily " +
            "well-being and recovery.",

        measurement:
            "Display the estimate supplied by the backend. " +
            "The algorithm and scale require validation.",

        factors:
            "Physical activity, sleep, illness, sensor " +
            "quality and individual variability.",

        response:
            "Interpret the estimate together with mood, " +
            "symptoms and activity. It does not diagnose " +
            "psychological or medical conditions.",

        sources: ["isolation", "operations"]
    }

];


// ==================================================
// 4. П'ЯТЬ НЕБЕЗПЕК NASA — RIDGE
// ==================================================

const guideHazards = [

    // ==============================================
    // R — SPACE RADIATION
    // ==============================================

    {
        letter: "R",
        name: "Space Radiation",
        icon: "☢",

        subtitle:
            "Exposure beyond Earth's protective environment",

        problem:
            "Deep-space missions expose crews to energetic " +
            "particles from solar activity and cosmic radiation.",

        effects:
            "Radiation can harm biological tissues and " +
            "contribute to long-term health risks.",

        solution:
            "PULSAR is designed to display radiation dose " +
            "rate, cumulative exposure, historical trends " +
            "and alerts supplied by the monitoring system.",

        prevention:
            "Mission radiation protection includes exposure " +
            "planning, suitable shielding and approved " +
            "radiation safety procedures.",

        indicators: [
            "Radiation Rate",
            "Accumulated Radiation",
            "Exposure History"
        ],

        features: [
            "Environment",
            "Analytics",
            "Crew Dashboard"
        ],

        limitation:
            "PULSAR provides monitoring, not physical " +
            "radiation protection. Detector suitability " +
            "must be established for spaceflight.",

        sources: ["radiation"]
    },


    // ==============================================
    // I — ISOLATION & CONFINEMENT
    // ==============================================

    {
        letter: "I",
        name: "Isolation & Confinement",
        icon: "◉",

        subtitle:
            "Behavioral health in isolated habitats",

        problem:
            "Long periods in confined environments can " +
            "place psychological and social demands on the crew.",

        effects:
            "Possible effects include disrupted sleep, " +
            "fatigue, mood changes and reduced performance.",

        solution:
            "PULSAR combines automatic sleep and stress " +
            "estimates with self-reported mood and notes. " +
            "The Analytics section visualizes changes over time.",

        prevention:
            "Approved crew support, workload management " +
            "and consistent rest schedules can help manage risk.",

        indicators: [
            "Sleep Duration",
            "Sleep Quality",
            "Stress Level",
            "Mood"
        ],

        features: [
            "Well-being Monitoring",
            "Daily Check-in",
            "Analytics"
        ],

        limitation:
            "Sensor-based estimates do not diagnose mental " +
            "health conditions and do not replace professional " +
            "psychological support.",

        sources: ["isolation", "operations"]
    },


    // ==============================================
    // D — DISTANCE FROM EARTH
    // ==============================================

    {
        letter: "D",
        name: "Distance from Earth",
        icon: "◎",

        subtitle:
            "Medical autonomy during deep-space missions",

        problem:
            "Increasing distance limits immediate " +
            "communication, resupply and access to Earth-based care.",

        effects:
            "Crews may need to manage medical events " +
            "with limited equipment and delayed external support.",

        solution:
            "PULSAR brings individual health readings, " +
            "medical information and educational resources " +
            "into one interface. The planned SOS integration " +
            "will notify other crew members through their bracelets.",

        prevention:
            "Medical training, mission-specific protocols " +
            "and appropriate onboard resources support autonomy.",

        indicators: [
            "Vital Signs",
            "Health History",
            "Medical Information"
        ],

        features: [
            "Health Guide",
            "Medical Card",
            "SOS System"
        ],

        limitation:
            "Real SOS delivery requires a working local network, " +
            "backend and compatible devices. PULSAR does not " +
            "replace trained medical personnel.",

        sources: ["hazards", "medical"]
    },


    // ==============================================
    // G — GRAVITY FIELDS
    // ==============================================

    {
        letter: "G",
        name: "Gravity Fields",
        icon: "↕",

        subtitle:
            "Human adaptation to changing gravity",

        problem:
            "Reduced or changing gravity alters how " +
            "the human body functions during spaceflight.",

        effects:
            "Muscle and bone changes, balance difficulties " +
            "and cardiovascular adaptation may occur.",

        solution:
            "PULSAR is designed to track body mass, grip " +
            "strength and movement data, and compare available " +
            "measurements with pre-flight baselines.",

        prevention:
            "Mission-approved exercise, nutrition and " +
            "medical monitoring support physical adaptation.",

        indicators: [
            "Body Mass",
            "Grip Strength",
            "Acceleration",
            "Body Movement",
            "Physical Activity"
        ],

        features: [
            "Physical Health",
            "Analytics",
            "Baseline Comparison"
        ],

        limitation:
            "Grip strength and motion data cannot directly " +
            "determine bone density. Body mass requires " +
            "appropriate measurement equipment.",

        sources: ["gravity", "body"]
    },


    // ==============================================
    // E — HOSTILE / CLOSED ENVIRONMENTS
    // ==============================================

    {
        letter: "E",
        name: "Hostile / Closed Environments",
        icon: "≋",

        subtitle:
            "Environmental safety inside spacecraft",

        problem:
            "Crew health depends on controlled conditions " +
            "within a spacecraft or planetary habitat.",

        effects:
            "Changes in atmospheric composition, pressure " +
            "and temperature may affect health and performance.",

        solution:
            "PULSAR is designed to display atmospheric pressure, " +
            "air temperature, oxygen, CO₂ and supported " +
            "air quality measurements.",

        prevention:
            "Environmental monitoring and approved life-support " +
            "procedures help maintain safe habitat conditions.",

        indicators: [
            "Atmospheric Pressure",
            "Air Temperature",
            "Air Oxygen",
            "Air Quality",
            "Carbon Dioxide"
        ],

        features: [
            "Environment",
            "Analytics",
            "Crew Dashboard"
        ],

        limitation:
            "PULSAR does not control life-support equipment " +
            "and does not replace certified spacecraft " +
            "environmental safety systems.",

        sources: ["environment"]
    }

];


// ==================================================
// 5. ЕКСТРЕНІ СИТУАЦІЇ
// ==================================================

const guideEmergencies = [

    {
        id: "unconscious",
        name: "Loss of Consciousness",
        icon: "⚠",

        description:
            "Unresponsiveness or sudden loss of consciousness.",

        signs:
            "Collapse, failure to respond or unexpected " +
            "changes in awareness.",

        related: [
            "Heart Rate",
            "Blood Oxygen"
        ]
    },


    {
        id: "cardiac",
        name: "Cardiac Emergency",
        icon: "♡",

        description:
            "A suspected serious cardiovascular event.",

        signs:
            "Chest discomfort, collapse, fainting or " +
            "other concerning cardiovascular symptoms.",

        related: [
            "Heart Rate",
            "Blood Oxygen"
        ]
    },


    {
        id: "breathing",
        name: "Breathing Difficulties",
        icon: "O₂",

        description:
            "Respiratory symptoms or suspected breathing emergency.",

        signs:
            "Severe breathlessness, abnormal breathing " +
            "or unexpected changes in consciousness.",

        related: [
            "Blood Oxygen",
            "Air Oxygen",
            "Carbon Dioxide",
            "Atmospheric Pressure"
        ]
    },


    {
        id: "thermal",
        name: "Thermal Emergency",
        icon: "♨",

        description:
            "Suspected illness related to heat or cold exposure.",

        signs:
            "Concerning symptoms during thermal exposure, " +
            "including confusion or collapse.",

        related: [
            "Skin Temperature",
            "Air Temperature"
        ]
    },


    {
        id: "radiation",
        name: "Radiation Exposure",
        icon: "☢",

        description:
            "Unexpected radiation exposure or a radiation alert.",

        signs:
            "Dosimeter or mission radiation alerts. " +
            "Exposure may occur without immediate symptoms.",

        related: [
            "Radiation Rate",
            "Accumulated Radiation"
        ]
    },


    {
        id: "environment",
        name: "Environmental Emergency",
        icon: "≋",

        description:
            "A suspected unsafe spacecraft atmosphere " +
            "or habitat condition.",

        signs:
            "Cabin safety alarms or reported abnormal " +
            "atmospheric conditions.",

        related: [
            "Atmospheric Pressure",
            "Air Oxygen",
            "Carbon Dioxide",
            "Air Quality"
        ]
    },


    {
        id: "trauma",
        name: "Physical Injuries",
        icon: "✚",

        description:
            "Accidental injuries, wounds, fractures " +
            "and bleeding during a space mission.",

        signs:
            "Visible wounds, swelling, bleeding, severe pain " +
            "or loss of normal function.",

        related: [
            "Heart Rate",
            "Blood Oxygen",
            "Movement Data"
        ]
    },


    {
        id: "other",
        name: "Other Emergency",
        icon: "!",

        description:
            "An urgent situation outside the listed categories.",

        signs:
            "Sudden severe symptoms or unexpected " +
            "deterioration in the astronaut's condition.",

        related: [
            "Available Vital Signs",
            "Medical Card"
        ]
    }

];


// ==================================================
// 6. ДОПОМІЖНІ ФУНКЦІЇ
// ==================================================


// Захист текстових даних

function escapeGuideText(value) {

    return String(value ?? "—")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

}


// Створення посилань на джерела

function createGuideSources(keys) {

    return keys.map(key => {

        const source = guideSources[key];

        if (!source) return "";

        return `

            <a class="guide-source-link"
               href="${escapeGuideText(source.url)}"
               target="_blank"
               rel="noopener noreferrer">

                ${escapeGuideText(source.title)} ↗

            </a>

        `;

    }).join("");

}


// Створення позначок показників

function createGuideTags(items) {

    return `

        <div class="guide-tags">

            ${items.map(item => `

                <span class="guide-tag">

                    ${escapeGuideText(item)}

                </span>

            `).join("")}

        </div>

    `;

}


// Створення інформаційного блоку

function createGuideDetail(title, text) {

    return `

        <div class="guide-detail-section">

            <h3>${escapeGuideText(title)}</h3>

            <p>${escapeGuideText(text)}</p>

        </div>

    `;

}


// ==================================================
// 7. КАРТКИ ПОКАЗНИКІВ
// ==================================================

function createGuideIndicatorCard(item) {

    return `

        <button type="button"
                class="guide-indicator-card"
                data-guide-indicator="${escapeGuideText(item.id)}">

            <span class="guide-card-icon"
                  aria-hidden="true">

                ${escapeGuideText(item.icon)}

            </span>

            <strong>
                ${escapeGuideText(item.name)}
            </strong>

            <span class="guide-card-unit">
                ${escapeGuideText(item.unit)}
            </span>

            <span class="guide-card-link">
                Learn more →
            </span>

        </button>

    `;

}


// ==================================================
// 8. ПОШУК ТА ФІЛЬТРАЦІЯ
// ==================================================

function renderGuideIndicators(container, search = "") {

    const query = search.trim().toLowerCase();


    const filtered = guideIndicators.filter(item => {

        const text = [

            item.name,
            item.category,
            item.sensor,
            item.description,
            item.unit

        ].join(" ").toLowerCase();

        return text.includes(query);

    });


    const categories = [

        "Physical Health",

        "Environment & Radiation",

        "Well-being"

    ];


    // Якщо нічого не знайдено

    if (!filtered.length) {

        container.innerHTML = `

            <div class="guide-empty">

                No matching indicators found.

            </div>

        `;

        return;

    }


    // Формування категорій

    container.innerHTML = categories.map(category => {

        const items = filtered.filter(
            item => item.category === category
        );

        if (!items.length) return "";


        return `

            <div class="guide-category">

                <div class="guide-category-header">

                    <h3>
                        ${escapeGuideText(category)}
                    </h3>

                    <span>
                        ${items.length} indicators
                    </span>

                </div>

                <div class="guide-indicator-grid">

                    ${items.map(
                        createGuideIndicatorCard
                    ).join("")}

                </div>

            </div>

        `;

    }).join("");

}


// ==================================================
// 9. МОДАЛЬНЕ ВІКНО
// ==================================================

function openGuideModal(
    title,
    icon,
    content,
    emergency = false
) {

    if (document.getElementById("guide-modal")) {

        return null;

    }


    const dialog = document.createElement("dialog");

    dialog.id = "guide-modal";

    dialog.className = emergency

        ? "guide-modal emergency-guide-modal"

        : "guide-modal";


    dialog.setAttribute(
        "aria-labelledby",
        "guide-modal-title"
    );


    dialog.innerHTML = `

        <div class="guide-modal-content">

            <div class="guide-modal-header">

                <span class="guide-modal-icon"
                      aria-hidden="true">

                    ${escapeGuideText(icon)}

                </span>

                <h2 id="guide-modal-title">

                    ${escapeGuideText(title)}

                </h2>

                <button type="button"
                        class="guide-modal-close"
                        aria-label="Close">

                    &times;

                </button>

            </div>


            ${content}


            <button type="button"
                    class="guide-close-button">

                Close Details

            </button>

        </div>

    `;


    document.body.appendChild(dialog);


    // Закриття вікна

    dialog.querySelector(".guide-modal-close")
        .addEventListener("click", () => {

            dialog.close();

        });


    dialog.querySelector(".guide-close-button")
        .addEventListener("click", () => {

            dialog.close();

        });


    dialog.addEventListener("click", event => {

        if (event.target === dialog) {

            dialog.close();

        }

    });


    dialog.addEventListener("close", () => {

        dialog.remove();

    });


    dialog.showModal();

    return dialog;

}


// ==================================================
// 10. ДЕТАЛЬНА ІНФОРМАЦІЯ ПРО ПОКАЗНИК
// ==================================================

function openGuideIndicator(id) {

    const item = guideIndicators.find(
        indicator => indicator.id === id
    );

    if (!item) return;


    const content = `

        <div class="guide-indicator-overview">

            <div>

                <span>Measurement Unit</span>

                <strong>
                    ${escapeGuideText(item.unit)}
                </strong>

            </div>

            <div>

                <span>Measurement Method</span>

                <strong>
                    ${escapeGuideText(item.sensor)}
                </strong>

            </div>

        </div>


        ${createGuideDetail(

            "What does it measure?",

            item.description

        )}


        ${createGuideDetail(

            "Why is it important?",

            item.importance

        )}


        ${createGuideDetail(

            "How is it measured?",

            item.measurement

        )}


        ${createGuideDetail(

            "Factors affecting accuracy",

            item.factors

        )}


        ${createGuideDetail(

            "Abnormal readings",

            item.response

        )}


        <div class="guide-detail-section">

            <h3>Related Scientific Resources</h3>

            ${createGuideSources(item.sources)}

        </div>


        <div class="guide-notice">

            Educational information only.
            Device-specific measurement instructions
            and medical thresholds require validation
            before operational use.

        </div>

    `;


    openGuideModal(

        item.name,

        item.icon,

        content

    );

}


// ==================================================
// 11. КАРТКИ RIDGE З ФОТОГРАФІЯМИ
// ==================================================

function createGuideHazard(hazard) {

    // Отримуємо шлях до відповідної фотографії

    const imagePath = guideHazardImages[hazard.letter];


    return `

        <details class="guide-hazard-card">


            <!-- ФОТОГРАФІЯ ТА ЗАГОЛОВОК -->

            <summary class="guide-hazard-summary
                            guide-hazard-visual">


                <!-- Підключення фотографії -->

                <img

                    class="guide-hazard-image"

                    src="${escapeGuideText(imagePath)}"

                    alt=""

                    loading="lazy"

                >


                <!-- Затемнення фотографії -->

                <div class="guide-hazard-overlay">
                </div>


                <!-- Текст поверх фотографії -->

                <div class="guide-hazard-cover-content">


                    <div class="guide-hazard-letter">

                        ${escapeGuideText(hazard.letter)}

                    </div>


                    <span class="guide-hazard-icon"
                          aria-hidden="true">

                        ${escapeGuideText(hazard.icon)}

                    </span>


                    <div class="guide-hazard-heading">

                        <h3>

                            ${escapeGuideText(hazard.name)}

                        </h3>

                        <p>

                            ${escapeGuideText(hazard.subtitle)}

                        </p>

                    </div>


                    <span class="guide-expand-icon"
                          aria-hidden="true">

                        ⌄

                    </span>

                </div>


                <span class="guide-hazard-cover-label">

                    EXPLORE HAZARD →

                </span>

            </summary>


            <!-- РОЗШИРЕНА ІНФОРМАЦІЯ -->

            <div class="guide-hazard-content">


                <!-- Проблема -->

                ${createGuideDetail(

                    "The Problem",

                    hazard.problem

                )}


                <!-- Вплив на здоров'я -->

                ${createGuideDetail(

                    "Health Effects",

                    hazard.effects

                )}


                <!-- Рішення PULSAR -->

                <div class="guide-solution">

                    <h3>◈ PULSAR Solution</h3>

                    <p>

                        ${escapeGuideText(hazard.solution)}

                    </p>

                </div>


                <!-- Пов'язані показники -->

                <div class="guide-detail-section">

                    <h3>Related Indicators</h3>

                    ${createGuideTags(hazard.indicators)}

                </div>


                <!-- Функції PULSAR -->

                <div class="guide-detail-section">

                    <h3>Related PULSAR Features</h3>

                    ${createGuideTags(hazard.features)}

                </div>


                <!-- Зменшення ризиків -->

                ${createGuideDetail(

                    "Risk Mitigation",

                    hazard.prevention

                )}


                <!-- Обмеження -->

                <div class="guide-limitations">

                    <h3>Limitations</h3>

                    <p>

                        ${escapeGuideText(hazard.limitation)}

                    </p>

                </div>


                <!-- Наукові джерела -->

                <div class="guide-detail-section">

                    <h3>Scientific Sources</h3>

                    ${createGuideSources(hazard.sources)}

                </div>

            </div>

        </details>

    `;

}


// ==================================================
// 12. КАРТКИ ЕКСТРЕНИХ СИТУАЦІЙ
// ==================================================

function createGuideEmergency(item) {

    return `

        <button type="button"
                class="guide-emergency-card"
                data-guide-emergency="${escapeGuideText(item.id)}">

            <span class="guide-emergency-icon"
                  aria-hidden="true">

                ${escapeGuideText(item.icon)}

            </span>

            <strong>

                ${escapeGuideText(item.name)}

            </strong>

            <p>

                ${escapeGuideText(item.description)}

            </p>

            <span class="guide-emergency-link">

                View guidance →

            </span>

        </button>

    `;

}


// ==================================================
// 13. ДЕТАЛЬНА ІНФОРМАЦІЯ ПРО ЕКСТРЕНУ СИТУАЦІЮ
// ==================================================

function openGuideEmergency(id) {

    const item = guideEmergencies.find(
        emergency => emergency.id === id
    );

    if (!item) return;


    const content = `

        <!-- Попередження -->

        <div class="guide-protocol-notice">

            <strong>

                Educational reference — not an approved protocol

            </strong>

            <p>

                Mission-specific emergency procedures
                must be validated by qualified medical
                and mission safety personnel.

            </p>

        </div>


        ${createGuideDetail(

            "Emergency Overview",

            item.description

        )}


        ${createGuideDetail(

            "Possible Warning Signs",

            item.signs

        )}


        <div class="guide-detail-section">

            <h3>Related Measurements</h3>

            ${createGuideTags(item.related)}

        </div>


        ${createGuideDetail(

            "Emergency Response",

            "Contact the trained crew medical officer " +
            "and follow the approved mission emergency " +
            "procedures. Do not delay emergency care " +
            "while reviewing sensor readings."

        )}


        ${createGuideDetail(

            "Required Equipment",

            "Refer to the mission-specific medical kit " +
            "and approved emergency protocol."

        )}


        ${createGuideDetail(

            "Safety Considerations",

            "Do not use unvalidated wearable readings " +
            "as the sole basis for diagnosis or treatment. " +
            "Do not enter an unsafe environment."

        )}


        <div class="guide-detail-section">

            <h3>Protocol Status</h3>

            <span class="guide-protocol-status">

                Mission-specific protocol not loaded

            </span>

        </div>


        <div class="guide-detail-section">

            <h3>Medical Reference Resources</h3>

            ${createGuideSources([

                "medical",

                "standards",

                "training"

            ])}

        </div>

    `;


    const dialog = openGuideModal(

        item.name,

        item.icon,

        content,

        true

    );


    if (!dialog) return;


    // ==============================================
    // КНОПКА SOS
    // ==============================================

    if (

        typeof astronaut === "undefined" ||

        !astronaut ||

        typeof openSosDialog !== "function"

    ) {

        return;

    }


    const closeButton = dialog.querySelector(
        ".guide-close-button"
    );


    const sosButton = document.createElement("button");

    sosButton.type = "button";

    sosButton.className = "guide-sos-button";

    sosButton.textContent = "SOS / Emergency";


    closeButton.before(sosButton);


    sosButton.addEventListener("click", () => {

        dialog.addEventListener("close", () => {

            openSosDialog(astronaut);

        }, { once: true });


        dialog.close();

    });

}


// ==================================================
// 14. НАУКОВІ РЕСУРСИ
// ==================================================

function createScientificResources() {

    return Object.values(guideSources).map(source => `

        <a class="guide-resource-card"
           href="${escapeGuideText(source.url)}"
           target="_blank"
           rel="noopener noreferrer">

            <span class="guide-resource-icon"
                  aria-hidden="true">

                ▤

            </span>


            <div class="guide-resource-info">

                <strong>

                    ${escapeGuideText(source.title)}

                </strong>

                <p>

                    ${escapeGuideText(source.description)}

                </p>

            </div>


            <span class="guide-resource-arrow"
                  aria-hidden="true">

                ↗

            </span>

        </a>

    `).join("");

}


// ==================================================
// 15. ГОЛОВНА ФУНКЦІЯ HEALTH GUIDE
// ==================================================

function renderHealthGuide(container) {

    if (!container) return;


    container.innerHTML = `

        <div class="guide-layout">


            <!-- ==================================
                 1. MEASUREMENT GUIDE
            =================================== -->

            <section class="guide-panel">

                <div class="guide-panel-header">

                    <div class="guide-section-icon">
                        ♡
                    </div>

                    <div>

                        <h2>Measurement Guide</h2>

                        <p>

                            Understand your health and
                            environmental indicators.

                        </p>

                    </div>

                </div>


                <!-- Пошук -->

                <div class="guide-search">

                    <span aria-hidden="true">⌕</span>

                    <input type="search"
                           id="guide-search"
                           aria-label="Search health indicators"
                           placeholder="Search health indicators...">

                </div>


                <!-- Картки показників -->

                <div id="guide-indicators"></div>

            </section>


            <!-- ==================================
                 2. SPACEFLIGHT HAZARDS
            =================================== -->

            <section class="guide-panel">

                <div class="guide-panel-header">

                    <div class="guide-section-icon">
                        ◎
                    </div>

                    <div>

                        <h2>Spaceflight Hazards</h2>

                        <p>

                            Five major hazards of human
                            spaceflight and PULSAR's
                            monitoring approach.

                        </p>

                    </div>

                </div>


                <!-- RIDGE -->

                <div class="guide-ridge">

                    ${["R", "I", "D", "G", "E"].map(letter => `

                        <span>${letter}</span>

                    `).join("")}

                </div>


                <!-- Картки з фотографіями -->

                <div class="guide-hazard-list">

                    ${guideHazards.map(
                        createGuideHazard
                    ).join("")}

                </div>

            </section>


            <!-- ==================================
                 3. EMERGENCY INSTRUCTIONS
            =================================== -->

            <section class="guide-panel">

                <div class="guide-panel-header">

                    <div class="guide-section-icon emergency">
                        ⚠
                    </div>

                    <div>

                        <h2>Emergency Instructions</h2>

                        <p>

                            Emergency categories and
                            mission medical references.

                        </p>

                    </div>

                </div>


                <div class="guide-emergency-grid">

                    ${guideEmergencies.map(
                        createGuideEmergency
                    ).join("")}

                </div>


                <div class="guide-notice">

                    Emergency reference content is educational.
                    Approved mission-specific medical protocols
                    are required for operational use.

                </div>

            </section>


            <!-- ==================================
                 4. SCIENTIFIC RESOURCES
            =================================== -->

            <section class="guide-panel">

                <div class="guide-panel-header">

                    <div class="guide-section-icon">
                        ▤
                    </div>

                    <div>

                        <h2>Scientific Resources</h2>

                        <p>

                            Official scientific and medical
                            reference materials.

                        </p>

                    </div>

                </div>


                <div class="guide-resource-grid">

                    ${createScientificResources()}

                </div>


                <div class="guide-footer-note">

                    PULSAR is a demonstration project.
                    References to scientific and medical
                    organizations do not imply endorsement,
                    certification or clinical validation
                    of this system.

                </div>

            </section>

        </div>

    `;


    // ==============================================
    // ПОЧАТКОВЕ ВІДОБРАЖЕННЯ ПОКАЗНИКІВ
    // ==============================================

    const indicatorContainer = container.querySelector(
        "#guide-indicators"
    );

    const search = container.querySelector(
        "#guide-search"
    );


    renderGuideIndicators(indicatorContainer);


    // ==============================================
    // ПОШУК ПОКАЗНИКІВ
    // ==============================================

    search.addEventListener("input", function () {

        renderGuideIndicators(

            indicatorContainer,

            search.value

        );

    });


    // ==============================================
    // ВІДКРИТТЯ КАРТОК ПОКАЗНИКІВ
    // ==============================================

    indicatorContainer.addEventListener(
        "click",
        function (event) {

            const button = event.target.closest(
                "[data-guide-indicator]"
            );

            if (!button) return;

            openGuideIndicator(
                button.dataset.guideIndicator
            );

        }
    );


    // ==============================================
    // ВІДКРИТТЯ ЕКСТРЕНИХ КАРТОК
    // ==============================================

    container.querySelectorAll(
        "[data-guide-emergency]"
    ).forEach(button => {

        button.addEventListener("click", function () {

            openGuideEmergency(
                button.dataset.guideEmergency
            );

        });

    });


    // ==============================================
    // ПЕРЕВІРКА ЗАВАНТАЖЕННЯ ФОТОГРАФІЙ
    // ==============================================

    container.querySelectorAll(
        ".guide-hazard-image"
    ).forEach(image => {

        // Якщо фото не знайдено,
        // залишаємо темний фон картки.

        function handleImageError() {

            console.error(
                "Cannot load hazard image:",
                image.src
            );

            image.style.display = "none";

        }


        image.addEventListener(
            "error",
            handleImageError
        );


        if (image.complete && image.naturalWidth === 0) {

            handleImageError();

        }

    });

}
