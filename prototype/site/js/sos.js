// ==============================
// PULSAR — SOS SYSTEM
// ==============================

// Live SOS prototype/server; sessionStorage = UI badge cache
const SOS_DEMO_MODE = false;
const SOS_STORAGE_KEY = "pulsar_sos";


// ==============================
// ОТРИМАННЯ СТАНІВ SOS
// ==============================

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


// Перевірка активного SOS

function isSosActive(id) {

    try {

        return getSosRecords()[String(id)]?.active === true;

    } catch (error) {

        console.error("Cannot read SOS state:", error);

        return false;

    }

}


// Збереження стану SOS

function saveSosRecord(id, record) {

    const records = getSosRecords();

    records[String(id)] = record;

    sessionStorage.setItem(
        SOS_STORAGE_KEY,
        JSON.stringify(records)
    );

}


// Безпечне відображення тексту

function escapeSosText(value) {

    return String(value ?? "—")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

}


// ==============================
// АКТИВАЦІЯ SOS
// ==============================

async function activateSos(person) {

    if (isSosActive(person.id)) {
        return;
    }

    if (!person.connected) {
        throw new Error("Device offline — SOS not delivered.");
    }

    if (window.PulsarLive?.postSos) {
        await window.PulsarLive.postSos(person.id);
    }

    saveSosRecord(person.id, {
        active: true,
        timestamp: new Date().toISOString(),
        mode: "live",
    });
}


// ==============================
// СКИДАННЯ СИМУЛЯЦІЇ
// ==============================

function resetDemoSos(id) {

    if (!SOS_DEMO_MODE) {

        return;

    }

    const records = getSosRecords();

    delete records[String(id)];

    sessionStorage.setItem(
        SOS_STORAGE_KEY,
        JSON.stringify(records)
    );

}


// ==============================
// ОНОВЛЕННЯ ІНТЕРФЕЙСУ
// ==============================

function notifySosChange(id) {

    document.dispatchEvent(

        new CustomEvent("pulsar:sos-change", {

            detail: {
                astronautId: id
            }

        })

    );

}


// ==============================
// МОДАЛЬНЕ ВІКНО SOS
// ==============================

function openSosDialog(person) {

    if (!person || document.getElementById("sos-modal")) {

        return;

    }


    // Створення модального вікна

    const dialog = document.createElement("dialog");

    dialog.id = "sos-modal";

    dialog.className = "sos-modal";

    dialog.setAttribute(
        "aria-labelledby",
        "sos-modal-title"
    );

    const active = isSosActive(person.id);


    // Вміст вікна

    dialog.innerHTML = `

        <div class="sos-modal-content">

            <div class="sos-modal-header">

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


            <!-- Інформація про астронавта -->

            <div class="sos-person">

                <strong>
                    ${escapeSosText(person.name)}
                </strong>

                <span>

                    ${escapeSosText(person.role)}

                    · ${escapeSosText(
                        person.device_no || person.id
                    )}

                </span>

            </div>


            <!-- Опис -->

            <p class="sos-modal-description">

                ${active
                    ? "An SOS is already active for this astronaut."
                    : "Confirm to request emergency assistance for this astronaut."}

            </p>


            <!-- Одержувачі сигналу -->

            <div class="sos-recipient-info">

                <div>

                    <strong>Crew-wide alert</strong>

                    <p>

                        Intended recipients:
                        all other connected crew bracelets.

                    </p>

                </div>

            </div>


            <!-- Режим доставки -->

            <div class="sos-demo-notice">

                ${SOS_DEMO_MODE ? "Demo mode" : "Live"}

                <p>

                    ${SOS_DEMO_MODE
                        ? "No real emergency notifications will be sent."
                        : "The signal is sent to the mission server and pushed to every open crew panel."}

                </p>

            </div>


            <!-- Результат -->

            <p id="sos-result"
               class="sos-result"
               role="status">
            </p>


            <!-- Кнопки -->

            <div class="sos-modal-actions">

                <button type="button"
                        class="sos-cancel-button">

                    ${active ? "Close" : "Cancel"}

                </button>


                ${active ? (SOS_DEMO_MODE ? `

                    <button type="button"
                            class="sos-reset-button">

                        Reset Simulation

                    </button>

                ` : "") : `

                    <button type="button"
                            class="sos-confirm-button">

                        Confirm SOS

                    </button>

                `}

            </div>

        </div>

    `;


    document.body.appendChild(dialog);


    // ==============================
    // HTML-ЕЛЕМЕНТИ
    // ==============================

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

    let processing = false;


    // ==============================
    // ЗАКРИТТЯ ВІКНА
    // ==============================

    function closeDialog() {

        if (!processing) {

            dialog.close();

        }

    }

    cancel.addEventListener("click", closeDialog);

    close.addEventListener("click", closeDialog);

    dialog.addEventListener("click", event => {

        if (event.target === dialog) {

            closeDialog();

        }

    });

    dialog.addEventListener("cancel", event => {

        if (processing) {

            event.preventDefault();

        }

    });

    dialog.addEventListener("close", () => {

        dialog.remove();

    });


    // ==============================
    // ПІДТВЕРДЖЕННЯ SOS
    // ==============================

    if (confirm) {

        confirm.addEventListener("click", async () => {

            if (processing || isSosActive(person.id)) {

                return;

            }

            processing = true;

            confirm.disabled = true;
            cancel.disabled = true;
            close.disabled = true;

            confirm.textContent = "Activating...";

            result.textContent = "Processing SOS request...";


            try {

                await activateSos(person);

                result.className = "sos-result success";

                result.textContent =
                    "SOS activated and delivered to the mission server.";


                dialog.querySelector("#sos-modal-title")
                    .textContent = "SOS Activated";

                confirm.textContent = "SOS Active";

                cancel.textContent = "Close";

                notifySosChange(person.id);

            } catch (error) {

                console.error("SOS activation error:", error);

                result.className = "sos-result error";

                result.textContent =
                    (error && error.message) ||
                    "Unable to activate SOS. Please try again.";

                confirm.textContent = "Retry SOS";

                confirm.disabled = false;

            } finally {

                processing = false;

                cancel.disabled = false;

                close.disabled = false;

            }

        });

    }


    // ==============================
    // СКИДАННЯ SOS
    // ==============================

    if (reset) {

        reset.addEventListener("click", () => {

            try {

                resetDemoSos(person.id);

                notifySosChange(person.id);

                dialog.close();

            } catch (error) {

                result.className = "sos-result error";

                result.textContent =
                    "Unable to reset SOS simulation.";

            }

        });

    }


    dialog.showModal();

}