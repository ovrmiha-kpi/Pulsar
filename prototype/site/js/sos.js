
// ==================================================
// PULSAR — SOS SYSTEM
// СИСТЕМА ЕКСТРЕНОЇ ДОПОМОГИ
// ==================================================


// Live SOS через prototype/server (PulsarLive.postSos)

const SOS_DEMO_MODE = false;

const SOS_STORAGE_KEY = "pulsar_sos_local";


// ==================================================
// ОТРИМАННЯ СТАНІВ SOS
// ==================================================

function getSosRecords() {

    const records = JSON.parse(

        sessionStorage.getItem(SOS_STORAGE_KEY) || "{}"

    );

    return records &&

        typeof records === "object" &&

        !Array.isArray(records)

        ? records

        : {};

}


// ==================================================
// ПЕРЕВІРКА АКТИВНОГО SOS
// ==================================================

function isSosActive(id) {

    try {

        return getSosRecords()[String(id)]?.active === true;

    } catch (error) {

        console.error(

            "Cannot read SOS state:",

            error

        );

        return false;

    }

}


// ==================================================
// ЗБЕРЕЖЕННЯ СТАНУ SOS
// ==================================================

function saveSosRecord(id, record) {

    const records = getSosRecords();

    records[String(id)] = record;

    sessionStorage.setItem(

        SOS_STORAGE_KEY,

        JSON.stringify(records)

    );

}


// ==================================================
// БЕЗПЕЧНЕ ВІДОБРАЖЕННЯ ТЕКСТУ
// ==================================================

function escapeSosText(value) {

    return String(value ?? "—")

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#39;");

}


// ==================================================
// ОНОВЛЕННЯ ІНТЕРФЕЙСУ ТА NOTIFICATION CENTER
// ==================================================

function notifySosChange(id, active, timestamp = null) {

    document.dispatchEvent(

        new CustomEvent("pulsar:sos-change", {

            detail: {

                astronautId: id,

                active,

                timestamp,

                mode: SOS_DEMO_MODE ? "demo" : "live"

            }

        })

    );

}


// ==================================================
// АКТИВАЦІЯ SOS
// ==================================================

async function activateSos(person) {

    if (!person || person.id == null) {
        throw new Error("Invalid astronaut.");
    }

    if (isSosActive(person.id) || person.sos) {
        return;
    }

    const timestamp = new Date().toISOString();

    if (window.PulsarLive?.postSos) {
        await window.PulsarLive.postSos(person.id);
        saveSosRecord(person.id, {
            active: true,
            timestamp,
            mode: "live",
        });
        notifySosChange(person.id, true, timestamp);
        return;
    }

    if (!SOS_DEMO_MODE) {
        throw new Error("SOS API is not connected. Start prototype/server.");
    }

    saveSosRecord(person.id, {
        active: true,
        timestamp,
        mode: "demo",
    });

    notifySosChange(person.id, true, timestamp);

}


// ==================================================
// СКИДАННЯ СИМУЛЯЦІЇ SOS
// ==================================================

function resetDemoSos(id) {

    if (!SOS_DEMO_MODE) {

        return;

    }


    // Отримання поточних записів

    const records = getSosRecords();


    // Видалення активного стану SOS

    delete records[String(id)];


    // Збереження оновленого стану

    sessionStorage.setItem(

        SOS_STORAGE_KEY,

        JSON.stringify(records)

    );


    // ==============================================
    // ОНОВЛЕННЯ ІНТЕРФЕЙСУ
    // ==============================================

    // Активний стан SOS знімається.
    // Попереднє сповіщення залишається в історії.

    notifySosChange(

        id,

        false,

        new Date().toISOString()

    );

}


// ==================================================
// МОДАЛЬНЕ ВІКНО SOS
// ==================================================

function openSosDialog(person) {

    // Перевірка наявності астронавта
    // та відкритого модального вікна

    if (

        !person ||

        person.id == null ||

        document.getElementById("sos-modal")

    ) {

        return;

    }


    // Закриваємо центр сповіщень, якщо він відкритий

    window.PulsarNotifications?.closePanel();


    // ==============================================
    // СТВОРЕННЯ МОДАЛЬНОГО ВІКНА
    // ==============================================

    const dialog = document.createElement("dialog");

    dialog.id = "sos-modal";

    dialog.className = "sos-modal";

    dialog.setAttribute(

        "aria-labelledby",

        "sos-modal-title"

    );


    // Поточний стан SOS

    const active = isSosActive(person.id);


    // ==============================================
    // ВМІСТ МОДАЛЬНОГО ВІКНА
    // ==============================================

    dialog.innerHTML = `

        <div class="sos-modal-content">


            <!-- ЗАГОЛОВОК -->

            <div class="sos-modal-header">

                <span class="sos-modal-icon"
                      aria-hidden="true">

                    ⚠

                </span>

                <h2 id="sos-modal-title">

                    ${active

                        ? "SOS Active"

                        : "Activate SOS?"}

                </h2>

                <button type="button"
                        class="sos-modal-close"
                        aria-label="Close">

                    &times;

                </button>

            </div>


            <!-- ==================================
                 ІНФОРМАЦІЯ ПРО АСТРОНАВТА
            =================================== -->

            <div class="sos-person">

                <strong>

                    ${escapeSosText(person.name)}

                </strong>

                <span>

                    ${escapeSosText(person.role)}

                    · AST-${escapeSosText(

                        String(person.id).padStart(3, "0")

                    )}

                </span>

            </div>


            <!-- ==================================
                 ОПИС ПОТОЧНОГО СТАНУ
            =================================== -->

            <p class="sos-modal-description">

                ${active

                    ? "An SOS simulation is already active for this astronaut."

                    : "Confirm to request emergency assistance for this astronaut."}

            </p>


            <!-- ==================================
                 ОДЕРЖУВАЧІ СИГНАЛУ
            =================================== -->

            <div class="sos-recipient-info">

                <span aria-hidden="true">◎</span>

                <div>

                    <strong>Crew-wide alert</strong>

                    <p>

                        Intended recipients:

                        all other connected crew bracelets.

                    </p>

                </div>

            </div>


            <!-- ==================================
                 ДЕМОНСТРАЦІЙНИЙ РЕЖИМ
            =================================== -->

            <div class="sos-demo-notice">

                DEMO MODE

                <p>

                    No real emergency notifications

                    will be sent.

                </p>

            </div>


            <!-- ==================================
                 РЕЗУЛЬТАТ АКТИВАЦІЇ
            =================================== -->

            <p id="sos-result"
               class="sos-result"
               role="status">

            </p>


            <!-- ==================================
                 КНОПКИ МОДАЛЬНОГО ВІКНА
            =================================== -->

            <div class="sos-modal-actions">

                <button type="button"
                        class="sos-cancel-button">

                    ${active ? "Close" : "Cancel"}

                </button>


                ${active ? `

                    <button type="button"
                            class="sos-reset-button">

                        Reset Simulation

                    </button>

                ` : `

                    <button type="button"
                            class="sos-confirm-button">

                        Confirm SOS

                    </button>

                `}

            </div>

        </div>

    `;


    // Додаємо модальне вікно до сторінки

    document.body.appendChild(dialog);


    // ==============================================
    // HTML-ЕЛЕМЕНТИ
    // ==============================================

    const result =

        dialog.querySelector("#sos-result");

    const confirm =

        dialog.querySelector(".sos-confirm-button");

    const cancel =

        dialog.querySelector(".sos-cancel-button");

    const close =

        dialog.querySelector(".sos-modal-close");

    const reset =

        dialog.querySelector(".sos-reset-button");


    // Ознака обробки запиту

    let processing = false;


    // ==============================================
    // ЗАКРИТТЯ МОДАЛЬНОГО ВІКНА
    // ==============================================

    function closeDialog() {

        if (!processing) {

            dialog.close();

        }

    }


    // Кнопка Cancel / Close

    cancel.addEventListener(

        "click",

        closeDialog

    );


    // Кнопка з хрестиком

    close.addEventListener(

        "click",

        closeDialog

    );


    // Натискання поза вікном

    dialog.addEventListener("click", event => {

        if (event.target === dialog) {

            closeDialog();

        }

    });


    // Закриття клавішею Escape

    dialog.addEventListener("cancel", event => {

        if (processing) {

            event.preventDefault();

        }

    });


    // Видалення закритого модального вікна

    dialog.addEventListener("close", () => {

        dialog.remove();

    });


    // ==============================================
    // ПІДТВЕРДЖЕННЯ АКТИВАЦІЇ SOS
    // ==============================================

    if (confirm) {

        confirm.addEventListener("click", async () => {


            // Захист від повторного натискання

            if (

                processing ||

                isSosActive(person.id)

            ) {

                return;

            }


            // Початок обробки

            processing = true;


            // Тимчасове блокування кнопок

            confirm.disabled = true;

            cancel.disabled = true;

            close.disabled = true;


            // Повідомлення про обробку

            confirm.textContent = "Activating...";

            result.textContent =

                "Processing SOS request...";


            // ======================================
            // АКТИВАЦІЯ
            // ======================================

            try {

                await activateSos(person);


                // Успішна активація локальної симуляції

                result.className = "sos-result success";

                result.textContent =

                    "SOS activated in simulation. " +

                    "No real notifications sent.";


                // Оновлення заголовка

                dialog.querySelector("#sos-modal-title")

                    .textContent = "SOS Activated";


                // Оновлення опису

                dialog.querySelector(

                    ".sos-modal-description"

                ).textContent =

                    "An SOS simulation is active for this astronaut.";


                // Оновлення кнопок

                confirm.textContent = "SOS Active";

                cancel.textContent = "Close";


                // Подія pulsar:sos-change вже була
                // створена всередині activateSos().
                //
                // Повторно її не викликаємо.

            }


            // ======================================
            // ПОМИЛКА АКТИВАЦІЇ
            // ======================================

            catch (error) {

                console.error(

                    "SOS activation error:",

                    error

                );

                result.className = "sos-result error";

                result.textContent =

                    "Unable to activate SOS simulation. " +

                    "Please try again.";

                confirm.textContent = "Retry SOS";

                confirm.disabled = false;

            }


            // ======================================
            // ЗАВЕРШЕННЯ ОБРОБКИ
            // ======================================

            finally {

                processing = false;

                cancel.disabled = false;

                close.disabled = false;

            }

        });

    }


    // ==============================================
    // СКИДАННЯ SOS
    // ==============================================

    if (reset) {

        reset.addEventListener("click", () => {

            try {

                // Скидання локальної симуляції

                resetDemoSos(person.id);


                // Подія оновлення вже створена
                // всередині resetDemoSos().


                // Закриття модального вікна

                dialog.close();

            } catch (error) {

                console.error(

                    "SOS reset error:",

                    error

                );

                result.className = "sos-result error";

                result.textContent =

                    "Unable to reset SOS simulation.";

            }

        });

    }


    // ==============================================
    // ВІДКРИТТЯ МОДАЛЬНОГО ВІКНА
    // ==============================================

    dialog.showModal();

}
