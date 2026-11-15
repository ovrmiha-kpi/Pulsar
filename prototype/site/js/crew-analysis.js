
// ==================================================
// PULSAR — CREW ENVIRONMENTAL ANALYSIS
// ==================================================

(function () {

    "use strict";

    // ==================================================
    // ОСНОВНІ НАЛАШТУВАННЯ
    // ==================================================

    const CREW_STORAGE_KEY = "pulsar_live_crew_cache";
    const HABITAT_STORAGE_KEY = "pulsar_habitat_data";

    const HOUR = 60 * 60 * 1000;

    // ==================================================
    // ПАРАМЕТРИ КОСМІЧНОГО СЕРЕДОВИЩА
    // ==================================================

    const environmentalMetrics = {

        co2: {
            name: "Carbon Dioxide",
            shortName: "CO₂",
            unit: "ppm",
            decimals: 0,
            elementId: "habitat-co2"
        },

        airOxygen: {
            name: "Air Oxygen",
            shortName: "O₂",
            unit: "%",
            decimals: 1,
            elementId: "habitat-oxygen"
        },

        pressure: {
            name: "Atmospheric Pressure",
            shortName: "Pressure",
            unit: "kPa",
            decimals: 1,
            elementId: "habitat-pressure"
        },

        airTemperature: {
            name: "Air Temperature",
            shortName: "Temperature",
            unit: "K",
            decimals: 1,
            elementId: "habitat-temperature"
        },

        radiation: {
            name: "Radiation Rate",
            shortName: "Radiation",
            unit: "µSv/h",
            decimals: 2,
            elementId: "habitat-radiation"
        },

        airQuality: {
            name: "Air Quality",
            shortName: "Air Quality",
            unit: "",
            decimals: 0,
            elementId: "habitat-air-quality"
        }

    };

    // ==================================================
    // ДЕМОНСТРАЦІЙНІ КРИТЕРІЇ
    // ==================================================

    // Умовні пороги для синтетичних сценаріїв.
    // Не є клінічними нормами або стандартами NASA.

    const demoCriteria = {

        co2: {
            environmentAbove: 3500,
            symptom: "headache"
        },

        airOxygen: {
            environmentBelow: 19.5,
            healthKey: "oxygen",
            healthBelow: 94
        },

        pressure: {
            environmentBelow: 95,
            healthKey: "oxygen",
            healthBelow: 94
        },

        airTemperature: {
            environmentAbove: 299,
            healthKey: "temperature",
            healthAbove: 35.5
        }

    };

    // ==================================================
    // ПРАВИЛА ЗІСТАВЛЕННЯ ПОКАЗНИКІВ
    // ==================================================

    const ruleDefinitions = {

        co2: {
            title: "CO₂ and Reported Headache",
            healthLabel: "Reported headache",
            healthKey: null,
            symptom: "headache",

            description:
                "Reported headaches coincide with " +
                "CO₂ observations outside the configured range."
        },

        airOxygen: {
            title: "Atmospheric Oxygen and Blood Oxygen",
            healthLabel: "Reduced blood oxygen",
            healthKey: "oxygen",

            description:
                "Blood oxygen observations coincide with " +
                "changes in habitat oxygen concentration."
        },

        pressure: {
            title: "Atmospheric Pressure and Blood Oxygen",
            healthLabel: "Reduced blood oxygen",
            healthKey: "oxygen",

            description:
                "Blood oxygen observations coincide with " +
                "changes in atmospheric pressure."
        },

        airTemperature: {
            title: "Habitat Temperature and Skin Temperature",
            healthLabel: "Increased skin temperature",
            healthKey: "temperature",

            description:
                "Skin temperature observations coincide with " +
                "changes in habitat air temperature."
        }

    };

    // ==================================================
    // HTML-ЕЛЕМЕНТИ
    // ==================================================

    function byId(id) {
        return document.getElementById(id);
    }

    const page =
        document.querySelector(".crew-analysis-page");

    const sourceSelect =
        byId("analysis-source");

    const scenarioSelect =
        byId("analysis-scenario");

    const periodSelect =
        byId("analysis-period");

    const metricSelect =
        byId("correlation-metric");

    const runButton =
        byId("run-crew-analysis");

    // ==================================================
    // ПОТОЧНИЙ СТАН
    // ==================================================

    let currentDataset = null;
    let currentAnalysis = null;

    let selectedCrewId = null;
    let selectedMetric = "co2";

    let chartObserver = null;
    let resizeFrame = null;

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

    function setText(id, value) {

        const element = byId(id);

        if (element) {
            element.textContent = value ?? "—";
        }
    }

    function isNumber(value) {

        return typeof value === "number" &&
            Number.isFinite(value);
    }

    function formatNumber(value, decimals = 0) {

        return isNumber(value)

            ? value.toFixed(decimals)

            : "—";
    }

    function formatTime(timestamp) {

        if (!isNumber(timestamp)) {
            return "—";
        }

        return new Date(timestamp)
            .toLocaleTimeString("en-GB", {

                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });
    }

    function formatDateTime(timestamp) {

        if (!isNumber(timestamp)) {
            return "—";
        }

        return new Date(timestamp)
            .toLocaleString("en-GB", {

                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
    }

    // ==================================================
    // ПЕРЕВІРКА ЧАСОВОЇ МІТКИ
    // ==================================================

    function parseTimestamp(value) {

        if (isNumber(value)) {
            return value;
        }

        if (typeof value !== "string") {
            return null;
        }

        // Дата повинна містити часовий пояс.

        if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
            return null;
        }

        const timestamp = Date.parse(value);

        return Number.isFinite(timestamp)

            ? timestamp

            : null;
    }

    // Ініціали астронавта

    function getInitials(name) {

        return String(name || "Unknown")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(word => word.charAt(0))
            .join("")
            .toUpperCase();
    }

    // ==================================================
    // ЧИТАННЯ ДАНИХ ЗІ СХОВИЩА
    // ==================================================

    function readStorage(key, fallback) {

        try {

            const stored = sessionStorage.getItem(key);

            return stored

                ? JSON.parse(stored)

                : fallback;

        } catch (error) {

            console.error(
                "Cannot read analysis storage:",
                key,
                error
            );

            return fallback;
        }
    }

    // ==================================================
    // ОТРИМАННЯ ЕКІПАЖУ
    // ==================================================

    function getCrew() {

        const stored = readStorage(
            CREW_STORAGE_KEY,
            []
        );

        if (!Array.isArray(stored)) {
            return [];
        }

        const usedIds = new Set();

        return stored.filter(person => {

            if (

                !person ||

                typeof person.name !== "string" ||

                person.id == null ||

                usedIds.has(String(person.id))

            ) {
                return false;
            }

            usedIds.add(String(person.id));

            return true;
        });
    }

    // Середнє значення

    function average(values) {

        if (!values.length) {
            return null;
        }

        return values.reduce(
            (sum, value) => sum + value,
            0
        ) / values.length;
    }

    // Видалення повторів

    function unique(values) {

        return [...new Set(values)];
    }

    // ==================================================
    // ПЕРЕВІРКА ВИМІРЮВАНЬ
    // ==================================================

    function validMetric(key, value) {

        if (!isNumber(value)) {
            return false;
        }

        switch (key) {

            case "oxygen":
            case "airOxygen":

                return value >= 0 && value <= 100;

            case "pulse":

                return value > 0;

            case "pressure":
            case "airTemperature":

                return value > 0;

            case "co2":
            case "radiation":

                return value >= 0;

            case "temperature":

                return true;

            default:

                return true;
        }
    }

    // ==================================================
    // СТВОРЕННЯ ДЕМОНСТРАЦІЙНИХ ДАНИХ
    // ==================================================

    function createDemoDataset(crew, scenario, now) {

        const habitatId = "DEMO-HABITAT-01";

        const environment = [];
        const observations = [];

        // Створюємо історію за останні 24 години.
        // Синтетичні записи не зберігаються у сховищі.

        for (let hour = 0; hour < 24; hour++) {

            const timestamp =

                now - (23 - hour) * HOUR -

                5 * 60 * 1000;

            const recent = hour >= 18;

            const progress = recent

                ? (hour - 17) / 6

                : 0;

            // ==========================================
            // БАЗОВІ ПАРАМЕТРИ СЕРЕДОВИЩА
            // ==========================================

            const habitat = {

                timestamp,
                habitatId,

                source: "demo",

                quality: "valid",

                co2: 1800 + (hour % 4) * 70,

                airOxygen: 21,

                pressure: 101.3,

                airTemperature: 295.2,

                radiation: null,

                airQuality: null
            };

            // ==========================================
            // ELEVATED CO₂
            // ==========================================

            if (scenario === "co2" && recent) {

                habitat.co2 = Math.round(

                    1800 + progress * 2400
                );
            }

            // ==========================================
            // OXYGEN & PRESSURE CHANGES
            // ==========================================

            if (scenario === "oxygen" && recent) {

                habitat.airOxygen = Number(

                    (21 - progress * 2.6).toFixed(1)
                );

                habitat.pressure = Number(

                    (101.3 - progress * 8.3).toFixed(1)
                );
            }

            // ==========================================
            // THERMAL STRESS
            // ==========================================

            if (scenario === "thermal" && recent) {

                habitat.airTemperature = Number(

                    (295.2 + progress * 6).toFixed(1)
                );
            }

            // ==========================================
            // INSUFFICIENT DATA
            // ==========================================

            if (

                scenario === "insufficient" &&

                hour % 8 !== 0

            ) {

                habitat.co2 = null;

                habitat.airOxygen = null;

                habitat.pressure = null;

                habitat.airTemperature = null;
            }

            environment.push(habitat);

            // ==========================================
            // ДАНІ ЧЛЕНІВ ЕКІПАЖУ
            // ==========================================

            crew.forEach((person, index) => {

                const observation = {

                    astronautId: String(person.id),

                    habitatId,

                    timestamp,

                    source: "demo",

                    quality: "valid",

                    pulse: 71 + index * 2 + hour % 3,

                    oxygen: 98 - index % 2,

                    temperature: Number(

                        (33.8 + index * 0.15).toFixed(1)
                    ),

                    symptoms: []
                };

                // CO₂ та головний біль

                if (

                    scenario === "co2" &&

                    recent &&

                    progress >= 0.8 &&

                    (index === 0 || index === 2)

                ) {

                    observation.symptoms = [
                        "headache"
                    ];

                    observation.pulse += 5;
                }

                // Кисень та сатурація

                if (

                    scenario === "oxygen" &&

                    recent &&

                    progress >= 0.8 &&

                    index < 2

                ) {

                    observation.oxygen = 92 - index;

                    observation.pulse += 8;

                    observation.symptoms = [
                        "fatigue"
                    ];
                }

                // Температурні зміни

                if (

                    scenario === "thermal" &&

                    recent &&

                    progress >= 0.8 &&

                    index < 3

                ) {

                    observation.temperature =

                        36 + index * 0.2;

                    observation.pulse += 7;

                    observation.symptoms = [
                        "fatigue"
                    ];
                }

                // Індивідуальна проблема

                if (

                    scenario === "individual" &&

                    recent &&

                    index === 0

                ) {

                    observation.symptoms = [
                        "headache"
                    ];
                }

                // Недостатньо вимірювань

                if (

                    scenario === "insufficient" &&

                    (index !== 0 || hour % 8 !== 0)

                ) {
                    return;
                }

                observations.push(observation);
            });
        }

        return {

            source: "demo",

            habitatId,

            habitatName: "Lunar Habitat — Simulation",

            crew,

            environment,

            observations,

            criteria: demoCriteria,

            now
        };
    }

    // ==================================================
    // НОВИЙ СЦЕНАРІЙ
    // RECORDED DEMO CHECK-INS
    // ==================================================

    function createRecordedDemoDataset(crew, now) {

        // Використовуємо синтетичне середовище CO₂.

        const dataset = createDemoDataset(
            crew,
            "co2",
            now
        );

        dataset.recordedDemo = true;

        dataset.habitatName =

            "Lunar Habitat — Recorded Demo";

        // Аналізуємо лише CO₂ та головний біль.

        dataset.criteria = {

            co2: demoCriteria.co2
        };

        // Видаляємо синтетичні показники здоров'я.
        // Замість них використовуємо збережені опитування.

        dataset.observations = [];

        // Перевіряємо історію кожного астронавта.

        for (const person of crew) {

            const history = Array.isArray(
                person.checkinHistory
            )

                ? [...person.checkinHistory]

                : [];

            // Підтримка останнього окремого запису

            if (person.checkin) {

                history.push(person.checkin);
            }

            const seen = new Set();

            for (const item of history) {

                // Не змішуємо джерела даних.

                if (

                    item?.source !== "demo" ||

                    item.habitatId !== dataset.habitatId

                ) {
                    continue;
                }

                // Перевіряємо дату запису.

                const timestamp =
                    parseTimestamp(item.date);

                if (

                    !isNumber(timestamp) ||

                    timestamp > now ||

                    timestamp <= now - 24 * HOUR ||

                    seen.has(timestamp)

                ) {
                    continue;
                }

                // Захист від дублювання

                seen.add(timestamp);

                // ======================================
                // СТРУКТУРОВАНІ СИМПТОМИ
                // ======================================

                const symptoms =

                    Array.isArray(
                        item.structuredSymptoms
                    ) &&

                    item.structuredSymptoms.every(

                        value =>
                            typeof value === "string" &&
                            value.trim()
                    )

                        ? unique(

                            item.structuredSymptoms.map(

                                value =>
                                    value.trim()
                                        .toLowerCase()
                            )
                        )

                        : null;

                // null — симптоми не оцінювалися.
                // [] — симптомів не повідомлено.

                dataset.observations.push({

                    astronautId: String(person.id),

                    habitatId: dataset.habitatId,

                    source: "demo",

                    quality: "valid",

                    timestamp,

                    symptoms
                });
            }
        }

        return dataset;
    }

    // ==================================================
    // ПЕРЕВІРКА КРИТЕРІЇВ РЕАЛЬНОЇ МІСІЇ
    // ==================================================

    function validateCriteria(rawCriteria) {

        const criteria = {};

        if (

            !rawCriteria ||

            typeof rawCriteria !== "object"

        ) {
            return criteria;
        }

        Object.entries(ruleDefinitions)

            .forEach(([key, definition]) => {

                const rule = rawCriteria[key];

                if (!rule || typeof rule !== "object") {

                    return;
                }

                const environmentAbove =
                    isNumber(rule.environmentAbove);

                const environmentBelow =
                    isNumber(rule.environmentBelow);

                if (!environmentAbove && !environmentBelow) {

                    return;
                }

                if (

                    environmentAbove &&

                    environmentBelow &&

                    rule.environmentBelow >=
                    rule.environmentAbove

                ) {
                    return;
                }

                // Для фізіологічних показників
                // потрібні окремі критерії.

                if (definition.healthKey) {

                    if (

                        !isNumber(rule.healthAbove) &&

                        !isNumber(rule.healthBelow)

                    ) {
                        return;
                    }

                    if (

                        isNumber(rule.healthAbove) &&

                        isNumber(rule.healthBelow) &&

                        rule.healthBelow >= rule.healthAbove

                    ) {
                        return;
                    }
                }

                criteria[key] = {

                    environmentAbove:

                        environmentAbove

                            ? rule.environmentAbove

                            : null,

                    environmentBelow:

                        environmentBelow

                            ? rule.environmentBelow

                            : null,

                    healthKey: definition.healthKey,

                    symptom: definition.symptom,

                    healthAbove:

                        isNumber(rule.healthAbove)

                            ? rule.healthAbove

                            : null,

                    healthBelow:

                        isNumber(rule.healthBelow)

                            ? rule.healthBelow

                            : null
                };
            });

        return criteria;
    }

    // ==================================================
    // ОТРИМАННЯ ФАКТИЧНИХ ДАНИХ
    // ==================================================

    function createActualDataset(crew, now) {

        const stored = readStorage(

            HABITAT_STORAGE_KEY,

            null
        );

        const habitatId =

            stored?.source === "actual" &&

            typeof stored.habitatId === "string"

                ? stored.habitatId

                : null;

        const environment =

            habitatId &&

            Array.isArray(stored.environment)

                ? stored.environment

                : [];

        const observations = [];

        // Отримуємо історію здоров'я астронавтів.

        crew.forEach(person => {

            const history = person.healthObservations;

            if (!Array.isArray(history)) {

                return;
            }

            history.forEach(item => {

                if (!item || typeof item !== "object") {

                    return;
                }

                observations.push({

                    ...item,

                    astronautId: String(person.id)
                });
            });
        });

        // Не використовуємо демонстраційні пороги.

        const criteria = habitatId

            ? validateCriteria(stored.criteria)

            : {};

        return {

            source: "actual",

            habitatId,

            habitatName: habitatId

                ? stored.habitatName || habitatId

                : "No habitat connected",

            crew,

            environment,

            observations,

            criteria,

            now
        };
    }

    // ==================================================
    // ПІДГОТОВКА ВИМІРЮВАНЬ
    // ==================================================

    function prepareRecords(records, dataset, start) {

        if (!dataset.habitatId) {
            return [];
        }

        return records

            .filter(record =>

                record &&

                record.source === dataset.source &&

                record.habitatId === dataset.habitatId &&

                record.quality === "valid"
            )

            .map(record => ({

                ...record,

                timestamp:
                    parseTimestamp(record.timestamp)
            }))

            .filter(record =>

                isNumber(record.timestamp) &&

                record.timestamp > start &&

                record.timestamp <= dataset.now
            )

            .sort((a, b) =>

                a.timestamp - b.timestamp
            );
    }

    // ==================================================
    // СПІЛЬНА ЧАСОВА ШКАЛА
    // ==================================================

    function createTimeWindows(now, hours) {

        const start = now - hours * HOUR;

        return Array.from(

            { length: hours },

            (_, index) => ({

                start: start + index * HOUR,

                end: start + (index + 1) * HOUR
            })
        );
    }

    function inWindow(record, window) {

        return record.timestamp > window.start &&

            record.timestamp <= window.end;
    }

    // ==================================================
    // ПЕРЕВІРКА ПАРАМЕТРІВ СЕРЕДОВИЩА
    // ==================================================

    function isEnvironmentOutside(value, criteria) {

        if (!isNumber(value) || !criteria) {
            return false;
        }

        return (

            isNumber(criteria.environmentAbove) &&

            value > criteria.environmentAbove

        ) || (

            isNumber(criteria.environmentBelow) &&

            value < criteria.environmentBelow
        );
    }

    // ==================================================
    // ПЕРЕВІРКА ПОКАЗНИКІВ ЗДОРОВ'Я
    // ==================================================

    function evaluateHealth(record, rule) {

        if (!record || !rule) {

            return null;
        }

        // Перевірка структурованих симптомів

        if (rule.symptom) {

            if (

                !Array.isArray(record.symptoms) ||

                !record.symptoms.every(

                    symptom => typeof symptom === "string"
                )

            ) {
                return null;
            }

            return record.symptoms.some(symptom =>

                symptom.toLowerCase().trim() ===

                rule.symptom
            );
        }

        // Перевірка числових показників

        const value = record[rule.healthKey];

        if (!validMetric(rule.healthKey, value)) {

            return null;
        }

        return (

            isNumber(rule.healthAbove) &&

            value > rule.healthAbove

        ) || (

            isNumber(rule.healthBelow) &&

            value < rule.healthBelow
        );
    }

    // ==================================================
    // ОСНОВНИЙ АЛГОРИТМ СПІЛЬНОГО АНАЛІЗУ
    // ==================================================

    function analyzeCrew(dataset, hours) {

        const allowedHours = [6, 12, 24];

        hours = allowedHours.includes(hours)

            ? hours

            : 6;

        const start = dataset.now - hours * HOUR;

        const windows = createTimeWindows(
            dataset.now,
            hours
        );

        const environment = prepareRecords(

            dataset.environment,

            dataset,

            start
        );

        const observations = prepareRecords(

            dataset.observations,

            dataset,

            start
        );

        const rules = {};
        const patterns = [];

        const observedMembers = new Set();
        const sharedMembers = new Set();

        let validComparisons = 0;
        let expectedComparisons = 0;

        // ==============================================
        // АНАЛІЗ КОЖНОГО ЧИННИКА
        // ==============================================

        Object.entries(ruleDefinitions)

            .forEach(([metric, definition]) => {

                const criteria =
                    dataset.criteria[metric];

                const memberResults =
                    Object.create(null);

                const timeline = [];
                const sharedWindows = [];

                dataset.crew.forEach(person => {

                    memberResults[String(person.id)] = {

                        available: false,

                        related: false,

                        healthFlag: false
                    };
                });

                // ======================================
                // АНАЛІЗ ЧАСОВИХ ІНТЕРВАЛІВ
                // ======================================

                windows.forEach(window => {

                    const samples = environment.filter(

                        record =>

                            inWindow(record, window) &&

                            validMetric(metric, record[metric])
                    );

                    const value = average(

                        samples.map(record => record[metric])
                    );

                    const relatedIds = [];

                    let healthCount = 0;
                    let measuredCount = 0;

                    const outside = isEnvironmentOutside(

                        value,

                        criteria
                    );

                    // ==================================
                    // АНАЛІЗ КОЖНОГО АСТРОНАВТА
                    // ==================================

                    dataset.crew.forEach(person => {

                        const id = String(person.id);

                        const personRecords =
                            observations.filter(record =>

                                String(record.astronautId) === id &&

                                inWindow(record, window)
                            );

                        // Отримуємо останній запис,
                        // який містить потрібний показник.

                        const latest =
                            personRecords.findLast(record =>

                                Object.hasOwn(

                                    record,

                                    definition.symptom

                                        ? "symptoms"

                                        : definition.healthKey
                                )
                            );

                        if (!criteria) {

                            return;
                        }

                        expectedComparisons++;

                        const healthFlag = evaluateHealth(

                            latest,

                            criteria
                        );

                        // Відсутність інформації
                        // не є нормальним показником.

                        if (healthFlag === null) {

                            return;
                        }

                        measuredCount++;

                        if (healthFlag) {

                            healthCount++;

                            observedMembers.add(id);

                            memberResults[id].healthFlag =
                                true;
                        }

                        // Потрібні дані середовища.

                        if (!isNumber(value)) {

                            return;
                        }

                        validComparisons++;

                        memberResults[id].available = true;

                        // Збіг спостережень

                        if (outside && healthFlag) {

                            relatedIds.push(id);

                            memberResults[id].related = true;
                        }
                    });

                    // ==================================
                    // СПІЛЬНА ЗАКОНОМІРНІСТЬ
                    // ==================================

                    // Щонайменше два різні астронавти.

                    if (relatedIds.length >= 2) {

                        sharedWindows.push({

                            time: window.end,

                            value,

                            members: relatedIds
                        });

                        relatedIds.forEach(id =>

                            sharedMembers.add(id)
                        );
                    }

                    // ==================================
                    // ДАНІ ДЛЯ ГРАФІКІВ
                    // ==================================

                    timeline.push({

                        time: window.end,

                        environment: value,

                        healthCount:

                            (

                                dataset.recordedDemo ||

                                measuredCount ===
                                    dataset.crew.length

                            ) && measuredCount > 0

                                ? healthCount

                                : null,

                        measuredCount,

                        outside,

                        relatedIds
                    });
                });

                // ======================================
                // ФОРМУВАННЯ РЕЗУЛЬТАТУ
                // ======================================

                if (sharedWindows.length) {

                    const members = unique(

                        sharedWindows.flatMap(item =>

                            item.members
                        )
                    );

                    const latest = sharedWindows[

                        sharedWindows.length - 1
                    ];

                    patterns.push({

                        metric,

                        title: definition.title,

                        description: definition.description,

                        members,

                        value: latest.value,

                        timestamp: latest.time,

                        windows: sharedWindows.length
                    });
                }

                rules[metric] = {

                    definition,

                    criteria,

                    memberResults,

                    timeline,

                    sharedWindows
                };
            });

        // ==============================================
        // ДОСТУПНІСТЬ ДАНИХ
        // ==============================================

        const availability = expectedComparisons > 0

            ? Math.floor(

                validComparisons /
                expectedComparisons * 100
            )

            : null;

        const completeCriteria = dataset.recordedDemo

            ? Boolean(dataset.criteria.co2)

            : Object.keys(dataset.criteria).length ===

                Object.keys(ruleDefinitions).length;

        // ==============================================
        // ЗАГАЛЬНИЙ СТАТУС АНАЛІЗУ
        // ==============================================

        let status;
        let title;
        let description;

        if (patterns.length > 0) {

            status = "warning";

            title = "Possible Shared Environmental Risk";

            description =

                `${patterns.length} possible shared ` +

                `pattern(s) detected involving ` +

                `${sharedMembers.size} crew member(s). ` +

                "These are temporal associations, " +

                "not confirmed causes.";

            if (availability !== 100) {

                description +=

                    " Some observations are missing.";
            }

        } else if (

            dataset.crew.length < 2 ||

            !completeCriteria ||

            availability !== 100

        ) {

            status = "insufficient";

            title = "Insufficient Data";

            description =

                "No shared pattern was confirmed " +

                "by the available observations. " +

                "Missing measurements or criteria " +

                "prevent a complete assessment.";

        } else if (observedMembers.size === 1) {

            status = "individual";

            title = "Individual Health Observation";

            description =

                "One crew member has an observation " +

                "outside the configured health criteria. " +

                "No shared environmental pattern was detected.";

        } else {

            status = "stable";

            title = "No Shared Pattern Detected";

            description =

                "No matching shared environmental and " +

                "health pattern was detected during the " +

                "selected period. This does not establish " +

                "that all crew or habitat conditions are safe.";
        }

        return {

            source: dataset.source,

            recordedDemo: Boolean(dataset.recordedDemo),

            status,

            title,

            description,

            crew: dataset.crew,

            environment,

            observations,

            rules,

            patterns,

            availability,

            observedMembers: [...observedMembers],

            sharedMembers: [...sharedMembers],

            start,

            end: dataset.now,

            hours,

            analyzedAt: Date.now()
        };
    }

    // ==================================================
    // ВІДОБРАЖЕННЯ ДЖЕРЕЛА ДАНИХ
    // ==================================================

    function renderSource(dataset) {

        const sourcePanel = document.querySelector(

            ".crew-analysis-source"
        );

        const notice = byId("analysis-data-notice");

        const actual = dataset.source === "actual";

        sourcePanel.classList.toggle("actual", actual);

        byId("analysis-scenario-field").hidden = actual;

        scenarioSelect.disabled = actual;

        setText(

            "analysis-source-title",

            actual

                ? "Stored Crew Data"

                : "Demonstration Mode"
        );

        setText(

            "analysis-source-description",

            actual

                ? "Time-stamped crew and habitat records"

                : "Synthetic environmental and health data"
        );

        setText(

            "analysis-mode-badge",

            actual

                ? "STORED DATA"

                : "DEMO MODE"
        );

        notice.classList.remove("warning");

        // ==============================================
        // RECORDED DEMO CHECK-INS
        // ==============================================

        if (dataset.recordedDemo) {

            setText(

                "analysis-source-title",

                "Recorded Demo Check-ins"
            );

            setText(

                "analysis-source-description",

                "Saved fictional symptoms + synthetic habitat data"
            );

            notice.textContent =

                "Uses saved demo Daily Check-ins and " +

                "a synthetic elevated CO₂ scenario. " +

                "Only CO₂ and reported headache are evaluated. " +

                "No physiological values are invented. " +

                "Missing reports remain unknown. " +

                "No notifications are generated.";

        } else if (!actual) {

            notice.textContent =

                "Demonstration scenarios use synthetic data. " +

                "They do not change astronaut records " +

                "or generate operational alerts.";

        } else if (!dataset.habitatId) {

            notice.classList.add("warning");

            notice.textContent =

                "No habitat data source is connected. " +

                "Actual environmental analysis is unavailable.";

        } else if (

            Object.keys(dataset.criteria).length <

            Object.keys(ruleDefinitions).length

        ) {

            notice.classList.add("warning");

            notice.textContent =

                "Some mission-specific analysis criteria " +

                "are missing. Demonstration thresholds " +

                "will not be applied to stored data.";

        } else {

            notice.textContent =

                "Analysis uses stored observations and " +

                "configured mission criteria. Results require " +

                "human review. Local prototype notifications " +

                "may be generated; operational alerts are not connected.";
        }
    }

    // ==================================================
    // ЗАГАЛЬНА СТАТИСТИКА
    // ==================================================

    function renderSummary(analysis) {

        setText(

            "analysis-crew-count",

            analysis.crew.length
        );

        setText(

            "analysis-data-availability",

            analysis.availability === null

                ? "—"

                : `${analysis.availability}%`
        );

        setText(

            "analysis-related-count",

            analysis.availability === null

                ? "—"

                : analysis.observedMembers.length
        );

        setText(

            "analysis-risk-count",

            analysis.availability === null

                ? "—"

                : analysis.patterns.length
        );

        const relatedStat = byId(

            "analysis-related-count"

        ).closest(".crew-analysis-stat");

        relatedStat.querySelector("div > span")

            .textContent = "Health Observations";

        relatedStat.querySelector("small")

            .textContent = "Members with flagged observations";

        const availabilityStat = byId(

            "analysis-data-availability"

        ).closest(".crew-analysis-stat");

        availabilityStat.querySelector("small")

            .textContent = "Valid hourly comparisons";

        // Оновлення кольорів статистики

        [

            "analysis-related-count",

            "analysis-risk-count"

        ].forEach(id => {

            const element = byId(id);

            const card = element.closest(

                ".crew-analysis-stat"
            );

            card.classList.remove(

                "warning",

                "stable",

                "unavailable"
            );

            if (

                analysis.availability === null ||

                (

                    analysis.status === "insufficient" &&

                    Number(element.textContent) === 0

                )

            ) {

                card.classList.add("unavailable");

            } else if (Number(element.textContent) > 0) {

                card.classList.add("warning");

            } else {

                card.classList.add("stable");
            }
        });
    }

    // ==================================================
    // ОСТАННЄ СПОСТЕРЕЖЕННЯ СЕРЕДОВИЩА
    // ==================================================

    function getLatestEnvironment(analysis) {

        return analysis.environment[

            analysis.environment.length - 1

        ] || null;
    }

    // ==================================================
    // СТАН ПАРАМЕТРА СЕРЕДОВИЩА
    // ==================================================

    function getMetricState(metric, analysis) {

        const latest = getLatestEnvironment(analysis);

        const value = latest?.[metric];

        const criteria =
            analysis.rules[metric]?.criteria;

        if (

            !latest ||

            latest.timestamp <= analysis.end - HOUR

        ) {

            return {

                value: null,

                status: "unavailable",

                label: "No recent measurement"
            };
        }

        // Текстова оцінка якості повітря

        if (

            metric === "airQuality" &&

            typeof value === "string" &&

            value.trim()

        ) {

            return {

                value,

                status: "pending",

                label: "Reported sensor status"
            };
        }

        if (!validMetric(metric, value)) {

            return {

                value: null,

                status: "unavailable",

                label: "Awaiting data"
            };
        }

        if (!criteria) {

            return {

                value,

                status: "pending",

                label: "No configured criteria"
            };
        }

        const outside = isEnvironmentOutside(

            value,

            criteria
        );

        return {

            value,

            status: outside

                ? "warning"

                : "normal",

            label: outside

                ? "Outside configured range"

                : "Within configured range"
        };
    }

    // ==================================================
    // ВІДОБРАЖЕННЯ ПАРАМЕТРІВ МОДУЛЯ
    // ==================================================

    function renderHabitat(dataset, analysis) {

        setText(

            "analysis-habitat-name",

            dataset.habitatName
        );

        const latest = getLatestEnvironment(analysis);

        setText(

            "habitat-last-update",

            latest

                ? "Last observation: " +

                    formatDateTime(latest.timestamp)

                : "Awaiting measurements"
        );

        Object.entries(environmentalMetrics)

            .forEach(([key, metric]) => {

                const state = getMetricState(

                    key,

                    analysis
                );

                const card = document.querySelector(

                    `[data-habitat-metric="${key}"]`
                );

                const valueElement = byId(

                    metric.elementId
                );

                card.classList.remove(

                    "normal",

                    "stable",

                    "warning",

                    "elevated",

                    "critical",

                    "pending",

                    "unavailable",

                    "stale"
                );

                card.classList.add(state.status);

                valueElement.textContent =

                    typeof state.value === "string"

                        ? state.value

                        : formatNumber(

                            state.value,

                            metric.decimals
                        );

                card.querySelector(

                    ".habitat-metric-status"

                ).textContent = state.label;
            });
    }

    // ==================================================
    // ОСТАННЄ СПОСТЕРЕЖЕННЯ АСТРОНАВТА
    // ==================================================

    function getLatestObservation(id, analysis) {

        return analysis.observations

            .filter(record =>

                String(record.astronautId) === String(id)
            )

            .at(-1) || null;
    }

    // ==================================================
    // СТАТУС ВЗАЄМОЗВ'ЯЗКУ
    // ==================================================

    function getRelation(id, metric, analysis) {

        const result = analysis.rules[metric]

            ?.memberResults[String(id)];

        if (!result?.available) {

            return {

                className: "unavailable",

                label: "Insufficient data",

                description:

                    "No valid paired habitat and " +

                    "health observations are available."
            };
        }

        if (result.related) {

            return {

                className: "related",

                label: "Related observation",

                description:

                    "A health observation coincided with " +

                    "an environmental value outside the " +

                    "configured criteria during the selected period."
            };
        }

        return {

            className: "unrelated",

            label: "No related pattern",

            description:

                "No matching environmental and health " +

                "observation was detected in the available data."
        };
    }

    // ==================================================
    // ІНТЕРАКТИВНА СХЕМА ЕКІПАЖУ
    // ==================================================

    function renderCorrelationMap(analysis) {

        const container = byId("crew-correlation-map");

        if (!analysis.crew.length) {

            container.innerHTML = `

                <div class="crew-analysis-empty">

                    <span aria-hidden="true">◎</span>

                    <h4>No crew data available</h4>

                    <p>
                        Open Crew Dashboard first
                        to initialize the crew.
                    </p>

                </div>
            `;

            return;
        }

        const metric =
            environmentalMetrics[selectedMetric];

        const state =
            getMetricState(selectedMetric, analysis);

        const displayValue = formatNumber(

            state.value,

            metric.decimals
        );

        // Для екіпажів понад 8 осіб
        // використовуємо таблицю вибору.

        if (analysis.crew.length > 8) {

            container.innerHTML = `

                <div class="crew-analysis-empty">

                    <h4>${escapeHTML(metric.name)}</h4>

                    <p>
                        ${displayValue}
                        ${escapeHTML(metric.unit)}
                    </p>

                    <p>
                        Select a crew member from
                        the Crew Health Overview table.
                    </p>

                </div>
            `;

            return;
        }

        // ==============================================
        // РОЗМІРИ SVG
        // ==============================================

        const width = 680;
        const height = 470;

        const centerX = width / 2;
        const centerY = 210;

        const radiusX = 235;
        const radiusY = 145;

        const count = analysis.crew.length;

        // Координати астронавтів

        const nodes = analysis.crew.map((person, index) => {

            const angle =

                -Math.PI / 2 +

                Math.PI / count +

                index * Math.PI * 2 / count;

            const x = centerX +

                Math.cos(angle) * radiusX;

            const y = centerY +

                Math.sin(angle) * radiusY;

            return {

                person,

                x,

                y,

                relation: getRelation(

                    person.id,

                    selectedMetric,

                    analysis
                )
            };
        });

        const centerClass = state.status === "warning"

            ? "warning"

            : state.value === null

                ? "unavailable"

                : "";

        // ==============================================
        // ЛІНІЇ ВЗАЄМОЗВ'ЯЗКІВ
        // ==============================================

        const links = nodes.map(node => `

            <line

                class="correlation-link
                    ${node.relation.className}
                    ${String(node.person.id) ===
                        String(selectedCrewId)
                            ? "selected"
                            : ""}"

                x1="${centerX}"

                y1="${centerY}"

                x2="${node.x}"

                y2="${node.y}"

            />

        `).join("");

        // ==============================================
        // ВУЗЛИ АСТРОНАВТІВ
        // ==============================================

        const astronautsMarkup = nodes.map(node => {

            const person = node.person;

            const selected =

                String(person.id) === String(selectedCrewId);

            return `

                <g

                    class="correlation-node
                        ${node.relation.className}
                        ${selected ? "selected" : ""}"

                    data-crew-id="${escapeHTML(person.id)}"

                    transform="translate(${node.x} ${node.y})"

                    role="button"

                    tabindex="0"

                    aria-pressed="${selected}"

                    aria-label="${escapeHTML(

                        person.name + ": " +
                        node.relation.label
                    )}">

                    <title>

                        ${escapeHTML(person.name)}

                        —

                        ${escapeHTML(node.relation.label)}

                    </title>

                    <circle
                        class="correlation-node-hit-area"
                        r="42"
                    />

                    <circle
                        class="correlation-node-ring"
                        r="36"
                    />

                    <circle
                        class="correlation-node-circle"
                        r="29"
                    />

                    <text
                        class="correlation-node-initials"
                        y="1">

                        ${escapeHTML(getInitials(person.name))}

                    </text>

                    <text
                        class="correlation-node-name"
                        y="48">

                        ${escapeHTML(person.name)}

                    </text>

                    <text
                        class="correlation-node-status"
                        y="64">

                        ${escapeHTML(node.relation.label)}

                    </text>

                </g>
            `;

        }).join("");

        // ==============================================
        // ГОТОВА СХЕМА
        // ==============================================

        container.innerHTML = `

            <svg

                viewBox="0 0 ${width} ${height}"

                preserveAspectRatio="xMidYMid meet"

                aria-label="Crew environmental relationships">

                <ellipse

                    class="correlation-grid-circle"

                    cx="${centerX}"

                    cy="${centerY}"

                    rx="${radiusX}"

                    ry="${radiusY}"
                />

                <ellipse

                    class="correlation-grid-circle"

                    cx="${centerX}"

                    cy="${centerY}"

                    rx="165"

                    ry="100"
                />

                <line

                    class="correlation-grid-line"

                    x1="35"

                    y1="${centerY}"

                    x2="${width - 35}"

                    y2="${centerY}"
                />

                <line

                    class="correlation-grid-line"

                    x1="${centerX}"

                    y1="35"

                    x2="${centerX}"

                    y2="${height - 45}"
                />

                ${links}

                <!-- ЦЕНТРАЛЬНИЙ ЧИННИК -->

                <g

                    class="correlation-center ${centerClass}"

                    transform="translate(${centerX} ${centerY})">

                    <circle
                        class="correlation-center-ring"
                        r="79"
                    />

                    <circle
                        class="correlation-center-circle"
                        r="65"
                    />

                    <text
                        class="correlation-center-title"
                        y="-15">

                        ${escapeHTML(metric.shortName)}

                    </text>

                    <text
                        class="correlation-center-value"
                        y="12">

                        ${displayValue}

                    </text>

                    <text
                        class="correlation-center-unit"
                        y="30">

                        ${escapeHTML(metric.unit)}

                    </text>

                </g>

                ${astronautsMarkup}

            </svg>
        `;

        // Натискання на астронавтів

        container.querySelectorAll(".correlation-node")

            .forEach(node => {

                node.addEventListener("click", () => {

                    selectCrewMember(node.dataset.crewId);
                });

                node.addEventListener("keydown", event => {

                    if (

                        event.key === "Enter" ||

                        event.key === " "

                    ) {

                        event.preventDefault();

                        selectCrewMember(

                            node.dataset.crewId,

                            true
                        );
                    }
                });
            });
    }

    // ==================================================
    // ВИБІР АСТРОНАВТА
    // ==================================================

    function selectCrewMember(id, restoreFocus = false) {

        if (!currentAnalysis) {
            return;
        }

        const exists = currentAnalysis.crew.some(

            person => String(person.id) === String(id)
        );

        if (!exists) {
            return;
        }

        selectedCrewId = String(id);

        renderCorrelationMap(currentAnalysis);

        renderSelectedCrew(currentAnalysis);

        renderCrewTable(currentAnalysis);

        if (restoreFocus) {

            const node = [

                ...document.querySelectorAll(
                    ".correlation-node"
                )

            ].find(item =>

                item.dataset.crewId === selectedCrewId
            );

            node?.focus();
        }
    }

    // ==================================================
    // КАРТКА ПОКАЗНИКА
    // ==================================================

    function createSelectedMetric(name, value, unit) {

        return `

            <div class="selected-crew-metric">

                <span>${escapeHTML(name)}</span>

                <strong>${escapeHTML(value)}</strong>

                <small>${escapeHTML(unit)}</small>

            </div>
        `;
    }

    // ==================================================
    // ІНФОРМАЦІЯ ПРО ВИБРАНОГО АСТРОНАВТА
    // ==================================================

    function renderSelectedCrew(analysis) {

        const container = byId("selected-crew-details");

        const person = analysis.crew.find(item =>

            String(item.id) === String(selectedCrewId)
        );

        if (!person) {

            container.innerHTML = `

                <div class="crew-analysis-empty">

                    <span aria-hidden="true">◎</span>

                    <h4>Select a crew member</h4>

                </div>
            `;

            return;
        }

        const latest = getLatestObservation(

            person.id,

            analysis
        );

        const relation = getRelation(

            person.id,

            selectedMetric,

            analysis
        );

        // Симптоми астронавта

        const symptoms =

            Array.isArray(latest?.symptoms) &&

            latest.symptoms.every(

                item => typeof item === "string"
            )

                ? latest.symptoms

                : null;

        let symptomMarkup;

        if (symptoms === null) {

            symptomMarkup = `

                <span class="crew-symptom-tag unavailable">

                    No symptom data

                </span>
            `;

        } else if (symptoms.length === 0) {

            symptomMarkup = `

                <span class="crew-symptom-tag">

                    No reported symptoms

                </span>
            `;

        } else {

            symptomMarkup = symptoms.map(symptom => `

                <span class="crew-symptom-tag warning">

                    ${escapeHTML(symptom)}

                </span>

            `).join("");
        }

        // Перевірка числових показників

        const validPulse = validMetric(

            "pulse",

            latest?.pulse
        );

        const validOxygen = validMetric(

            "oxygen",

            latest?.oxygen
        );

        const validTemperature = validMetric(

            "temperature",

            latest?.temperature
        );

        container.innerHTML = `

            <div class="selected-crew-header">

                <div class="selected-crew-avatar">

                    ${escapeHTML(getInitials(person.name))}

                </div>

                <div class="selected-crew-name">

                    <h4>${escapeHTML(person.name)}</h4>

                    <p>

                        ${escapeHTML(person.role)}

                        ·

                        AST-${escapeHTML(

                            String(person.id).padStart(3, "0")
                        )}

                    </p>

                </div>

            </div>

            <!-- ПОКАЗНИКИ -->

            <div class="selected-crew-metrics">

                ${createSelectedMetric(

                    "Heart Rate",

                    validPulse

                        ? formatNumber(latest.pulse)

                        : "—",

                    "bpm"
                )}

                ${createSelectedMetric(

                    "SpO₂",

                    validOxygen

                        ? formatNumber(latest.oxygen, 1)

                        : "—",

                    "%"
                )}

                ${createSelectedMetric(

                    "Skin Temperature",

                    validTemperature

                        ? formatNumber(latest.temperature, 1)

                        : "—",

                    "°C"
                )}

                ${createSelectedMetric(

                    "Battery",

                    isNumber(person.battery)

                        ? formatNumber(person.battery)

                        : "—",

                    "% · Dashboard record"
                )}

            </div>

            <!-- СИМПТОМИ -->

            <div class="selected-crew-observations">

                <h4>Latest Reported Symptoms</h4>

                <div class="selected-crew-symptoms">

                    ${symptomMarkup}

                </div>

                <p>

                    Observation:

                    ${escapeHTML(

                        formatDateTime(latest?.timestamp)
                    )}

                </p>

                <p>

                    ${analysis.recordedDemo

                        ? "Saved fictional check-in; no physiological measurements."

                        : analysis.source === "demo"

                            ? "Synthetic scenario observation."

                            : "Stored observation."}

                </p>

            </div>

            <!-- ЗВ'ЯЗОК ІЗ СЕРЕДОВИЩЕМ -->

            <div class="selected-crew-relation
                        ${relation.className}">

                <strong>

                    ${escapeHTML(relation.label)}

                </strong>

                <p>

                    ${escapeHTML(relation.description)}

                </p>

            </div>

            <!-- ПЕРЕХІД ДО ПРОФІЛЮ -->

            <a

                href="astronaut.html?id=${encodeURIComponent(

                    person.id
                )}"

                class="selected-crew-profile-button">

                View Full Profile →

            </a>
        `;
    }

    // ==================================================
    // ТАБЛИЦЯ СТАНУ ЕКІПАЖУ
    // ==================================================

    function renderCrewTable(analysis) {

        const tbody = byId("crew-analysis-table-body");

        if (!analysis.crew.length) {

            tbody.innerHTML = `

                <tr>

                    <td colspan="6">

                        No crew data available

                    </td>

                </tr>
            `;

            return;
        }

        tbody.innerHTML = analysis.crew.map(person => {

            const latest = getLatestObservation(

                person.id,

                analysis
            );

            const relation = getRelation(

                person.id,

                selectedMetric,

                analysis
            );

            const selected =

                String(person.id) === String(selectedCrewId);

            let symptoms = "No data";

            if (Array.isArray(latest?.symptoms)) {

                symptoms = latest.symptoms.length

                    ? latest.symptoms.join(", ")

                    : "None reported";
            }

            return `

                <tr

                    data-crew-id="${escapeHTML(person.id)}"

                    class="${selected ? "selected" : ""}">

                    <!-- АСТРОНАВТ -->

                    <td>

                        <button

                            type="button"

                            class="crew-table-person-button"

                            data-select-crew="${escapeHTML(person.id)}"

                            aria-pressed="${selected}">

                            <span class="crew-table-avatar">

                                ${escapeHTML(

                                    getInitials(person.name)
                                )}

                            </span>

                            <span class="crew-table-person">

                                <span>

                                    <strong>

                                        ${escapeHTML(person.name)}

                                    </strong>

                                    <small>

                                        ${escapeHTML(person.role)}

                                    </small>

                                </span>

                            </span>

                        </button>

                    </td>

                    <!-- ПУЛЬС -->

                    <td class="crew-table-value">

                        ${validMetric("pulse", latest?.pulse)

                            ? `${formatNumber(latest.pulse)} bpm`

                            : "—"}

                    </td>

                    <!-- САТУРАЦІЯ -->

                    <td class="crew-table-value">

                        ${validMetric("oxygen", latest?.oxygen)

                            ? `${formatNumber(latest.oxygen, 1)}%`

                            : "—"}

                    </td>

                    <!-- ТЕМПЕРАТУРА -->

                    <td class="crew-table-value">

                        ${validMetric(

                            "temperature",

                            latest?.temperature

                        )

                            ? `${formatNumber(latest.temperature, 1)} °C`

                            : "—"}

                    </td>

                    <!-- СИМПТОМИ -->

                    <td>

                        ${escapeHTML(symptoms)}

                    </td>

                    <!-- СТАТУС -->

                    <td>

                        <span class="crew-relation-badge
                                    ${relation.className}">

                            ${escapeHTML(relation.label)}

                        </span>

                    </td>

                </tr>
            `;

        }).join("");

        // Вибір астронавта через таблицю

        tbody.querySelectorAll("[data-select-crew]")

            .forEach(button => {

                button.addEventListener("click", () => {

                    const id = button.dataset.selectCrew;

                    selectCrewMember(id);

                    const newButton = [

                        ...tbody.querySelectorAll(
                            "[data-select-crew]"
                        )

                    ].find(item =>

                        item.dataset.selectCrew === id
                    );

                    newButton?.focus();
                });
            });
    }

    // ==================================================
    // ЗАГАЛЬНИЙ РЕЗУЛЬТАТ
    // ==================================================

    function renderAnalysisResult(analysis) {

        const container = byId("crew-analysis-result");

        container.className =

            `crew-analysis-result ${analysis.status}`;

        container.innerHTML = `

            <h4>${escapeHTML(analysis.title)}</h4>

            <p>${escapeHTML(analysis.description)}</p>
        `;
    }

    // ==================================================
    // ВИЯВЛЕНІ ЗАКОНОМІРНОСТІ
    // ==================================================

    function renderPatterns(analysis) {

        const container = byId("crew-risk-list");

        if (!analysis.patterns.length) {

            container.innerHTML = "";

            return;
        }

        container.innerHTML = analysis.patterns.map(pattern => {

            const metric =
                environmentalMetrics[pattern.metric];

            const members = pattern.members.map(id =>

                analysis.crew.find(person =>

                    String(person.id) === id
                )

            ).filter(Boolean);

            return `

                <article class="crew-risk-card">

                    <!-- ЗАГОЛОВОК -->

                    <div class="crew-risk-card-header">

                        <div class="crew-risk-card-icon"
                             aria-hidden="true">

                            ⚠

                        </div>

                        <div>

                            <h4>

                                ${escapeHTML(pattern.title)}

                            </h4>

                            <p>Possible temporal association</p>

                        </div>

                    </div>

                    <!-- ОПИС -->

                    <p class="crew-risk-description">

                        ${escapeHTML(pattern.description)}

                    </p>

                    <!-- СПОСТЕРЕЖЕННЯ -->

                    <div class="crew-risk-evidence">

                        <div class="crew-risk-evidence-item">

                            <span>

                                Latest matching hourly average

                            </span>

                            <strong>

                                ${formatNumber(

                                    pattern.value,

                                    metric.decimals
                                )}

                                ${escapeHTML(metric.unit)}

                            </strong>

                        </div>

                        <div class="crew-risk-evidence-item">

                            <span>Crew members involved</span>

                            <strong>${members.length}</strong>

                        </div>

                        <div class="crew-risk-evidence-item">

                            <span>Matching hourly windows</span>

                            <strong>${pattern.windows}</strong>

                        </div>

                        <div class="crew-risk-evidence-item">

                            <span>Latest matching interval</span>

                            <strong>

                                ${escapeHTML(

                                    formatTime(pattern.timestamp)
                                )}

                            </strong>

                        </div>

                    </div>

                    <!-- ЧЛЕНИ ЕКІПАЖУ -->

                    <div class="crew-risk-members">

                        ${members.map(person => `

                            <span class="crew-risk-member">

                                ● ${escapeHTML(person.name)}

                            </span>

                        `).join("")}

                    </div>

                    <div class="crew-risk-card-footer">

                        This pattern is based on matching
                        observations within the same hourly
                        window and habitat.

                        Further verification is required.

                    </div>

                </article>
            `;

        }).join("");
    }

    // ==================================================
    // АДАПТИВНІ SVG-ГРАФІКИ
    // ==================================================

    function renderChart(container, timeline, options) {

        if (!container) {
            return;
        }

        const validValues = timeline

            .map(item => item[options.key])

            .filter(isNumber);

        if (!validValues.length) {

            container.innerHTML = `

                <p class="crew-analysis-empty">

                    No synchronized data available

                </p>
            `;

            return;
        }

        // ==============================================
        // ФАКТИЧНІ РОЗМІРИ КОНТЕЙНЕРА
        // ==============================================

        const width = Math.max(

            320,

            container.clientWidth
        );

        const height = window.innerWidth <= 700

            ? 220

            : 240;

        const left = 55;
        const right = 24;
        const top = 20;
        const bottom = 37;

        const plotWidth = width - left - right;

        const plotHeight = height - top - bottom;

        // ==============================================
        // МЕЖІ ВЕРТИКАЛЬНОЇ ШКАЛИ
        // ==============================================

        let min;
        let max;

        if (options.type === "bar") {

            min = 0;

            max = Math.max(1, options.max || 1);

        } else {

            const dataMin = Math.min(...validValues);

            const dataMax = Math.max(...validValues);

            const padding = Math.max(

                (dataMax - dataMin) * 0.12,

                Math.abs(dataMax) * 0.015,

                0.1
            );

            min = Math.max(

                0,

                dataMin - padding
            );

            max = dataMax + padding;

            // Враховуємо лінію критерію

            const threshold = options.threshold;

            if (isNumber(threshold)) {

                min = Math.min(

                    min,

                    Math.max(0, threshold - padding)
                );

                max = Math.max(

                    max,

                    threshold + padding
                );
            }
        }

        const range = max - min || 1;

        // ==============================================
        // КООРДИНАТИ ГРАФІКА
        // ==============================================

        const xAt = index =>

            left +

            (index + 0.5) /

            timeline.length *

            plotWidth;

        const yAt = value =>

            top + plotHeight -

            (value - min) / range *

            plotHeight;

        // ==============================================
        // СІТКА
        // ==============================================

        let grid = "";

        const divisions = options.type === "bar"

            ? Math.min(4, max)

            : 4;

        for (let index = 0; index <= divisions; index++) {

            let value = max -

                range / divisions * index;

            if (options.type === "bar") {

                value = Math.round(value);
            }

            const y = yAt(value);

            grid += `

                <line

                    class="crew-chart-grid"

                    x1="${left}"

                    y1="${y}"

                    x2="${width - right}"

                    y2="${y}"
                />

                <text

                    x="${left - 9}"

                    y="${y}"

                    text-anchor="end"

                    dominant-baseline="middle">

                    ${formatNumber(

                        value,

                        options.decimals || 0
                    )}

                </text>
            `;
        }

        // ==============================================
        // ЧАСОВІ ПІДПИСИ
        // ==============================================

        let timeLabels = "";

        const maxLabels = Math.max(

            2,

            Math.floor(plotWidth / 72)
        );

        const labelStep = Math.max(

            1,

            Math.ceil(timeline.length / maxLabels)
        );

        timeline.forEach((item, index) => {

            if (index % labelStep !== 0) {

                return;
            }

            timeLabels += `

                <text

                    class="crew-chart-axis-label"

                    x="${xAt(index)}"

                    y="${height - 12}"

                    text-anchor="middle">

                    ${escapeHTML(formatTime(item.time))}

                </text>
            `;
        });

        // ==============================================
        // СТОВПЧИКОВИЙ АБО ЛІНІЙНИЙ ГРАФІК
        // ==============================================

        let graph = "";

        if (options.type === "bar") {

            const barWidth = Math.min(

                30,

                plotWidth / timeline.length * 0.55
            );

            graph = timeline.map((item, index) => {

                const value = item[options.key];

                // Відсутні значення залишаємо пропусками.

                if (!isNumber(value)) {

                    return "";
                }

                const x = xAt(index);

                const y = yAt(value);

                const barHeight = top + plotHeight - y;

                // Нульове значення

                if (value === 0) {

                    return `

                        <circle

                            class="crew-health-point"

                            cx="${x}"

                            cy="${y}"

                            r="3">

                            <title>

                                ${formatTime(item.time)}:

                                0 crew members

                            </title>

                        </circle>
                    `;
                }

                // Стовпчик

                return `

                    <rect

                        class="crew-health-bar"

                        x="${x - barWidth / 2}"

                        y="${y}"

                        width="${barWidth}"

                        height="${barHeight}"

                        rx="3">

                        <title>

                            ${formatTime(item.time)}:

                            ${value} crew member(s)

                        </title>

                    </rect>
                `;

            }).join("");

        } else {

            // ==========================================
            // ЛІНІЙНИЙ ГРАФІК
            // ==========================================

            let path = "";

            let connected = false;

            timeline.forEach((item, index) => {

                const value = item[options.key];

                if (!isNumber(value)) {

                    connected = false;

                    return;
                }

                const x = xAt(index);

                const y = yAt(value);

                path +=

                    `${connected ? "L" : "M"} ${x} ${y} `;

                connected = true;
            });

            // Точки вимірювань

            const points = timeline.map((item, index) => {

                const value = item[options.key];

                if (!isNumber(value)) {

                    return "";
                }

                return `

                    <circle

                        class="crew-environment-point"

                        cx="${xAt(index)}"

                        cy="${yAt(value)}"

                        r="4">

                        <title>

                            ${formatTime(item.time)}:

                            ${formatNumber(

                                value,

                                options.decimals
                            )}

                            ${escapeHTML(options.unit)}

                        </title>

                    </circle>
                `;

            }).join("");

            graph = `

                <path

                    class="crew-environment-line"

                    d="${path}"
                />

                ${points}
            `;
        }

        // ==============================================
        // ЛІНІЯ НАЛАШТОВАНОГО КРИТЕРІЮ
        // ==============================================

        let thresholdMarkup = "";

        if (

            isNumber(options.threshold) &&

            options.threshold >= min &&

            options.threshold <= max

        ) {

            const y = yAt(options.threshold);

            thresholdMarkup = `

                <line

                    class="crew-chart-threshold"

                    x1="${left}"

                    y1="${y}"

                    x2="${width - right}"

                    y2="${y}"
                />
            `;
        }

        // ==============================================
        // ГОТОВИЙ SVG
        // ==============================================

        container.innerHTML = `

            <svg

                viewBox="0 0 ${width} ${height}"

                style="height: ${height}px;"

                preserveAspectRatio="xMidYMid meet"

                role="img"

                aria-label="${escapeHTML(options.title)}">

                ${grid}

                <line

                    class="crew-chart-axis"

                    x1="${left}"

                    y1="${top}"

                    x2="${left}"

                    y2="${top + plotHeight}"
                />

                <line

                    class="crew-chart-axis"

                    x1="${left}"

                    y1="${top + plotHeight}"

                    x2="${width - right}"

                    y2="${top + plotHeight}"
                />

                ${thresholdMarkup}

                ${graph}

                ${timeLabels}

            </svg>
        `;
    }

    // ==================================================
    // СИНХРОНІЗОВАНІ ГРАФІКИ
    // ==================================================

    function renderCharts(analysis) {

        const metric =
            environmentalMetrics[selectedMetric];

        const rule = analysis.rules[selectedMetric];

        if (!rule) {
            return;
        }

        setText(

            "environment-chart-title",

            `${metric.name} — Hourly Average`
        );

        setText(

            "environment-chart-unit",

            metric.unit
        );

        setText(

            "health-chart-title",

            `${analysis.recordedDemo

                ? "Reporting Crew Members"

                : "Crew Members"

            } — ${rule.definition.healthLabel}`
        );

        const threshold =

            rule.criteria?.environmentAbove ??

            rule.criteria?.environmentBelow ??

            null;

        // Графік середовища

        renderChart(

            byId("environment-trend-chart"),

            rule.timeline,

            {

                key: "environment",

                title: metric.name,

                unit: metric.unit,

                decimals: metric.decimals,

                threshold,

                type: "line"
            }
        );

        // Графік показників екіпажу

        renderChart(

            byId("crew-health-trend-chart"),

            rule.timeline,

            {

                key: "healthCount",

                title: rule.definition.healthLabel,

                unit: "Crew members",

                decimals: 0,

                max: analysis.crew.length,

                type: "bar"
            }
        );

        const note = document.querySelector(

            ".crew-analysis-chart-note"
        );

        note.textContent =

            (

                analysis.recordedDemo

                    ? "Saved check-ins are compared with synthetic CO₂. " +

                        "Counts include only assessed crew members; " +

                        "missing reports are not counted as absence of symptoms. "

                    : ""

            ) +

            "Both charts use the same hourly intervals. " +

            "Missing observations are displayed as gaps, " +

            "not zeros. The dashed yellow line, when shown, " +

            "represents a configured analysis criterion. " +

            "Temporal association does not establish causation.";
    }

    // ==================================================
    // АДАПТИВНЕ МАСШТАБУВАННЯ ГРАФІКІВ
    // ==================================================

    function scheduleChartResize() {

        if (!currentAnalysis) {
            return;
        }

        if (resizeFrame !== null) {

            cancelAnimationFrame(resizeFrame);
        }

        resizeFrame = requestAnimationFrame(() => {

            resizeFrame = null;

            renderCharts(currentAnalysis);
        });
    }

    function setupChartResize() {

        if (typeof ResizeObserver === "function") {

            const widths = new WeakMap();

            chartObserver = new ResizeObserver(entries => {

                let changed = false;

                entries.forEach(entry => {

                    const width = Math.round(

                        entry.contentRect.width
                    );

                    if (widths.get(entry.target) !== width) {

                        widths.set(entry.target, width);

                        changed = true;
                    }
                });

                if (changed) {

                    scheduleChartResize();
                }
            });

            chartObserver.observe(

                byId("environment-trend-chart")
            );

            chartObserver.observe(

                byId("crew-health-trend-chart")
            );
        }

        window.addEventListener(

            "resize",

            scheduleChartResize
        );
    }

    // ==================================================
    // РЕКОМЕНДАЦІЇ ЩОДО ПОДАЛЬШОЇ ПЕРЕВІРКИ
    // ==================================================

    function getRecommendations(analysis) {

        const recommendations = [];

        if (analysis.patterns.length) {

            recommendations.push({

                title: "Verify Environmental Observations",

                text:

                    "Review the relevant habitat sensor " +

                    "measurements, timestamps and data quality."
            });

            recommendations.push({

                title: "Review Crew Health Observations",

                text:

                    "Review the affected crew members' " +

                    "observations with responsible medical personnel."
            });

            recommendations.push({

                title: "Follow Mission Protocols",

                text:

                    "Use the detected pattern as supporting " +

                    "information for the approved onboard " +

                    "environmental and medical procedures."
            });

        } else if (analysis.status === "individual") {

            recommendations.push({

                title: "Review Individual Observation",

                text:

                    "Review the individual astronaut's " +

                    "health measurements and reported symptoms."
            });

            recommendations.push({

                title: "Continue Shared Monitoring",

                text:

                    "Check whether further synchronized " +

                    "observations reveal a common pattern."
            });

        } else if (analysis.status === "insufficient") {

            recommendations.push({

                title: "Improve Data Availability",

                text:

                    "Check sensor connections, observation " +

                    "timestamps and habitat identifiers."
            });

            recommendations.push({

                title: "Review Analysis Criteria",

                text:

                    "Ensure the required mission-specific " +

                    "criteria are provided before interpretation."
            });

        } else {

            recommendations.push({

                title: "Continue Scheduled Monitoring",

                text:

                    "Continue recording crew health and " +

                    "habitat observations according to " +

                    "the mission monitoring plan."
            });
        }

        recommendations.push({

            title: "Human Review Required",

            text:

                "PULSAR does not establish diagnoses " +

                "or causal relationships."
        });

        return recommendations;
    }

    // ==================================================
    // ВІДОБРАЖЕННЯ РЕКОМЕНДАЦІЙ
    // ==================================================

    function renderRecommendations(analysis) {

        const container = byId(

            "crew-analysis-recommendations"
        );

        const recommendations =
            getRecommendations(analysis);

        container.innerHTML = recommendations.map(item => `

            <div class="crew-analysis-recommendation">

                <span class="crew-recommendation-icon"
                      aria-hidden="true">

                    →

                </span>

                <div>

                    <strong>

                        ${escapeHTML(item.title)}

                    </strong>

                    <p>

                        ${escapeHTML(item.text)}

                    </p>

                </div>

            </div>

        `).join("");
    }

    // ==================================================
    // ВІДОБРАЖЕННЯ ВСІХ РЕЗУЛЬТАТІВ
    // ==================================================

    function renderAll(dataset, analysis) {

        renderSource(dataset);

        renderSummary(analysis);

        renderHabitat(dataset, analysis);

        renderCorrelationMap(analysis);

        renderSelectedCrew(analysis);

        renderCrewTable(analysis);

        renderAnalysisResult(analysis);

        renderPatterns(analysis);

        renderCharts(analysis);

        renderRecommendations(analysis);

        setText(

            "crew-analysis-last-update",

            "Last analysis: " +

            formatDateTime(analysis.analyzedAt)
        );
    }

    // ==================================================
    // ЗАПУСК АНАЛІЗУ
    // ==================================================

    function runAnalysis() {

        const crew = getCrew();

        const now = Date.now();

        const hours = Number(periodSelect.value);

        const source = sourceSelect.value;

        const scenario = scenarioSelect.value;

        // ==============================================
        // ВИБІР ДЖЕРЕЛА ДАНИХ
        // ==============================================

        currentDataset =

            source === "actual"

                ? createActualDataset(crew, now)

                : scenario === "recorded"

                    ? createRecordedDemoDataset(crew, now)

                    : createDemoDataset(

                        crew,

                        scenario,

                        now
                    );

        // ==============================================
        // ВИКОНАННЯ АНАЛІЗУ
        // ==============================================

        currentAnalysis = analyzeCrew(

            currentDataset,

            hours
        );

        // ==============================================
        // ВИБІР АСТРОНАВТА
        // ==============================================

        const selectedExists = crew.some(person =>

            String(person.id) === String(selectedCrewId)
        );

        if (!selectedExists) {

            selectedCrewId = crew.length

                ? String(crew[0].id)

                : null;
        }

        // ==============================================
        // ВИБІР ЧИННИКА СЕРЕДОВИЩА
        // ==============================================

        selectedMetric = Object.hasOwn(

            ruleDefinitions,

            metricSelect.value

        )

            ? metricSelect.value

            : "co2";

        if (source === "demo") {

            if (

                scenario === "co2" ||

                scenario === "recorded"

            ) {

                selectedMetric = "co2";

            } else if (scenario === "oxygen") {

                selectedMetric = "airOxygen";

            } else if (scenario === "thermal") {

                selectedMetric = "airTemperature";
            }

            metricSelect.value = selectedMetric;
        }

        // ==============================================
        // ОНОВЛЕННЯ ІНТЕРФЕЙСУ
        // ==============================================

        renderAll(

            currentDataset,

            currentAnalysis
        );

        // ==============================================
        // NOTIFICATION CENTER
        // ==============================================

        // Демонстраційні сценарії не створюють
        // загальних повідомлень.

        if (currentDataset.source === "actual") {

            try {

                window.PulsarNotifications

                    ?.syncEnvironmentalAnalysis?.(

                        currentDataset,

                        currentAnalysis
                    );

            } catch (error) {

                console.error(

                    "Cannot synchronize environmental notifications:",

                    error
                );
            }
        }

        return currentAnalysis;
    }

    // ==================================================
    // АНАЛІЗ ЗБЕРЕЖЕНИХ ДАНИХ
    // БЕЗ ПЕРЕМАЛЬОВУВАННЯ ІНТЕРФЕЙСУ
    // ==================================================

    function syncStoredAnalysis() {

        const dataset = createActualDataset(

            getCrew(),

            Date.now()
        );

        if (!dataset.habitatId) {

            return null;
        }

        // Аналізуємо останні шість годин.

        const analysis = analyzeCrew(dataset, 6);

        // Передаємо результат до центру сповіщень.

        window.PulsarNotifications

            ?.syncEnvironmentalAnalysis?.(

                dataset,

                analysis
            );

        return analysis;
    }

    // ==================================================
    // CREW DASHBOARD
    // ЛОКАЛЬНИЙ АНАЛІЗ НА ГОЛОВНІЙ СТОРІНЦІ
    // ==================================================

    // Якщо це не сторінка Crew Environmental Analysis,
    // запускаємо тільки логіку роботи з даними.

    if (!page) {

        // Перевіряємо, чи відкрито Crew Dashboard.

        if (!byId("crew-grid")) {

            return;
        }

        const refresh = () => {

            try {

                syncStoredAnalysis();

            } catch (error) {

                console.error(

                    "Stored crew analysis failed:",

                    error
                );
            }
        };

        // Оновлення даних екіпажу

        document.addEventListener(

            "pulsar:crew-change",

            refresh
        );

        // Оновлення параметрів середовища

        document.addEventListener(

            "pulsar:habitat-change",

            refresh
        );

        // Повернення на сторінку

        window.addEventListener(

            "pageshow",

            refresh
        );

        // Повернення до вкладки

        document.addEventListener(

            "visibilitychange",

            () => {

                if (document.visibilityState === "visible") {

                    refresh();
                }
            }
        );

        // Локальна перевірка раз на хвилину.
        // Тільки поки сторінка відкрита та видима.

        window.setInterval(() => {

            if (document.visibilityState === "visible") {

                refresh();
            }

        }, 60000);

        // Публічний інтерфейс на Dashboard

        window.PulsarCrewAnalysis = Object.freeze({

            analyzeCrew,

            createDemoDataset,

            createRecordedDemoDataset,

            createActualDataset,

            syncStoredAnalysis
        });

        refresh();

        return;
    }

    // ==================================================
    // ЗМІНА ЧИННИКА СЕРЕДОВИЩА
    // ==================================================

    metricSelect.addEventListener("change", function () {

        if (

            !currentAnalysis ||

            !Object.hasOwn(

                ruleDefinitions,

                metricSelect.value
            )

        ) {
            return;
        }

        selectedMetric = metricSelect.value;

        renderCorrelationMap(currentAnalysis);

        renderSelectedCrew(currentAnalysis);

        renderCrewTable(currentAnalysis);

        renderCharts(currentAnalysis);
    });

    // ==================================================
    // КНОПКА RUN ANALYSIS
    // ==================================================

    runButton.addEventListener(

        "click",

        runAnalysis
    );

    // ==================================================
    // АВТОМАТИЧНИЙ АНАЛІЗ
    // ПРИ ЗМІНІ НАЛАШТУВАНЬ
    // ==================================================

    sourceSelect.addEventListener(

        "change",

        runAnalysis
    );

    scenarioSelect.addEventListener(

        "change",

        runAnalysis
    );

    periodSelect.addEventListener(

        "change",

        runAnalysis
    );

    // ==================================================
    // ОНОВЛЕННЯ ПІСЛЯ ПОВЕРНЕННЯ
    // ==================================================

    window.addEventListener("pageshow", event => {

        if (event.persisted) {

            runAnalysis();
        }
    });

    // ==================================================
    // ОНОВЛЕННЯ ДАНИХ ЕКІПАЖУ
    // ==================================================

    document.addEventListener(

        "pulsar:crew-change",

        () => {

            if (

                sourceSelect.value === "actual" ||

                scenarioSelect.value === "recorded"

            ) {

                runAnalysis();
            }
        }
    );

    // ==================================================
    // ОНОВЛЕННЯ ДАНИХ СЕРЕДОВИЩА
    // ==================================================

    document.addEventListener(

        "pulsar:habitat-change",

        () => {

            if (sourceSelect.value === "actual") {

                runAnalysis();
            }
        }
    );

    // ==================================================
    // ПОВЕРНЕННЯ ДО ВКЛАДКИ
    // ==================================================

    document.addEventListener(

        "visibilitychange",

        () => {

            if (

                document.visibilityState === "visible" &&

                (

                    sourceSelect.value === "actual" ||

                    scenarioSelect.value === "recorded"

                )

            ) {

                runAnalysis();
            }
        }
    );

    // ==================================================
    // ПУБЛІЧНИЙ ІНТЕРФЕЙС МОДУЛЯ
    // ==================================================

    window.PulsarCrewAnalysis = Object.freeze({

        runAnalysis,

        analyzeCrew,

        createDemoDataset,

        createRecordedDemoDataset,

        createActualDataset,

        syncStoredAnalysis
    });

    // ==================================================
    // ДОДАВАННЯ НОВОГО СЦЕНАРІЮ
    // ==================================================

    // Не потрібно повторно змінювати HTML-форму.
    // Новий варіант додається автоматично.

    if (

        !Array.from(scenarioSelect.options).some(

            option => option.value === "recorded"
        )

    ) {

        const option = document.createElement("option");

        option.value = "recorded";

        option.textContent = "Recorded Demo Check-ins";

        scenarioSelect.appendChild(option);
    }

    // ==================================================
    // ПЕРЕХІД ІЗ NOTIFICATION CENTER
    // ==================================================

    const requestedSource = new URLSearchParams(

        window.location.search

    ).get("source");

    // При переході зі сповіщення
    // відкриваємо режим збережених даних.

    if (requestedSource === "actual") {

        sourceSelect.value = "actual";
    }

    // ==================================================
    // ПОЧАТКОВИЙ ЗАПУСК
    // ==================================================

    setupChartResize();

    runAnalysis();

    // ==================================================
    // КІНЕЦЬ CREW ENVIRONMENTAL ANALYSIS
    // ==================================================

})();
