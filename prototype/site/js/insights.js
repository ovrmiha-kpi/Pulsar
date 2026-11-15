
// ==================================================
// PULSAR — AI HEALTH INSIGHTS
// РАННЄ ВИЯВЛЕННЯ НЕСПРИЯТЛИВИХ ТЕНДЕНЦІЙ
// ==================================================

(function () {

    "use strict";

    // ==============================================
    // 1. НАЛАШТУВАННЯ АЛГОРИТМУ
    // ==============================================

    const DAY_MS = 24 * 60 * 60 * 1000;

    const ANALYSIS_DAYS = 7;

    const MIN_VALID_DAYS = 5;

    const MIN_DIRECTION_RATIO = 0.6;


    // Демонстраційні критерії виявлення тенденцій.
    // Це НЕ клінічно затверджені медичні межі.

    const metrics = [

        {
            key: "restingHeartRate",
            name: "Resting Heart Rate",
            unit: "bpm",
            icon: "♡",
            direction: "increase",
            threshold: 10,
            changeType: "percent"
        },

        {
            key: "gripStrength",
            name: "Grip Strength",
            unit: "N",
            icon: "✊",
            direction: "decrease",
            threshold: 8,
            changeType: "percent"
        },

        {
            key: "sleepDuration",
            name: "Sleep Duration",
            unit: "h",
            icon: "☾",
            direction: "decrease",
            threshold: 15,
            changeType: "percent"
        },

        {
            key: "oxygen",
            name: "Blood Oxygen",
            unit: "%",
            icon: "O₂",
            direction: "decrease",
            threshold: 2,
            changeType: "percentagePoints"
        },

        {
            key: "stressLevel",
            name: "Stress Level",
            unit: "/10",
            icon: "◇",
            direction: "increase",
            threshold: 2,
            changeType: "absolute"
        }

    ];


    // ==============================================
    // 2. ДОПОМІЖНІ ФУНКЦІЇ
    // ==============================================

    // Захист текстових даних

    function escape(value) {

        return String(value ?? "—")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");

    }


    // Форматування числового значення

    function formatNumber(value) {

        if (!Number.isFinite(value)) {

            return "—";

        }

        return Number(value.toFixed(2)).toString();

    }


    // Обчислення середнього значення

    function average(values) {

        if (!values.length) {

            return null;

        }

        return values.reduce(
            (sum, value) => sum + value,
            0
        ) / values.length;

    }


    // Початок календарного дня за UTC

    function dayStart(timestamp) {

        return Math.floor(timestamp / DAY_MS)
            * DAY_MS;

    }


    // Форматування дати

    function formatDay(timestamp) {

        return new Date(timestamp).toLocaleDateString(

            "en-GB",

            {
                day: "2-digit",
                month: "short",
                timeZone: "UTC"
            }

        );

    }


    // Отримання часової мітки вимірювання

    function parseTimestamp(value) {

        // Числова мітка у мілісекундах

        if (Number.isFinite(value)) {

            return value;

        }


        // ISO 8601 із зазначеним часовим поясом

        if (

            typeof value !== "string" ||

            !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)

        ) {

            return NaN;

        }

        return Date.parse(value);

    }


    // ==============================================
    // 3. ПЕРЕВІРКА ВИМІРЮВАНЬ
    // ==============================================

    function isValidMeasurement(key, value) {

        if (!Number.isFinite(value)) {

            return false;

        }

        switch (key) {

            case "restingHeartRate":

                return value > 0;

            case "gripStrength":

                return value >= 0;

            case "sleepDuration":

                return value >= 0 && value <= 24;

            case "oxygen":

                return value >= 0 && value <= 100;

            case "stressLevel":

                return value >= 0 && value <= 10;

            default:

                return false;

        }

    }


    // ==============================================
    // 4. ОТРИМАННЯ ІСТОРІЇ ВИМІРЮВАНЬ
    // ==============================================

    function getHistory(person, metric) {

        const history = person.history || {};

        let records = history[metric.key];


        // Для пульсу використовуємо лише вимірювання
        // у стані спокою.
        // Звичайний pulseHistory не використовуємо.

        if (

            metric.key === "restingHeartRate" &&

            !Array.isArray(records)

        ) {

            records = Array.isArray(history.pulse)

                ? history.pulse.filter(item =>

                    item?.resting === true

                )

                : [];

        }


        // Якщо історії немає

        if (!Array.isArray(records)) {

            return [];

        }


        // Видаляємо невалідні вимірювання
        // та записи без часових міток.

        return records.map(item => ({

            value: item?.value,

            timestamp: parseTimestamp(
                item?.timestamp
            ),

            hand: item?.hand,

            quality: item?.quality

        })).filter(item =>

            Number.isFinite(item.timestamp) &&

            item.quality !== "invalid" &&

            isValidMeasurement(
                metric.key,
                item.value
            )

        );

    }


    // ==============================================
    // 5. ГРУПУВАННЯ ВИМІРЮВАНЬ ЗА ДНЯМИ
    // ==============================================

    function getDailyHistory(person, metric, now) {

        const endDay = dayStart(now);

        const startDay = endDay -
            (ANALYSIS_DAYS - 1) * DAY_MS;


        // Вимірювання лише за останні 7 днів

        let history = getHistory(person, metric)

            .filter(item =>

                item.timestamp >= startDay &&

                item.timestamp <= now

            );


        // Для сили хвату не змішуємо вимірювання
        // правої та лівої кисті.

        if (metric.key === "gripStrength") {

            const validHands = ["Right", "Left"];

            const referenceHand =
                person.baseline?.gripReferenceHand;


            // Якщо визначена контрольна кисть

            if (validHands.includes(referenceHand)) {

                history = history.filter(

                    item => item.hand === referenceHand

                );

            } else {

                // Якщо контрольна кисть не задана,
                // дозволяємо аналіз лише однієї
                // однозначно визначеної кисті.

                const hands = new Set(

                    history

                        .map(item => item.hand)

                        .filter(hand =>
                            validHands.includes(hand)
                        )

                );

                if (hands.size !== 1) {

                    return [];

                }

                const selectedHand = [...hands][0];

                history = history.filter(

                    item => item.hand === selectedHand

                );

            }

        }


        // Групування записів за датами

        const groups = new Map();

        history.forEach(item => {

            const day = dayStart(item.timestamp);

            if (!groups.has(day)) {

                groups.set(day, []);

            }

            groups.get(day).push(item);

        });


        // Формування одного значення за день

        return [...groups.entries()]

            .map(([timestamp, items]) => {

                let value;


                // Для сну беремо останній запис
                // загальної тривалості сну за день.
                // Це не окремі фрагменти сну.

                if (metric.key === "sleepDuration") {

                    items.sort((a, b) =>

                        a.timestamp - b.timestamp

                    );

                    value = items[items.length - 1].value;

                } else {

                    value = average(

                        items.map(item => item.value)

                    );

                }

                return {

                    timestamp,

                    value,

                    samples: items.length

                };

            })

            .sort((a, b) =>

                a.timestamp - b.timestamp

            );

    }


    // ==============================================
    // 6. ОБЧИСЛЕННЯ НАПРЯМКУ ТЕНДЕНЦІЇ
    // ЛІНІЙНА РЕГРЕСІЯ
    // ==============================================

    function calculateSlope(points) {

        if (points.length < 2) {

            return null;

        }

        const firstDay = points[0].timestamp;


        // X — кількість днів від першого вимірювання

        const x = points.map(point =>

            (point.timestamp - firstDay) / DAY_MS

        );


        // Y — значення показника

        const y = points.map(point => point.value);


        // Середні значення

        const meanX = average(x);

        const meanY = average(y);


        // Коефіцієнт нахилу прямої

        let numerator = 0;

        let denominator = 0;

        for (let i = 0; i < points.length; i++) {

            numerator +=

                (x[i] - meanX) * (y[i] - meanY);

            denominator +=

                (x[i] - meanX) ** 2;

        }

        return denominator !== 0

            ? numerator / denominator

            : null;

    }


    // ==============================================
    // 7. ПЕРЕВІРКА ПОСЛІДОВНОСТІ ЗМІН
    // ==============================================

    function calculateDirectionRatio(points, direction) {

        let matches = 0;

        let transitions = 0;

        for (let i = 1; i < points.length; i++) {

            const difference =

                points[i].value -

                points[i - 1].value;

            const unfavorable =

                direction === "increase"

                    ? difference > 0

                    : difference < 0;

            if (unfavorable) {

                matches++;

            }

            transitions++;

        }

        return transitions > 0

            ? matches / transitions

            : 0;

    }


    // ==============================================
    // 8. АНАЛІЗ ОКРЕМОГО ПОКАЗНИКА
    // ==============================================

    function analyzeMetric(person, metric, now) {

        const points = getDailyHistory(

            person,

            metric,

            now

        );

        const endDay = dayStart(now);

        const startDay = endDay -

            (ANALYSIS_DAYS - 1) * DAY_MS;


        // Перші три календарні дні

        const early = points.filter(point =>

            point.timestamp < startDay + 3 * DAY_MS

        );


        // Останні три календарні дні

        const recent = points.filter(point =>

            point.timestamp >= endDay - 2 * DAY_MS

        );


        // Початковий результат аналізу

        const result = {

            ...metric,

            points,

            validDays: points.length,

            available: false,

            flagged: false,

            reason: "",

            startAverage: null,

            endAverage: null,

            change: null,

            slope: null,

            directionRatio: null

        };


        // ==========================================
        // ПЕРЕВІРКА ДОСТАТНОСТІ ДАНИХ
        // ==========================================

        if (

            points.length < MIN_VALID_DAYS ||

            early.length < 2 ||

            recent.length < 2

        ) {

            result.reason =

                "At least five measured days and " +

                "sufficient early and recent data are required.";

            return result;

        }


        // Середнє значення на початку періоду

        result.startAverage = average(

            early.map(point => point.value)

        );


        // Середнє значення наприкінці періоду

        result.endAverage = average(

            recent.map(point => point.value)

        );


        // Абсолютна зміна

        const difference =

            result.endAverage -

            result.startAverage;


        // ==========================================
        // ВІДСОТКОВА ЗМІНА
        // ==========================================

        if (metric.changeType === "percent") {

            if (result.startAverage <= 0) {

                result.reason =

                    "A positive starting average is " +

                    "required for percentage comparison.";

                return result;

            }

            result.change =

                difference /

                result.startAverage * 100;

        } else {

            // Для SpO₂ — відсоткові пункти.
            // Для стресу — пункти шкали.

            result.change = difference;

        }


        // Нахил лінійної регресії

        result.slope = calculateSlope(points);


        // Частка послідовних несприятливих змін

        result.directionRatio = calculateDirectionRatio(

            points,

            metric.direction

        );

        result.available = true;


        // ==========================================
        // ПЕРЕВІРКА КРИТЕРІЇВ ТЕНДЕНЦІЇ
        // ==========================================

        // 1. Величина зміни

        const thresholdReached =

            metric.direction === "increase"

                ? result.change >= metric.threshold

                : result.change <= -metric.threshold;


        // 2. Загальний напрямок тренду

        const correctDirection =

            metric.direction === "increase"

                ? result.slope > 0

                : result.slope < 0;


        // 3. Послідовність змін

        const consistentDirection =

            result.directionRatio >= MIN_DIRECTION_RATIO;


        // Усі три умови повинні виконуватися

        result.flagged =

            thresholdReached &&

            correctDirection &&

            consistentDirection;


        result.reason = result.flagged

            ? "Configured unfavorable trend rule triggered."

            : "Configured trend rule not triggered.";


        return result;

    }


    // ==============================================
    // 9. АНАЛІЗ СУКУПНОСТІ ТЕНДЕНЦІЙ
    // ==============================================

    function sharedDays(first, second) {

        const dates = new Set(

            first.points.map(point => point.timestamp)

        );

        return second.points.filter(point =>

            dates.has(point.timestamp)

        ).length;

    }


    function findCombinedTrends(flagged) {

        const combinations = [];


        // Перевіряємо, чи тенденції мають достатньо
        // спільних днів спостереження.

        for (let i = 0; i < flagged.length; i++) {

            for (let j = i + 1; j < flagged.length; j++) {

                if (

                    sharedDays(

                        flagged[i],

                        flagged[j]

                    ) >= 3

                ) {

                    combinations.push([

                        flagged[i].key,

                        flagged[j].key

                    ]);

                }

            }

        }

        return combinations;

    }


    // ==============================================
    // 10. ЗАГАЛЬНИЙ АНАЛІЗ СТАНУ
    // ==============================================

    function analyzeHealth(person, now = Date.now()) {

        const results = metrics.map(metric =>

            analyzeMetric(person, metric, now)

        );


        // Показники, які можна проаналізувати

        const available = results.filter(

            item => item.available

        );


        // Виявлені несприятливі тенденції

        const flagged = results.filter(

            item => item.flagged

        );


        // Поєднання тенденцій

        const combinations =
            findCombinedTrends(flagged);

        const hasCombined = combinations.length > 0;


        // Наявність усіх необхідних даних

        const complete =
            available.length === metrics.length;


        // Загальний результат

        let status;

        let statusClass;

        let title;

        let summary;


        // ==========================================
        // СУКУПНІСТЬ НЕСПРИЯТЛИВИХ ТЕНДЕНЦІЙ
        // ==========================================

        if (hasCombined) {

            status = "Attention Required";

            statusClass = "attention";

            title = "Combined unfavorable trends detected";

            summary =

                "Several indicators show unfavorable changes " +

                "during overlapping observation periods. " +

                "Medical specialist review is recommended.";

        }


        // ==========================================
        // ОКРЕМА НЕСПРИЯТЛИВА ТЕНДЕНЦІЯ
        // ==========================================

        else if (flagged.length > 0) {

            status = "Early Changes";

            statusClass = "early";

            title = "Unfavorable trend detected";

            summary =

                "One or more indicators trigger individual " +

                "trend rules. A combined pattern has not " +

                "been established. Review the measurements.";

        }


        // ==========================================
        // НЕДОСТАТНЬО ДАНИХ
        // ==========================================

        else if (!complete) {

            status = "Insufficient Data";

            statusClass = "insufficient";

            title = "Incomplete measurement history";

            summary =

                "The available measurements do not trigger " +

                "the configured rules, but some indicators " +

                "lack sufficient data for a full assessment.";

        }


        // ==========================================
        // СТАБІЛЬНІ ТЕНДЕНЦІЇ
        // ==========================================

        else {

            status = "Stable Trends";

            statusClass = "stable";

            title = "No configured trend rules triggered";

            summary =

                "The available measurements do not trigger " +

                "the configured unfavorable trend rules. " +

                "This does not establish medical fitness " +

                "or rule out health problems.";

        }


        // Повертаємо повний результат аналізу

        return {

            status,

            statusClass,

            title,

            summary,

            results,

            available,

            flagged,

            combinations,

            complete,

            analyzedAt: now

        };

    }


    // ==============================================
    // 11. ФОРМАТУВАННЯ ЗМІНИ ПОКАЗНИКА
    // ==============================================

    function formatChange(result) {

        if (!Number.isFinite(result.change)) {

            return "—";

        }

        const sign = result.change > 0

            ? "+"

            : "";


        // Одиниця вимірювання зміни

        const unit =

            result.changeType === "percent"

                ? "%"

                : result.changeType === "percentagePoints"

                    ? " pp"

                    : " points";


        return sign +

            formatNumber(result.change) +

            unit;

    }


    // ==============================================
    // 12. СТВОРЕННЯ ГРАФІКА ТЕНДЕНЦІЇ
    // ==============================================

    function createTrendChart(result, now) {

        const points = result.points;

        if (points.length < 2) {

            return `

                <div class="insights-empty">

                    Not enough chart data

                </div>

            `;

        }


        // ==========================================
        // РОЗМІРИ SVG
        // ==========================================

        const width = 600;

        const height = 180;

        const left = 55;

        const right = 20;

        const top = 18;

        const bottom = 34;

        const chartWidth = width - left - right;

        const chartHeight = height - top - bottom;


        // ==========================================
        // МЕЖІ ПОКАЗНИКІВ
        // ==========================================

        const values = points.map(point => point.value);

        let minimum = Math.min(...values);

        let maximum = Math.max(...values);

        const padding = maximum === minimum

            ? Math.max(Math.abs(maximum) * 0.05, 0.1)

            : (maximum - minimum) * 0.15;

        minimum -= padding;

        maximum += padding;

        const range = maximum - minimum || 1;


        // Початок періоду

        const firstDay = dayStart(now) -

            (ANALYSIS_DAYS - 1) * DAY_MS;


        // ==========================================
        // КООРДИНАТИ ТОЧОК
        // ==========================================

        const coordinates = points.map(point => ({

            ...point,

            x: left +

                (

                    (point.timestamp - firstDay) /

                    DAY_MS /

                    (ANALYSIS_DAYS - 1)

                ) * chartWidth,

            y: top + chartHeight -

                (

                    (point.value - minimum) / range

                ) * chartHeight

        }));


        // ==========================================
        // ГОРИЗОНТАЛЬНА СІТКА ГРАФІКА
        // ==========================================

        let grid = "";

        for (let i = 0; i <= 3; i++) {

            const y = top + i * chartHeight / 3;

            const value = maximum -

                i * range / 3;

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
                    x="${left - 9}"
                    y="${y + 4}"
                    text-anchor="end"
                    fill="#91a5bd"
                    font-size="11">

                    ${formatNumber(value)}

                </text>

            `;

        }


        // ==========================================
        // ПІДПИСИ КАЛЕНДАРНИХ ДНІВ
        // ==========================================

        let labels = "";

        for (let i = 0; i < ANALYSIS_DAYS; i++) {

            const x = left +

                i * chartWidth / (ANALYSIS_DAYS - 1);

            const date = firstDay + i * DAY_MS;

            labels += `

                <text
                    x="${x}"
                    y="${height - 9}"
                    text-anchor="middle"
                    font-size="10"
                    fill="#91a5bd">

                    ${escape(formatDay(date))}

                </text>

            `;

        }


        // ==========================================
        // ЛІНІЯ ГРАФІКА
        // ==========================================

        // Не з'єднуємо дні, між якими
        // відсутні вимірювання.

        let line = "";

        coordinates.forEach((point, index) => {

            const previous = coordinates[index - 1];

            const gap = previous &&

                point.timestamp - previous.timestamp

                    > DAY_MS;

            line +=

                `${index === 0 || gap ? "M" : "L"}` +

                `${point.x} ${point.y} `;

        });


        // Колір тенденції

        const color = result.flagged

            ? "#f5b94c"

            : "#4dd9ec";


        // ==========================================
        // ГОТОВИЙ ГРАФІК
        // ==========================================

        return `

            <div class="insights-chart">

                <svg
                    viewBox="0 0 ${width} ${height}"
                    role="img"
                    aria-label="${escape(
                        result.name + " daily trend"
                    )}">

                    ${grid}

                    <path
                        d="${line}"
                        fill="none"
                        stroke="${color}"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />

                    ${coordinates.map(point => `

                        <circle
                            cx="${point.x}"
                            cy="${point.y}"
                            r="4"
                            fill="${color}">

                            <title>

                                ${escape(

                                    formatDay(point.timestamp) +

                                    ": " +

                                    formatNumber(point.value) +

                                    " " +

                                    result.unit

                                )}

                            </title>

                        </circle>

                    `).join("")}

                    ${labels}

                </svg>

            </div>

        `;

    }


    // ==============================================
    // 13. КАРТКА ВИЯВЛЕНОЇ ТЕНДЕНЦІЇ
    // ==============================================

    function createTrendCard(result, now) {

        return `

            <article class="insights-trend-card">


                <!-- ЗАГОЛОВОК КАРТКИ -->

                <div class="insights-trend-heading">

                    <div class="insights-trend-title">

                        <span class="insights-trend-icon">

                            ${escape(result.icon)}

                        </span>

                        <div>

                            <h4>

                                ${escape(result.name)}

                            </h4>

                            <p>

                                ${result.direction === "increase"

                                    ? "Increasing trend"

                                    : "Decreasing trend"}

                            </p>

                        </div>

                    </div>

                    <strong class="insights-change">

                        ${escape(formatChange(result))}

                    </strong>

                </div>


                <!-- СЕРЕДНІ ЗНАЧЕННЯ -->

                <div class="insights-values">

                    <div>

                        <span>Early average</span>

                        <strong>

                            ${formatNumber(
                                result.startAverage
                            )}

                            ${escape(result.unit)}

                        </strong>

                    </div>

                    <span class="insights-arrow">→</span>

                    <div>

                        <span>Recent average</span>

                        <strong>

                            ${formatNumber(
                                result.endAverage
                            )}

                            ${escape(result.unit)}

                        </strong>

                    </div>

                </div>


                <!-- ГРАФІК -->

                ${createTrendChart(result, now)}


                <!-- ІНФОРМАЦІЯ ПРО ТЕНДЕНЦІЮ -->

                <div class="insights-trend-footer">

                    <span>

                        ${result.validDays}/7 measured days

                    </span>

                    <span>

                        ${Math.round(

                            result.directionRatio * 100

                        )}% directional consistency

                    </span>

                </div>

            </article>

        `;

    }


    // ==============================================
    // 14. РЕКОМЕНДАЦІЇ ЩОДО ПЕРЕВІРКИ
    // ==============================================

    function getRecommendations(analysis) {

        const recommendations = [];

        const detected = new Set(

            analysis.flagged.map(item => item.key)

        );


        // ==========================================
        // ПУЛЬС У СТАНІ СПОКОЮ
        // ==========================================

        if (detected.has("restingHeartRate")) {

            recommendations.push(

                "Verify resting heart rate measurements " +

                "and review the measurement conditions."

            );

        }


        // ==========================================
        // СИЛА ХВАТУ
        // ==========================================

        if (detected.has("gripStrength")) {

            recommendations.push(

                "Verify grip strength measurements using " +

                "the same hand and examination protocol."

            );

        }


        // ==========================================
        // ТРИВАЛІСТЬ СНУ
        // ==========================================

        if (detected.has("sleepDuration")) {

            recommendations.push(

                "Review recent sleep records and " +

                "recovery-related observations."

            );

        }


        // ==========================================
        // НАСИЧЕННЯ КРОВІ КИСНЕМ
        // ==========================================

        if (detected.has("oxygen")) {

            recommendations.push(

                "Verify oxygen saturation readings " +

                "and sensor measurement quality."

            );

        }


        // ==========================================
        // РІВЕНЬ СТРЕСУ
        // ==========================================

        if (detected.has("stressLevel")) {

            recommendations.push(

                "Review stress estimates together with " +

                "available well-being and check-in records."

            );

        }


        // ==========================================
        // СУКУПНІСТЬ ТЕНДЕНЦІЙ
        // ==========================================

        if (analysis.combinations.length > 0) {

            recommendations.push(

                "Request medical specialist review " +

                "of the combined changes."

            );

        }


        // ==========================================
        // НЕДОСТАТНЯ КІЛЬКІСТЬ ДАНИХ
        // ==========================================

        if (!analysis.complete) {

            recommendations.push(

                "Collect additional valid measurements " +

                "for indicators with insufficient history."

            );

        }


        // ==========================================
        // СТАБІЛЬНІ ТЕНДЕНЦІЇ
        // ==========================================

        if (!recommendations.length) {

            recommendations.push(

                "Continue routine monitoring according " +

                "to the approved mission health protocol."

            );

        }

        return recommendations;

    }


    // ==============================================
    // 15. ІНФОРМАЦІЯ ПРО ДОСТАТНІСТЬ ДАНИХ
    // ==============================================

    function createAvailability(result) {

        const percent =

            result.validDays / ANALYSIS_DAYS * 100;

        return `

            <div class="insights-data-row">

                <div class="insights-data-heading">

                    <span>

                        ${escape(result.name)}

                    </span>

                    <strong>

                        ${result.validDays}/7 days

                    </strong>

                </div>


                <!-- ШКАЛА НАЯВНОСТІ ДАНИХ -->

                <div class="insights-data-progress">

                    <div
                        class="insights-data-fill
                            ${result.available

                                ? "available"

                                : "unavailable"}"

                        style="width: ${percent}%">

                    </div>

                </div>


                <!-- ПОЯСНЕННЯ -->

                <small class="insights-data-note">

                    ${result.available

                        ? "Sufficient data for analysis"

                        : escape(result.reason)}

                </small>

            </div>

        `;

    }


    // ==============================================
    // 16. ДЕМОНСТРАЦІЙНІ СЦЕНАРІЇ
    // ==============================================

    function createDemoPerson(scenario, now) {

        // Початок семиденного періоду

        const firstDay = dayStart(now) -

            (ANALYSIS_DAYS - 1) * DAY_MS;


        // Перетворення масиву значень
        // на історію з часовими мітками.

        function history(values, extra = {}) {

            return values.map((value, index) => ({

                value,

                timestamp: new Date(

                    firstDay + index * DAY_MS

                ).toISOString(),

                ...extra

            }));

        }


        // ==========================================
        // СЦЕНАРІЙ 1
        // СУКУПНІСТЬ НЕСПРИЯТЛИВИХ ЗМІН
        // ==========================================

        if (scenario === "combined") {

            return {

                baseline: {

                    gripReferenceHand: "Right"

                },

                history: {

                    restingHeartRate: history([

                        68, 69, 71, 73, 75, 77, 79

                    ]),

                    gripStrength: history([

                        430, 425, 420, 410, 400, 388, 380

                    ], {

                        hand: "Right"

                    }),

                    sleepDuration: history([

                        8.2, 8, 7.6, 7.2, 6.8, 6.2, 6

                    ]),

                    oxygen: history([

                        98, 98, 97, 98, 97, 98, 97

                    ]),

                    stressLevel: history([

                        3, 3, 4, 3, 4, 4, 4

                    ])

                }

            };

        }


        // ==========================================
        // СЦЕНАРІЙ 2
        // СТАБІЛЬНІ ТЕНДЕНЦІЇ
        // ==========================================

        if (scenario === "stable") {

            return {

                baseline: {

                    gripReferenceHand: "Right"

                },

                history: {

                    restingHeartRate: history([

                        70, 72, 71, 70, 73, 71, 72

                    ]),

                    gripStrength: history([

                        420, 418, 421, 419, 422, 420, 419

                    ], {

                        hand: "Right"

                    }),

                    sleepDuration: history([

                        7.8, 8, 7.9, 8.1, 7.7, 8, 7.9

                    ]),

                    oxygen: history([

                        98, 97, 98, 98, 97, 98, 98

                    ]),

                    stressLevel: history([

                        3, 4, 3, 3, 4, 3, 4

                    ])

                }

            };

        }


        // ==========================================
        // СЦЕНАРІЙ 3
        // ОКРЕМА НЕСПРИЯТЛИВА ТЕНДЕНЦІЯ
        // ==========================================

        if (scenario === "early") {

            const person = createDemoPerson(

                "stable",

                now

            );

            person.history.restingHeartRate = history([

                68, 69, 71, 73, 75, 77, 79

            ]);

            return person;

        }


        // ==========================================
        // СЦЕНАРІЙ 4
        // НЕДОСТАТНЬО ДАНИХ
        // ==========================================

        return {

            history: {

                restingHeartRate: history([

                    72, 75

                ])

            }

        };

    }


    // ==============================================
    // 17. СТВОРЕННЯ РЕЗУЛЬТАТУ АНАЛІЗУ
    // ==============================================

    function renderResult(container, analysis, source) {

        const recommendations =

            getRecommendations(analysis);


        // Час останнього аналізу

        const lastAnalysis =

            new Date(analysis.analyzedAt).toLocaleString(

                "en-GB",

                {

                    day: "2-digit",

                    month: "short",

                    year: "numeric",

                    hour: "2-digit",

                    minute: "2-digit",

                    timeZone: "UTC"

                }

            );


        // ==========================================
        // ВМІСТ СТОРІНКИ РЕЗУЛЬТАТІВ
        // ==========================================

        container.innerHTML = `


            <!-- ==================================
                 ЗАГАЛЬНІ ПОКАЗНИКИ
            =================================== -->

            <div class="insights-summary-grid">


                <!-- ЗАГАЛЬНИЙ СТАТУС -->

                <article class="insights-stat">

                    <span>Trend Status</span>

                    <strong class="insights-status
                        ${analysis.statusClass}">

                        ${escape(analysis.status)}

                    </strong>

                </article>


                <!-- КІЛЬКІСТЬ ВИЯВЛЕНИХ ЗМІН -->

                <article class="insights-stat">

                    <span>Detected Changes</span>

                    <strong>

                        ${analysis.available.length

                            ? analysis.flagged.length

                            : "—"}

                    </strong>

                    <small>

                        ${analysis.available.length}

                        indicators analyzed

                    </small>

                </article>


                <!-- ПЕРІОД АНАЛІЗУ -->

                <article class="insights-stat">

                    <span>Analysis Period</span>

                    <strong>7 days</strong>

                    <small>UTC calendar days</small>

                </article>

            </div>


            <!-- ==================================
                 ЗАГАЛЬНИЙ ВИСНОВОК
            =================================== -->

            <section class="insights-panel">

                <div class="insights-panel-heading">

                    <span class="insights-heading-icon">

                        ✧

                    </span>

                    <h3>Health Trend Summary</h3>

                </div>

                <div class="insights-summary-box
                    ${analysis.statusClass}">

                    <h4>

                        ${escape(analysis.title)}

                    </h4>

                    <p>

                        ${escape(analysis.summary)}

                    </p>

                </div>


                <!-- ОБМЕЖЕННЯ ЧЕРЕЗ ВІДСУТНІСТЬ ДАНИХ -->

                ${!analysis.complete ? `

                    <p class="insights-description">

                        Assessment is limited by incomplete

                        measurement history.

                    </p>

                ` : ""}

            </section>


            <!-- ==================================
                 ВИЯВЛЕНІ ТЕНДЕНЦІЇ
            =================================== -->

            <section class="insights-panel">

                <div class="insights-panel-heading">

                    <span class="insights-heading-icon">

                        ↗

                    </span>

                    <h3>Detected Patterns</h3>

                </div>


                <!-- КАРТКИ З ГРАФІКАМИ -->

                ${analysis.flagged.length ? `

                    <div class="insights-trends-grid">

                        ${analysis.flagged.map(result =>

                            createTrendCard(

                                result,

                                analysis.analyzedAt

                            )

                        ).join("")}

                    </div>

                ` : `

                    <div class="insights-empty">

                        <span>▥</span>

                        <p>

                            ${analysis.complete

                                ? "No configured trend rules triggered"

                                : "No flagged trends in the available data"}

                        </p>

                    </div>

                `}

            </section>


            <!-- ==================================
                 РЕКОМЕНДАЦІЇ
            =================================== -->

            <section class="insights-panel">

                <div class="insights-panel-heading">

                    <span class="insights-heading-icon">

                        ✓

                    </span>

                    <h3>Recommended Follow-up</h3>

                </div>

                <div class="insights-recommendations">

                    ${recommendations.map(text => `

                        <div class="insights-recommendation">

                            <span>→</span>

                            <p>${escape(text)}</p>

                        </div>

                    `).join("")}

                </div>

            </section>


            <!-- ==================================
                 ДОСТАТНІСТЬ ДАНИХ
            =================================== -->

            <section class="insights-panel">

                <div class="insights-panel-heading">

                    <span class="insights-heading-icon">

                        ▥

                    </span>

                    <h3>Data Availability</h3>

                </div>

                ${analysis.results.map(

                    createAvailability

                ).join("")}

            </section>


            <!-- ==================================
                 ПОЯСНЕННЯ АЛГОРИТМУ
            =================================== -->

            <details class="insights-panel
                insights-method">

                <summary>

                    <strong>Analysis Methodology</strong>

                </summary>

                <p class="insights-description">

                    The algorithm compares early and recent

                    daily averages, calculates a linear trend

                    and evaluates directional consistency.

                </p>


                <!-- КРИТЕРІЇ АНАЛІЗУ -->

                <div class="insights-rules">

                    ${metrics.map(metric => `

                        <div class="insights-rule">

                            <span>

                                ${escape(metric.name)}

                            </span>

                            <strong>

                                ${metric.direction === "increase"

                                    ? "↑"

                                    : "↓"}

                                ${metric.threshold}

                                ${metric.changeType === "percent"

                                    ? "%"

                                    : metric.changeType ===
                                        "percentagePoints"

                                        ? " pp"

                                        : " points"}

                            </strong>

                        </div>

                    `).join("")}

                </div>


                <!-- ОБМЕЖЕННЯ АЛГОРИТМУ -->

                <p class="insights-description">

                    Demo thresholds are illustrative rules,

                    not validated clinical limits.

                    A detected trend requires consistent

                    direction in at least 60% of observed

                    consecutive changes.

                    At least five measured days are required.

                    The current UTC day may be incomplete.

                </p>

            </details>


            <!-- ==================================
                 СЛУЖБОВА ІНФОРМАЦІЯ
            =================================== -->

            <div class="insights-footer">

                <span>

                    Source: ${escape(source)}

                </span>

                <span>

                    Last analysis:

                    ${escape(lastAnalysis)} UTC

                </span>

            </div>


            <!-- ==================================
                 ПОПЕРЕДЖЕННЯ
            =================================== -->

            <div class="insights-disclaimer">

                Demonstration module · Rule-based analysis.

                Decision support only.

                Not a medical diagnosis or validated

                prediction of illness.

                Does not modify critical alerts or SOS.

            </div>

        `;

    }


    // ==============================================
    // 18. ГОЛОВНА СТОРІНКА AI HEALTH INSIGHTS
    // ==============================================

    function renderHealthInsights(container, person) {

        if (!container || !person) {

            return;

        }


        // Початковий вміст сторінки

        container.innerHTML = `

            <div class="insights-layout">


                <!-- ==================================
                     ВЕРХНЯ ПАНЕЛЬ
                =================================== -->

                <section class="insights-panel
                    insights-toolbar">

                    <div class="insights-toolbar-heading">

                        <div>

                            <h3>

                                ✧ Early Trend Detection

                            </h3>

                            <p>

                                Individual health trend analysis

                            </p>

                        </div>


                        <!-- КНОПКА ЗАПУСКУ АНАЛІЗУ -->

                        <button
                            type="button"
                            class="insights-run-button"
                            id="run-health-analysis">

                            ✧ Run Analysis

                        </button>

                    </div>


                    <!-- ==================================
                         ДЖЕРЕЛО ДАНИХ
                    =================================== -->

                    <div class="insights-controls">

                        <div class="insights-field">

                            <label for="insights-source">

                                Data Source

                            </label>

                            <select id="insights-source">


                                <!-- ІСТОРІЯ АСТРОНАВТА -->

                                <option value="actual">

                                    Astronaut History

                                </option>


                                <!-- ДЕМОНСТРАЦІЙНІ СЦЕНАРІЇ -->

                                <option value="combined">

                                    Demo — Combined Changes

                                </option>

                                <option value="stable">

                                    Demo — Stable Trends

                                </option>

                                <option value="early">

                                    Demo — Early Changes

                                </option>

                                <option value="insufficient">

                                    Demo — Insufficient Data

                                </option>

                            </select>

                        </div>


                        <!-- ПЕРІОД АНАЛІЗУ -->

                        <div class="insights-field">

                            <label>Analysis Period</label>

                            <div class="insights-period">

                                Last 7 Calendar Days

                            </div>

                        </div>

                    </div>


                    <!-- ==================================
                         ПОВІДОМЛЕННЯ ПРО ДЖЕРЕЛО
                    =================================== -->

                    <div
                        class="insights-source-notice"
                        id="insights-source-notice"
                        role="status">

                    </div>

                </section>


                <!-- ==================================
                     РЕЗУЛЬТАТ АНАЛІЗУ
                =================================== -->

                <div
                    id="health-analysis-result"
                    class="insights-result">

                </div>

            </div>

        `;


        // ==========================================
        // HTML-ЕЛЕМЕНТИ
        // ==========================================

        const sourceSelect = container.querySelector(

            "#insights-source"

        );

        const runButton = container.querySelector(

            "#run-health-analysis"

        );

        const resultContainer = container.querySelector(

            "#health-analysis-result"

        );

        const notice = container.querySelector(

            "#insights-source-notice"

        );


        // ==========================================
        // ЗАПУСК АНАЛІЗУ
        // ==========================================

        function runAnalysis() {

            const selected = sourceSelect.value;

            const now = Date.now();

            let data;

            let source;


            // ======================================
            // ІСТОРІЯ ВИБРАНОГО АСТРОНАВТА
            // ======================================

            if (selected === "actual") {

                data = person;

                source = "Astronaut History";

                notice.textContent =

                    "Analysis uses the selected astronaut's " +

                    "available historical measurements. " +

                    "Detected trends may generate local notifications.";

            }


            // ======================================
            // ОКРЕМИЙ ДЕМОНСТРАЦІЙНИЙ СЦЕНАРІЙ
            // ======================================

            else {

                data = createDemoPerson(selected, now);

                source = "Synthetic Demo Data";

                notice.textContent =

                    "Synthetic demonstration data. " +

                    "The astronaut's medical records " +

                    "and sensor history are not changed. " +

                    "Notification Center alerts are not generated.";

            }


            // ======================================
            // АНАЛІЗ ПОКАЗНИКІВ
            // ======================================

            const analysis = analyzeHealth(data, now);


            // ======================================
            // ВІДОБРАЖЕННЯ РЕЗУЛЬТАТУ
            // ======================================

            renderResult(

                resultContainer,

                analysis,

                source

            );


            // ======================================
            // NOTIFICATION CENTER
            // ======================================

            // Передаємо дані центру сповіщень лише
            // при аналізі історії вибраного астронавта.
            //
            // Синтетичні демонстраційні сценарії
            // не повинні створювати повідомлення.

            if (selected === "actual") {

                if (

                    typeof window.PulsarNotifications?.syncCrew

                        === "function"

                ) {

                    try {

                        window.PulsarNotifications.syncCrew([

                            person

                        ]);

                    } catch (error) {

                        console.error(

                            "Cannot synchronize health insights:",

                            error

                        );

                    }

                }

            }


            // Демонстраційні сценарії не створюють
            // сповіщень та не змінюють історію екіпажу.

        }


        // ==========================================
        // НАТИСКАННЯ RUN ANALYSIS
        // ==========================================

        runButton.addEventListener(

            "click",

            runAnalysis

        );


        // ==========================================
        // ЗМІНА ДЖЕРЕЛА ДАНИХ
        // ==========================================

        sourceSelect.addEventListener(

            "change",

            runAnalysis

        );


        // ==========================================
        // ПОЧАТКОВИЙ АНАЛІЗ
        // ==========================================

        runAnalysis();

    }


    // ==============================================
    // 19. ПІДКЛЮЧЕННЯ ДО ASTRONAUT.JS
    // ==============================================

    window.renderHealthInsights = renderHealthInsights;


    // ==============================================
    // 20. ПІДКЛЮЧЕННЯ ДО NOTIFICATION CENTER
    // ==============================================

    // Окремий доступ до алгоритму для:
    //
    // notifications.js — ранні попередження;
    // script.js — моніторинг екіпажу;
    // майбутнього backend;
    // демонстраційного тестування.

    window.PulsarInsights = Object.freeze({

        analyzeHealth,

        createDemoPerson

    });

})();
