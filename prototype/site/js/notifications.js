
// ==================================================
// PULSAR — NOTIFICATION CENTER
// ЄДИНИЙ ЦЕНТР СПОВІЩЕНЬ ЕКІПАЖУ
// ==================================================

(function () {

    "use strict";

    // ==================================================
    // 1. НАЛАШТУВАННЯ
    // ==================================================

    const STORAGE_KEY = "pulsar_live_notifications";
    const CREW_STORAGE_KEY = "pulsar_live_crew_cache";
    const SOS_STORAGE_KEY = "pulsar_sos_local";

    // Демонстраційний поріг заряду

    const LOW_BATTERY_THRESHOLD = 20;

    // Періодичність перевірки

    const CHECK_INTERVAL = 60000;

    // Пріоритети повідомлень

    const priorities = {

        critical: 0,

        warning: 1,

        environmental: 1,

        device: 2,

        reminder: 3,

        info: 4

    };

    // Допустимі розділи профілю

    const validSections = [

        "health",
        "environment",
        "analytics",
        "insights",
        "guide",
        "settings"

    ];

    let currentFilter = "all";

    let uiInitialized = false;

    let storageError = false;


    // ==================================================
    // 2. ДОПОМІЖНІ ФУНКЦІЇ
    // ==================================================

    function escapeHTML(value) {

        return String(value ?? "—")

            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");

    }

    // Створення унікального ID

    function createId() {

        if (
            typeof window.crypto?.randomUUID === "function"
        ) {

            return window.crypto.randomUUID();

        }

        return Date.now().toString(36) +

            "-" +

            Math.random().toString(36).slice(2);

    }

    // Отримання даних зі сховища

    function readStorage(key, fallback) {

        try {

            const value = sessionStorage.getItem(key);

            return value ? JSON.parse(value) : fallback;

        } catch (error) {

            console.error(
                "Cannot read demo storage:",
                error
            );

            return fallback;

        }

    }

    // Поточна локальна дата

    function localDate(value = new Date()) {

        const date = value instanceof Date

            ? value

            : new Date(value);

        if (!Number.isFinite(date.getTime())) {

            return "";

        }

        const year = date.getFullYear();

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;

    }

    // Поточний локальний час

    function localTime(date = new Date()) {

        const hours = String(
            date.getHours()
        ).padStart(2, "0");

        const minutes = String(
            date.getMinutes()
        ).padStart(2, "0");

        return `${hours}:${minutes}`;

    }

    // Перевірка формату часу

    function isValidTime(value) {

        return typeof value === "string" &&

            /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

    }

    // Перевірка календарної дати

    function isValidDate(value) {

        if (

            typeof value !== "string" ||

            !/^\d{4}-\d{2}-\d{2}$/.test(value)

        ) {

            return false;

        }

        return localDate(

            new Date(value + "T00:00:00")

        ) === value;

    }


    // ==================================================
    // 3. ОТРИМАННЯ ІСТОРІЇ СПОВІЩЕНЬ
    // ==================================================

    function loadState() {

        const saved = readStorage(STORAGE_KEY, {});

        return {

            notifications: Array.isArray(
                saved?.notifications
            )

                ? saved.notifications.filter(item =>

                    item &&

                    typeof item === "object" &&

                    typeof item.id === "string"

                )

                : [],

            activeEvents:

                saved?.activeEvents &&

                typeof saved.activeEvents === "object" &&

                !Array.isArray(saved.activeEvents)

                    ? saved.activeEvents

                    : {}

        };

    }

    let state = loadState();


    // ==================================================
    // 4. ЗБЕРЕЖЕННЯ СПОВІЩЕНЬ
    // ==================================================

    function saveState() {

        try {

            sessionStorage.setItem(

                STORAGE_KEY,

                JSON.stringify(state)

            );

            storageError = false;

            return true;

        } catch (error) {

            storageError = true;

            console.error(

                "Cannot save notifications:",

                error

            );

            return false;

        }

    }

    // Повідомлення інших модулів про зміни

    function publishChanges() {

        saveState();

        renderNotifications();

        document.dispatchEvent(

            new CustomEvent(

                "pulsar:notifications-change",

                {

                    detail: {

                        unread: state.notifications.filter(

                            item => !item.read

                        ).length,

                        saved: !storageError

                    }

                }

            )

        );

    }


    // ==================================================
    // 5. ОТРИМАННЯ ДАНИХ ЕКІПАЖУ
    // ==================================================

    function getCrew() {

        const saved = readStorage(

            CREW_STORAGE_KEY,

            null

        );

        if (Array.isArray(saved)) {

            return saved;

        }

        // Початкові дані головної сторінки

        if (

            typeof astronauts !== "undefined" &&

            Array.isArray(astronauts)

        ) {

            return astronauts;

        }

        return [];

    }


    // ==================================================
    // 6. СТВОРЕННЯ НОВОГО СПОВІЩЕННЯ
    // ==================================================

    function insertNotification(data) {

        if (

            !data ||

            typeof data !== "object" ||

            !data.title ||

            !data.message

        ) {

            return null;

        }

        // Категорія повідомлення

        const category = Object.hasOwn(

            priorities,

            data.category

        )

            ? data.category

            : "info";

        // Захист від дублювання

        const dedupeKey = data.dedupeKey

            ? String(data.dedupeKey)

            : null;

        if (

            dedupeKey &&

            state.notifications.some(item =>

                item.dedupeKey === dedupeKey

            )

        ) {

            return null;

        }

        // Час створення

        const date = data.timestamp != null

            ? new Date(data.timestamp)

            : new Date();

        const timestamp = Number.isFinite(date.getTime())

            ? date.toISOString()

            : new Date().toISOString();

        // Формування сповіщення

        const notification = {

            id: createId(),

            astronautId: data.astronautId ?? null,

            astronautName: String(

                data.astronautName || "Crew System"

            ),

            title: String(data.title),

            message: String(data.message),

            category,

            type: String(data.type || "general"),

            // ======================================
            // НОВЕ:
            // НАПРЯМОК ПЕРЕХОДУ ЗІ СПОВІЩЕННЯ
            // ======================================

            target: data.target === "crew-analysis"

                ? "crew-analysis"

                : "profile",

            section: validSections.includes(data.section)

                ? data.section

                : "health",

            timestamp,

            read: false,

            readAt: null,

            dedupeKey

        };

        state.notifications.unshift(notification);

        return notification;

    }

    // Публічна функція створення сповіщення

    function addNotification(data) {

        const notification = insertNotification(data);

        if (notification) {

            publishChanges();

        }

        return notification

            ? { ...notification }

            : null;

    }


    // ==================================================
    // 7. ЗАХИСТ ВІД ПОВТОРЮВАНИХ СПОВІЩЕНЬ
    // ==================================================

    function trackEvent(
        key,
        active,
        data,
        signature = ""
    ) {

        const previous = Object.hasOwn(

            state.activeEvents,

            key

        )

            ? state.activeEvents[key]

            : null;

        // Подія більше не активна

        if (!active) {

            if (previous) {

                delete state.activeEvents[key];

                return true;

            }

            return false;

        }

        // Така сама подія вже зафіксована

        if (

            previous &&

            previous.signature === signature

        ) {

            return false;

        }

        // Створюємо повідомлення

        const notification = insertNotification(data);

        if (!notification) {

            return false;

        }

        // Запам'ятовуємо активну подію

        state.activeEvents[key] = {

            notificationId: notification.id,

            signature

        };

        return true;

    }


    // ==================================================
    // 8. CREW ENVIRONMENTAL ANALYSIS
    // СПІЛЬНІ РИЗИКИ КОСМІЧНОГО СЕРЕДОВИЩА
    // ==================================================

    function syncEnvironmentalAnalysis(dataset, analysis) {

        // ==========================================
        // ПЕРЕВІРКА ДЖЕРЕЛА ДАНИХ
        // ==========================================

        // Демонстраційні сценарії не повинні
        // створювати сповіщення у загальному центрі.

        if (

            dataset?.source !== "actual" ||

            analysis?.source !== "actual" ||

            typeof dataset.habitatId !== "string" ||

            !dataset.habitatId.trim() ||

            !Array.isArray(analysis.patterns) ||

            !Array.isArray(analysis.crew) ||

            !Number.isFinite(analysis.end) ||

            analysis.end > Date.now() ||

            Date.now() - analysis.end > 600000

        ) {

            return false;

        }

        // Показники спільного середовища

        const metrics = [

            "co2",

            "airOxygen",

            "pressure",

            "airTemperature"

        ];

        // Унікальний префікс космічного модуля

        const prefix =

            "environmental:" +

            encodeURIComponent(dataset.habitatId) +

            ":";

        let changed = false;


        // ==========================================
        // ПЕРЕВІРКА КОЖНОГО ЧИННИКА СЕРЕДОВИЩА
        // ==========================================

        for (const metric of metrics) {

            const key = prefix + metric;

            const pattern = analysis.patterns.find(

                item => item?.metric === metric

            );

            const rule = analysis.rules?.[metric];


            // Відсутність критеріїв не означає,
            // що спільна проблема зникла.

            if (

                !rule?.criteria ||

                !Array.isArray(rule.timeline)

            ) {

                continue;

            }


            // ======================================
            // ОСТАННІЙ ГОДИННИЙ ІНТЕРВАЛ
            // ======================================

            // Попередні історичні закономірності
            // залишаються в аналітиці.
            //
            // Сповіщення створюємо лише для
            // останнього годинного інтервалу.

            const latest = rule.timeline.at(-1);

            if (

                !latest ||

                !Array.isArray(latest.relatedIds) ||

                !Number.isFinite(latest.environment)

            ) {

                continue;

            }


            // ======================================
            // ЧЛЕНИ ЕКІПАЖУ З ПОВ'ЯЗАНИМИ ЗМІНАМИ
            // ======================================

            const ids = [

                ...new Set(

                    latest.relatedIds.map(String)

                )

            ].filter(id =>

                analysis.crew.some(

                    person => String(person.id) === id

                )

            ).sort();


            // ======================================
            // ВИЯВЛЕНА СПІЛЬНА ЗАКОНОМІРНІСТЬ
            // ======================================

            if (

                pattern &&

                latest.outside === true &&

                ids.length >= 2

            ) {

                const names = ids.map(id =>

                    analysis.crew.find(

                        person => String(person.id) === id

                    ).name

                );

                // Формування сповіщення

                changed = trackEvent(

                    key,

                    true,

                    {

                        astronautName:

                            dataset.habitatName ||

                            dataset.habitatId,

                        title:

                            "Possible Shared Environmental Risk",

                        message:

                            String(pattern.title) +

                            ": " +

                            names.join(", ") +

                            ". Matching observations in the latest hourly interval. " +

                            "Verify sensor data and crew observations. " +

                            "Local prototype alert, not a diagnosis.",

                        category: "environmental",

                        type: "shared-environmental-risk",

                        target: "crew-analysis"

                    },

                    // Повторний аналіз тих самих
                    // астронавтів не створює дублікати.

                    JSON.stringify(ids)

                ) || changed;

            }


            // ======================================
            // СПІЛЬНА ЗАКОНОМІРНІСТЬ БІЛЬШЕ
            // НЕ СПОСТЕРІГАЄТЬСЯ
            // ======================================

            else if (

                latest.measuredCount === analysis.crew.length &&

                analysis.crew.length >= 2

            ) {

                // Неповні дані не скасовують
                // попереднє активне попередження.

                changed = trackEvent(

                    key,

                    false

                ) || changed;

            }

        }

        // Зберігаємо нові повідомлення

        if (changed) {

            publishChanges();

        }

        return changed;

    }


    // ==================================================
    // 9. ОТРИМАННЯ ВСІХ СПОВІЩЕНЬ
    // ==================================================

    function getNotifications() {

        return state.notifications.map(item => ({

            ...item

        }));

    }


    // ==================================================
    // 10. ПОЗНАЧЕННЯ ЯК ПРОЧИТАНОГО
    // ==================================================

    function markAsRead(id) {

        const notification = state.notifications.find(

            item => item.id === id

        );

        if (!notification || notification.read) {

            return false;

        }

        notification.read = true;

        notification.readAt = new Date().toISOString();

        publishChanges();

        return true;

    }


    // ==================================================
    // 11. ПРОЧИТАННЯ ВСІХ ПОВІДОМЛЕНЬ
    // ==================================================

    function markAllAsRead() {

        const timestamp = new Date().toISOString();

        let changed = false;

        state.notifications.forEach(item => {

            if (!item.read) {

                item.read = true;

                item.readAt = timestamp;

                changed = true;

            }

        });

        if (changed) {

            publishChanges();

        }

    }


    // ==================================================
    // 12. ПЕРЕВІРКА СТАНУ ЗДОРОВ'Я
    // ==================================================

    function syncHealth(person) {

        const preferences =

            person.settings?.notifications || {};

        const critical = person.status === "Critical";

        const warning =

            person.status === "Warning" &&

            preferences.health !== false;

        const message = String(

            person.warning ||

            "Health status requires review."

        );

        let changed = false;


        // КРИТИЧНІ ПОПЕРЕДЖЕННЯ

        if (trackEvent(

            `health-critical:${person.id}`,

            critical,

            {

                astronautId: person.id,

                astronautName: person.name,

                title: "Critical Health Alert",

                message,

                category: "critical",

                type: "health-critical",

                section: "health"

            },

            message

        )) {

            changed = true;

        }


        // ЗВИЧАЙНІ ПОПЕРЕДЖЕННЯ

        if (trackEvent(

            `health-warning:${person.id}`,

            warning,

            {

                astronautId: person.id,

                astronautName: person.name,

                title: "Health Warning",

                message,

                category: "warning",

                type: "health-warning",

                section: "health"

            },

            message

        )) {

            changed = true;

        }

        return changed;

    }


    // ==================================================
    // 13. ПЕРЕВІРКА СТАНУ ПРИСТРОЮ
    // ==================================================

    function syncDevice(person) {

        const preferences =

            person.settings?.notifications || {};

        let changed = false;

        const connectionKey =

            `device-connection:${person.id}`;

        const previousConnection =

            state.activeEvents[connectionKey]?.signature;


        // ==========================================
        // ВТРАТА АБО ВІДНОВЛЕННЯ ЗВ'ЯЗКУ
        // ==========================================

        if (typeof person.connected === "boolean") {

            const connection = person.connected

                ? "connected"

                : "disconnected";

            // Перший запис лише фіксує стан.

            if (previousConnection !== connection) {

                if (

                    previousConnection &&

                    preferences.device !== false

                ) {

                    insertNotification({

                        astronautId: person.id,

                        astronautName: person.name,

                        title: person.connected

                            ? "Device Reconnected"

                            : "Device Connection Lost",

                        message: person.connected

                            ? "Connection to the wearable device has been restored."

                            : "Connection to the wearable device has been lost.",

                        category: "device",

                        type: person.connected

                            ? "device-reconnected"

                            : "device-disconnected",

                        section: "health"

                    });

                }

                state.activeEvents[connectionKey] = {

                    signature: connection

                };

                changed = true;

            }

        }


        // ==========================================
        // НИЗЬКИЙ ЗАРЯД БРАСЛЕТА
        // ==========================================

        const validBattery =

            Number.isFinite(person.battery) &&

            person.battery >= 0 &&

            person.battery <= 100;

        if (person.connected === true && validBattery) {

            const lowBattery =

                person.battery <= LOW_BATTERY_THRESHOLD &&

                preferences.battery !== false;

            if (trackEvent(

                `battery:${person.id}`,

                lowBattery,

                {

                    astronautId: person.id,

                    astronautName: person.name,

                    title: "Device Battery Alert",

                    message:

                        `Wearable battery level is ${person.battery}%.` +

                        " Check device power availability.",

                    category: "device",

                    type: "battery-low",

                    section: "health"

                },

                "low-battery"

            )) {

                changed = true;

            }

        }

        return changed;

    }


    // ==================================================
    // 14. ПЕРЕВІРКА SOS
    // ==================================================

    function syncSos(person) {

        const records = readStorage(

            SOS_STORAGE_KEY,

            {}

        );

        const record = records?.[String(person.id)];

        const active = record?.active === true;

        // SOS не залежить від персональних налаштувань

        return trackEvent(

            `sos:${person.id}`,

            active,

            {

                astronautId: person.id,

                astronautName: person.name,

                title: "SOS Activated",

                message:

                    "Emergency assistance requested. " +

                    "Local demonstration signal only.",

                category: "critical",

                type: "sos",

                section: "health",

                timestamp: record?.timestamp

            },

            record?.timestamp || "active"

        );

    }


    // ==================================================
    // 15. ПЕРЕВІРКА AI HEALTH INSIGHTS
    // ==================================================

    function syncInsights(person, now = Date.now()) {

        // Перевірка наявності модуля

        if (

            typeof window.PulsarInsights?.analyzeHealth

                !== "function"

        ) {

            return false;

        }

        const preferences =

            person.settings?.notifications || {};

        let analysis;

        try {

            analysis = window.PulsarInsights.analyzeHealth(

                person,

                now

            );

        } catch (error) {

            console.error(

                "Cannot analyze health trends:",

                error

            );

            return false;

        }


        // Вимкнення додаткових попереджень

        if (preferences.health === false) {

            return trackEvent(

                `insights:${person.id}`,

                false

            );

        }


        // Недостатньо даних

        if (analysis.status === "Insufficient Data") {

            return false;

        }


        // Несприятливі тенденції

        const flagged = Array.isArray(analysis.flagged)

            ? analysis.flagged

            : [];

        const combined =

            analysis.status === "Attention Required";

        const early =

            analysis.status === "Early Changes";

        const active = combined || early;

        const names = flagged.map(

            item => item.name

        ).join(", ");


        // Підпис події для захисту від повторів

        const signature = analysis.status +

            ":" +

            flagged.map(item => item.key)

                .sort()

                .join(",");

        return trackEvent(

            `insights:${person.id}`,

            active,

            {

                astronautId: person.id,

                astronautName: person.name,

                title: combined

                    ? "Combined Health Trends Detected"

                    : "Early Health Trend Detected",

                message: names

                    ? "Indicators: " + names + ". " +

                        "Review historical measurements."

                    : "An unfavorable trend rule has been triggered.",

                category: "warning",

                type: "health-insights",

                section: "insights"

            },

            signature

        );

    }


    // ==================================================
    // 16. ЩОДЕННІ НАГАДУВАННЯ
    // ==================================================

    function syncReminders(person, now = new Date()) {

        const reminders =

            person.settings?.reminders || {};

        const today = localDate(now);

        const time = localTime(now);

        let changed = false;


        // ==========================================
        // DAILY CHECK-IN
        // ==========================================

        const checkinHistory = Array.isArray(

            person.checkinHistory

        )

            ? [...person.checkinHistory]

            : [];

        if (person.checkin) {

            checkinHistory.push(person.checkin);

        }

        // Перевірка, чи є запис за сьогодні

        const completedCheckin = checkinHistory.some(

            item => item?.date &&

                localDate(item.date) === today

        );

        if (

            reminders.checkinEnabled === true &&

            isValidTime(reminders.checkinTime) &&

            time >= reminders.checkinTime &&

            !completedCheckin

        ) {

            const notification = insertNotification({

                astronautId: person.id,

                astronautName: person.name,

                title: "Daily Check-in Reminder",

                message:

                    "The scheduled daily well-being " +

                    "check-in is due.",

                category: "reminder",

                type: "checkin-reminder",

                section: "health",

                dedupeKey:

                    `checkin:${person.id}:${today}`

            });

            if (notification) {

                changed = true;

            }

        }


        // ==========================================
        // HEALTH MEASUREMENTS
        // ==========================================

        if (

            reminders.measurementEnabled === true &&

            isValidTime(reminders.measurementTime) &&

            time >= reminders.measurementTime

        ) {

            const notification = insertNotification({

                astronautId: person.id,

                astronautName: person.name,

                title: "Health Measurements Reminder",

                message:

                    "Scheduled additional health measurements " +

                    "are due. Follow the approved measurement plan.",

                category: "reminder",

                type: "measurement-reminder",

                section: "health",

                dedupeKey:

                    `measurement:${person.id}:${today}`

            });

            if (notification) {

                changed = true;

            }

        }

        return changed;

    }


    // ==================================================
    // 17. НАГАДУВАННЯ ПРО МЕДИЧНИЙ ОГЛЯД
    // ==================================================

    function syncMedicalExamination(

        person,

        now = new Date()

    ) {

        const nextExam =

            person.medicalCard?.assessment?.nextExam;

        const today = localDate(now);

        if (

            !isValidDate(nextExam) ||

            today < nextExam

        ) {

            return false;

        }

        const notification = insertNotification({

            astronautId: person.id,

            astronautName: person.name,

            title: "Medical Examination Reminder",

            message:

                `Scheduled medical examination: ${nextExam}. ` +

                "Review the medical examination schedule.",

            category: "reminder",

            type: "medical-examination",

            section: "settings",

            dedupeKey:

                `medical-exam:${person.id}:${nextExam}`

        });

        return Boolean(notification);

    }


    // ==================================================
    // 18. ПЕРЕВІРКА ВСЬОГО ЕКІПАЖУ
    // ==================================================

    function syncCrew(people = getCrew()) {

        if (!Array.isArray(people)) {

            return;

        }

        let changed = false;

        const now = new Date();

        people.forEach(person => {

            if (!person || person.id == null) {

                return;

            }

            // Стан здоров'я

            if (syncHealth(person)) {

                changed = true;

            }

            // Стан пристроїв

            if (syncDevice(person)) {

                changed = true;

            }

            // SOS

            if (syncSos(person)) {

                changed = true;

            }

            // Аналіз тенденцій здоров'я

            if (syncInsights(person, now.getTime())) {

                changed = true;

            }

            // Щоденні нагадування

            if (syncReminders(person, now)) {

                changed = true;

            }

            // Медичні огляди

            if (syncMedicalExamination(person, now)) {

                changed = true;

            }

        });

        // Оновлення сховища та інтерфейсу

        if (changed) {

            publishChanges();

        } else {

            renderNotifications();

        }

    }


    // ==================================================
    // 19. ФОРМАТУВАННЯ ЧАСУ
    // ==================================================

    function formatNotificationTime(timestamp) {

        const date = new Date(timestamp);

        if (!Number.isFinite(date.getTime())) {

            return "Time unavailable";

        }

        const elapsed = Math.max(

            0,

            Date.now() - date.getTime()

        );

        const minutes = Math.floor(

            elapsed / 60000

        );

        if (minutes < 1) {

            return "Just now";

        }

        if (minutes < 60) {

            return minutes === 1

                ? "1 minute ago"

                : `${minutes} minutes ago`;

        }

        const hours = Math.floor(minutes / 60);

        if (hours < 24) {

            return hours === 1

                ? "1 hour ago"

                : `${hours} hours ago`;

        }

        const days = Math.floor(hours / 24);

        if (days < 7) {

            return days === 1

                ? "1 day ago"

                : `${days} days ago`;

        }

        return date.toLocaleString("en-GB", {

            day: "2-digit",

            month: "short",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit"

        });

    }


    // ==================================================
    // 20. ІКОНКИ СПОВІЩЕНЬ
    // ==================================================

    function getNotificationIcon(type) {

        const icons = {

            "health-critical": "!",

            "health-warning": "♡",

            "health-insights": "✧",

            // Спільний аналіз середовища

            "shared-environmental-risk": "⌘",

            "sos": "SOS",

            "battery-low": "▱",

            "device-disconnected": "◎",

            "device-reconnected": "✓",

            "checkin-reminder": "◷",

            "measurement-reminder": "▥",

            "medical-examination": "✚",

            "general": "ⓘ"

        };

        return Object.hasOwn(icons, type)

            ? icons[type]

            : "ⓘ";

    }


    // ==================================================
    // 21. ФІЛЬТРАЦІЯ СПОВІЩЕНЬ
    // ==================================================

    function getFilteredNotifications() {

        let items = [...state.notifications];

        // Усі повідомлення

        if (currentFilter === "all") {

            // Залишаємо весь список

        }

        // Непрочитані

        else if (currentFilter === "unread") {

            items = items.filter(item =>

                !item.read

            );

        }

        // Фільтрація за категоріями

        else {

            items = items.filter(item =>

                item.category === currentFilter ||

                (

                    currentFilter === "warning" &&

                    item.category === "environmental"

                )

            );

        }

        // Сортування:
        // непрочитані, пріоритет, дата створення

        return items.sort((a, b) => {

            if (a.read !== b.read) {

                return Number(a.read) -

                    Number(b.read);

            }

            const priorityDifference =

                (priorities[a.category] ?? 4) -

                (priorities[b.category] ?? 4);

            if (priorityDifference !== 0) {

                return priorityDifference;

            }

            return (

                Date.parse(b.timestamp) || 0

            ) - (

                Date.parse(a.timestamp) || 0

            );

        });

    }


    // ==================================================
    // 22. СТВОРЕННЯ КАРТКИ СПОВІЩЕННЯ
    // ==================================================

    function createNotificationCard(item) {

        const category = Object.hasOwn(

            priorities,

            item.category

        )

            ? item.category

            : "info";

        const categoryName = {

            critical: "Critical",

            warning: "Warning",

            environmental: "Environmental Warning",

            device: "Device",

            reminder: "Reminder",

            info: "Information"

        }[category];

        return `

            <article class="notification-item

                ${category === "environmental"

                    ? "warning environmental"

                    : category}

                ${item.read ? "is-read" : "is-unread"}">


                <!-- ІКОНКА -->

                <div class="notification-item-icon"
                     aria-hidden="true">

                    ${escapeHTML(

                        getNotificationIcon(item.type)

                    )}

                </div>


                <!-- ОСНОВНИЙ ВМІСТ -->

                <div class="notification-item-content">


                    <!-- КАТЕГОРІЯ -->

                    <div class="notification-item-top">

                        <span class="notification-category">

                            ${categoryName}

                        </span>

                        ${!item.read ? `

                            <span class="notification-unread-dot"
                                  aria-label="Unread">

                            </span>

                        ` : ""}

                    </div>


                    <!-- ЗАГОЛОВОК -->

                    <h4>

                        ${escapeHTML(item.title)}

                    </h4>


                    <!-- АСТРОНАВТ АБО КОСМІЧНИЙ МОДУЛЬ -->

                    <strong class="notification-person">

                        ${escapeHTML(item.astronautName)}

                    </strong>


                    <!-- ПОВІДОМЛЕННЯ -->

                    <p class="notification-message">

                        ${escapeHTML(item.message)}

                    </p>


                    <!-- ЧАС СТВОРЕННЯ -->

                    <time class="notification-time"
                          datetime="${escapeHTML(item.timestamp)}">

                        ${escapeHTML(

                            formatNotificationTime(item.timestamp)

                        )}

                    </time>


                    <!-- КНОПКИ -->

                    <div class="notification-item-actions">

                        ${

                            item.astronautId != null ||

                            item.target === "crew-analysis"

                                ? `

                            <button

                                type="button"

                                class="notification-view-button"

                                data-notification-action="view"

                                data-notification-id="${escapeHTML(item.id)}">

                                ${item.target === "crew-analysis"

                                    ? "View Crew Analysis →"

                                    : "View Details →"}

                            </button>

                        ` : ""}


                        ${!item.read ? `

                            <button

                                type="button"

                                class="notification-read-button"

                                data-notification-action="read"

                                data-notification-id="${escapeHTML(item.id)}">

                                ✓ Mark as read

                            </button>

                        ` : `

                            <span class="notification-read-label">

                                ✓ Read

                            </span>

                        `}

                    </div>

                </div>

            </article>

        `;

    }


    // ==================================================
    // 23. ОНОВЛЕННЯ ЛІЧИЛЬНИКІВ
    // ==================================================

    function updateCounters() {

        const all = state.notifications;

        const unread = all.filter(

            item => !item.read

        ).length;

        // Усі критичні повідомлення в історії

        const critical = all.filter(

            item => item.category === "critical"

        ).length;


        // Лічильник на дзвіночку

        const badge = document.getElementById(

            "notification-badge"

        );

        if (badge) {

            badge.hidden = unread === 0;

            badge.textContent = unread > 99

                ? "99+"

                : String(unread);

        }

        // Допоміжна функція

        function setText(id, value) {

            const element = document.getElementById(id);

            if (element) {

                element.textContent = value;

            }

        }

        setText(

            "notification-total",

            all.length

        );

        setText(

            "notification-unread",

            unread

        );

        setText(

            "notification-critical",

            critical

        );

        setText(

            "notification-unread-count",

            unread === 1

                ? "1 unread notification"

                : `${unread} unread notifications`

        );


        // Доступність кнопки дзвіночка

        const toggle = document.getElementById(

            "notification-toggle"

        );

        if (toggle) {

            toggle.setAttribute(

                "aria-label",

                `Notifications, ${unread} unread`

            );

        }


        // Кнопка прочитання всіх повідомлень

        const markAll = document.getElementById(

            "notification-mark-all"

        );

        if (markAll) {

            markAll.disabled = unread === 0;

        }


        // Повідомлення про помилку сховища

        const footer = document.querySelector(

            ".notification-footer > span:first-child"

        );

        if (footer) {

            footer.textContent = storageError

                ? "Demo storage unavailable"

                : "Crew Notification Center";

        }

    }


    // ==================================================
    // 24. ВІДОБРАЖЕННЯ ЦЕНТРУ СПОВІЩЕНЬ
    // ==================================================

    function renderNotifications() {

        updateCounters();

        const list = document.getElementById(

            "notification-list"

        );

        if (!list) {

            return;

        }


        // Активний фільтр

        document.querySelectorAll(

            ".notification-filter"

        ).forEach(button => {

            const active =

                button.dataset.notificationFilter ===

                currentFilter;

            button.classList.toggle(

                "active",

                active

            );

            button.setAttribute(

                "aria-pressed",

                String(active)

            );

        });


        // Відфільтрований список

        const notifications = getFilteredNotifications();


        // Відсутність повідомлень

        if (!notifications.length) {

            const message = currentFilter === "unread"

                ? "You have no unread notifications."

                : "No notifications match this filter.";

            list.innerHTML = `

                <div class="notification-empty">

                    <span aria-hidden="true">✓</span>

                    <h4>No notifications</h4>

                    <p>

                        ${escapeHTML(message)}

                    </p>

                </div>

            `;

            return;

        }


        // Збереження позиції прокручування

        const scrollPosition = list.scrollTop;

        list.innerHTML = notifications.map(

            createNotificationCard

        ).join("");

        list.scrollTop = scrollPosition;

    }


    // ==================================================
    // 25. ВІДКРИТТЯ ПАНЕЛІ
    // ==================================================

    function openPanel() {

        const panel = document.getElementById(

            "notification-panel"

        );

        const toggle = document.getElementById(

            "notification-toggle"

        );

        if (!panel || !toggle) {

            return;

        }


        // Закриваємо інші випадаючі панелі

        [

            ["crew-menu", "menu-toggle"],

            ["search-panel", "search-toggle"]

        ].forEach(([panelId, buttonId]) => {

            const otherPanel =

                document.getElementById(panelId);

            const otherButton =

                document.getElementById(buttonId);

            if (otherPanel && !otherPanel.hidden) {

                if (otherButton) {

                    otherButton.click();

                }

            }

        });


        // Перевіряємо нові події

        syncCrew();


        // Відкриваємо панель

        panel.hidden = false;

        toggle.setAttribute(

            "aria-expanded",

            "true"

        );

        toggle.classList.add("active");

    }


    // ==================================================
    // 26. ЗАКРИТТЯ ПАНЕЛІ
    // ==================================================

    function closePanel(restoreFocus = false) {

        const panel = document.getElementById(

            "notification-panel"

        );

        const toggle = document.getElementById(

            "notification-toggle"

        );

        if (!panel || !toggle) {

            return;

        }

        panel.hidden = true;

        toggle.setAttribute(

            "aria-expanded",

            "false"

        );

        toggle.classList.remove("active");

        if (restoreFocus) {

            toggle.focus();

        }

    }


    // ==================================================
    // 27. ПЕРЕХІД ЗІ СПОВІЩЕННЯ
    // ==================================================

    function openNotification(id) {

        const item = state.notifications.find(

            notification => notification.id === id

        );


        // ==========================================
        // CREW ENVIRONMENTAL ANALYSIS
        // ==========================================

        if (item?.target === "crew-analysis") {

            // Позначаємо повідомлення як прочитане

            markAsRead(id);


            // Визначаємо розташування сторінки

            const insidePages =

                /\/pages\/[^/]+$/.test(

                    window.location.pathname

                );


            // Формуємо правильний шлях

            const url = new URL(

                insidePages

                    ? "crew-analysis.html"

                    : "pages/crew-analysis.html",

                window.location.href

            );


            // Відкриття аналізу збережених даних

            url.searchParams.set(

                "source",

                "actual"

            );


            // Перехід на сторінку спільного аналізу

            window.location.href = url.href;

            return;

        }


        // ==========================================
        // ІНДИВІДУАЛЬНИЙ ПРОФІЛЬ АСТРОНАВТА
        // ==========================================

        if (!item || item.astronautId == null) {

            return;

        }

        const person = getCrew().find(

            astronaut =>

                String(astronaut.id) ===

                String(item.astronautId)

        );

        if (!person) {

            alert("Astronaut profile is unavailable.");

            return;

        }


        // Зберігаємо дані перед переходом

        if (typeof saveCrew === "function") {

            if (!saveCrew()) {

                alert("Demo crew storage is unavailable.");

                return;

            }

        } else {

            try {

                sessionStorage.setItem(

                    CREW_STORAGE_KEY,

                    JSON.stringify(getCrew())

                );

            } catch (error) {

                alert("Demo crew storage is unavailable.");

                return;

            }

        }


        // Визначаємо розділ профілю

        const section = validSections.includes(

            item.section

        )

            ? item.section

            : "health";


        // Позначаємо повідомлення як прочитане

        markAsRead(id);


        // Визначаємо шлях до профілю

        const insidePages =

            window.location.pathname.endsWith(

                "/pages/astronaut.html"

            );

        const profilePath = insidePages

            ? "astronaut.html"

            : "pages/astronaut.html";


        // Формування адреси

        const url = new URL(

            profilePath,

            window.location.href

        );

        url.searchParams.set(

            "id",

            person.id

        );

        url.searchParams.set(

            "section",

            section

        );


        // Перехід до профілю

        window.location.href = url.href;

    }


    // ==================================================
    // 28. ОБРОБНИКИ ПОДІЙ
    // ==================================================

    function initializeUI() {

        if (uiInitialized) {

            return;

        }

        const toggle = document.getElementById(

            "notification-toggle"

        );

        const panel = document.getElementById(

            "notification-panel"

        );

        const close = document.getElementById(

            "notification-close"

        );

        const list = document.getElementById(

            "notification-list"

        );

        const markAll = document.getElementById(

            "notification-mark-all"

        );

        if (!toggle || !panel || !list) {

            return;

        }

        uiInitialized = true;


        // ==========================================
        // НОВИЙ ФІЛЬТР ENVIRONMENT
        // ==========================================

        // Створюємо кнопку автоматично.
        // Не потрібно повторно змінювати index.html.

        const filters = panel.querySelector(

            ".notification-filters"

        );

        if (

            filters &&

            !filters.querySelector(

                '[data-notification-filter="environmental"]'

            )

        ) {

            const button = document.createElement("button");

            button.type = "button";

            button.className = "notification-filter";

            button.dataset.notificationFilter =

                "environmental";

            button.setAttribute(

                "aria-pressed",

                "false"

            );

            button.textContent = "Environment";

            filters.appendChild(button);

        }


        // ==========================================
        // НАТИСКАННЯ НА ДЗВІНОЧОК
        // ==========================================

        toggle.addEventListener("click", () => {

            if (panel.hidden) {

                openPanel();

            } else {

                closePanel();

            }

        });


        // ==========================================
        // КНОПКА ЗАКРИТТЯ
        // ==========================================

        close?.addEventListener("click", () => {

            closePanel(true);

        });


        // ==========================================
        // ФІЛЬТРИ
        // ==========================================

        document.querySelectorAll(

            ".notification-filter"

        ).forEach(button => {

            button.addEventListener("click", () => {

                currentFilter =

                    button.dataset.notificationFilter;

                list.scrollTop = 0;

                renderNotifications();

            });

        });


        // ==========================================
        // ПРОЧИТАННЯ ВСІХ ПОВІДОМЛЕНЬ
        // ==========================================

        markAll?.addEventListener(

            "click",

            markAllAsRead

        );


        // ==========================================
        // ДІЇ ВСЕРЕДИНІ СПИСКУ
        // ==========================================

        list.addEventListener("click", event => {

            const button = event.target.closest(

                "[data-notification-action]"

            );

            if (!button || !list.contains(button)) {

                return;

            }

            const id =

                button.dataset.notificationId;

            const action =

                button.dataset.notificationAction;

            if (action === "read") {

                markAsRead(id);

            }

            if (action === "view") {

                openNotification(id);

            }

        });


        // ==========================================
        // ЗАКРИТТЯ ПРИ НАТИСКАННІ ПОЗА ПАНЕЛЛЮ
        // ==========================================

        document.addEventListener("click", event => {

            if (

                !panel.hidden &&

                !panel.contains(event.target) &&

                !toggle.contains(event.target)

            ) {

                closePanel();

            }

        });


        // ==========================================
        // ЗАКРИТТЯ КЛАВІШЕЮ ESCAPE
        // ==========================================

        document.addEventListener("keydown", event => {

            if (

                event.key === "Escape" &&

                !panel.hidden

            ) {

                closePanel(true);

            }

        });

    }


    // ==================================================
    // 29. АВТОМАТИЧНЕ ОНОВЛЕННЯ
    // ==================================================

    // Подія активації або скасування SOS

    document.addEventListener(

        "pulsar:sos-change",

        () => {

            syncCrew();

        }

    );


    // Подія оновлення даних екіпажу

    document.addEventListener(

        "pulsar:crew-change",

        event => {

            const people = event.detail?.crew;

            syncCrew(

                Array.isArray(people)

                    ? people

                    : getCrew()

            );

        }

    );


    // Оновлення після повернення через Back

    window.addEventListener("pageshow", () => {

        if (!storageError) {

            state = loadState();

        }

        syncCrew();

    });


    // Оновлення при поверненні до вкладки

    document.addEventListener(

        "visibilitychange",

        () => {

            if (document.visibilityState === "visible") {

                syncCrew();

            }

        }

    );


    // ==================================================
    // 30. ПІДКЛЮЧЕННЯ ДО ІНШИХ МОДУЛІВ
    // ==================================================

    async function pullFromServer() {
        if (!window.PulsarLive?.fetchNotifications) return;
        try {
            const list = await window.PulsarLive.fetchNotifications();
            if (!Array.isArray(list)) return;
            state.notifications = list.map((item) => ({
                id: item.id,
                type: item.type || item.priority || "info",
                title: item.title,
                message: item.body || item.message || "",
                body: item.body || item.message || "",
                astronautId: item.astronautId || item.deviceId || null,
                section: item.section || null,
                read: !!item.read,
                createdAt: item.createdAt || new Date().toISOString(),
                timestamp: item.createdAt || new Date().toISOString(),
            }));
            saveState();
            renderNotifications?.();
        } catch (err) {
            console.warn("[notifications] pull", err);
        }
    }

    async function pushNotificationToServer(data) {
        if (!window.PulsarLive?.postNotification) return;
        try {
            await window.PulsarLive.postNotification({
                id: data.id,
                type: data.type,
                priority: data.type,
                title: data.title,
                body: data.message || data.body || "",
                astronautId: data.astronautId,
                deviceId: data.astronautId,
                section: data.section,
                read: !!data.read,
                createdAt: data.createdAt || data.timestamp,
                source: "ui",
            });
        } catch (err) {
            console.warn("[notifications] push", err);
        }
    }

    document.addEventListener("pulsar:notifications-change", () => {
        pullFromServer();
    });

    setTimeout(pullFromServer, 800);
    setInterval(pullFromServer, 30000);

    function addNotificationAndSync(data) {
        const row = addNotification(data);
        pushNotificationToServer(row || data);
        return row;
    }

    const _markAsRead = markAsRead;
    function markAsReadAndSync(id) {
        const result = _markAsRead(id);
        if (window.PulsarLive?.patchNotification) {
            window.PulsarLive.patchNotification(id, { read: true }).catch(() => {});
        }
        return result;
    }

    const _markAllAsRead = markAllAsRead;
    function markAllAsReadAndSync() {
        const result = _markAllAsRead();
        if (window.PulsarLive?.markAllNotificationsRead) {
            window.PulsarLive.markAllNotificationsRead().catch(() => {});
        }
        return result;
    }

    window.PulsarNotifications = Object.freeze({
        pullFromServer,

        addNotification: addNotificationAndSync,

        // НОВЕ:
        // інтеграція спільного аналізу середовища

        syncEnvironmentalAnalysis,

        getNotifications,

        markAsRead: markAsReadAndSync,

        markAllAsRead: markAllAsReadAndSync,

        syncCrew,

        renderNotifications,

        openPanel,

        closePanel

    });


    // ==================================================
    // 31. ПОЧАТКОВИЙ ЗАПУСК
    // ==================================================

    function initialize() {

        initializeUI();

        syncCrew();


        // Перевіряємо події раз на хвилину,
        // поки сторінка відкрита.
        //
        // Це не фонова серверна система.

        window.setInterval(() => {

            if (document.visibilityState === "visible") {

                syncCrew();

            }

        }, CHECK_INTERVAL);

    }


    // Очікуємо завантаження HTML та інших скриптів

    if (document.readyState === "loading") {

        document.addEventListener(

            "DOMContentLoaded",

            initialize,

            { once: true }

        );

    } else {

        initialize();

    }

    // ==================================================
    // КІНЕЦЬ NOTIFICATION CENTER
    // ==================================================

})();
