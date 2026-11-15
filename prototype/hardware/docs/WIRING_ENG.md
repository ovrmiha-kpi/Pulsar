# Full wiring — all purchased modules

ESP32 DevKit orientation: **USB at the bottom**.  
You may use **both** pin rows (left and right).  
**Do not flash** firmware until you say so — first check the wires against this table.

**Shared buses**
- **SPI TFT (side 1):** SCK=D18, MOSI=D23, CS=D5, DC=D15, RST=D4
- **SPI microSD (side 2, separate bus):** SCK=D14, MOSI=D13, MISO=D32, CS=D33
- **I²C:** BMP280 + MAX30102 + MPU-6500 → SDA=D21, SCL=D22 (in parallel)

All **GND** go to the shared ESP32 ground.  
**3V3** — 3.3 V only. **VIN/5V** — only modules that need 5 V.

---

## 1) TFT 1.8″ ST7735 (SPI 128×160)

| TFT | ESP32 |
|-----|-------|
| VCC | **3V3** |
| GND | **GND** |
| CS | **D5** |
| RESET | **D4** |
| A0 | **D15** |
| SDA | **D23** |
| SCK | **D18** |
| LED | **3V3** |

---

## 2) microSD (SPI) — **all on side 2** (VIN row, USB at bottom)

Separate bus — **do not** share with TFT. Orientation: USB at bottom → **right** side of the board (VIN / D13 / D14…).

| SD | ESP32 (side 2) |
|----|----------------|
| VCC / 3V3 | **3V3** (if missing on this side — extend from left 3V3) |
| GND | **GND** (next to VIN on the same side) |
| CS | **D33** |
| MOSI / DI | **D13** |
| MISO / DO | **D32** |
| SCK / CLK | **D14** |

Leave D18/D19/D23 alone — they stay TFT-only.  
Insert the card after wiring.

---

## 3) BMP280 (I²C) — T + pressure

| BMP280 | ESP32 |
|--------|-------|
| VCC | **3V3** |
| GND | **GND** |
| SDA | **D21** |
| SCL | **D22** |

Address 0x76 or 0x77.

---

## 4) MAX30102 (I²C) — pulse / SpO2

| MAX30102 | ESP32 |
|----------|-------|
| VIN / VCC | **3V3** |
| GND | **GND** |
| SDA | **D21** |
| SCL | **D22** |
| INT | **do not connect** (pulse is computed in software from IR) |

Finger **firmly** on the glass (red LED should light). Pins soldered.  
Needed only: **3V3, GND, SDA→D21, SCL→D22**. If SpO₂ works but HR does not — software / finger contact, not a “missing INT”.

---

## 5) MPU-6500 (I²C) — IMU

| MPU-6500 | ESP32 |
|----------|-------|
| VCC | **3V3** |
| GND | **GND** |
| SDA | **D21** |
| SCL | **D22** |
| ADO / AD0 | GND (address 0x68) or 3V3 (0x69) — as on the module |
| INT | optional |

---

## 6) MQ-135 — air quality

| MQ-135 | ESP32 |
|--------|-------|
| VCC | **VIN / 5V** (or 3V3 if it already works that way) |
| GND | **GND** |
| A0 | **D2** |
| D0 | do not connect |

---

## 7) HX711 + load cell (weight / grip)

On the DevKit pins are often labeled **RX2 / TX2**, not D16/D17 — same GPIOs:

| HX711 | ESP32 (board label) | GPIO |
|-------|---------------------|------|
| VCC | **VIN** | 5V |
| GND | **GND** | GND |
| DT / DOUT | **RX2** | **16** |
| SCK | **TX2** | **17** |
| E+ E− A+ A− | load cell | — |

---

## 8) Separate pulse sensor (analog) — optional

If the module is KY-039 / “Heart Rate” type:

| Pulse | ESP32 |
|-------|-------|
| VCC | **3V3** |
| GND | **GND** |
| S / Signal | **D34** (left row, ADC) |

If you use only MAX30102 — leave this module unconnected.

---

## 9) Buttons ×3 (tactile **4 pins**, to GND)

Left DevKit row. Mode: **INPUT_PULLUP** (pressed = **LOW**).  
No external resistors needed.

On a 4-pin button, pins come in **side pairs**:
- left pair (1–2) is **always shorted** together;
- right pair (3–4) is **always shorted** together;
- on press, **left ↔ right** connect.

So it behaves like a 2-contact switch: take **one pin from the left** and **one from the right**.

```
      top view (legs down):

        1 ●────────● 4
          │  (button) │     on press: left side ↔ right
        2 ●────────● 3

      wiring (any diagonal, or neighbors from opposite sides):

        ESP32 GPIO ──● 1          4 ●── GND
                     │              │
                   (leave 2 and 3 unused, or duplicate the same wire)
```

In practice: **wire any left leg → GPIO**, **wire any right leg → GND**. The other two legs can stay unused.

| Button | Role (UI logic) | ESP32 (one left pin) | GND (one right pin) |
|--------|-----------------|----------------------|---------------------|
| **BTN1** | Select / OK | **D25** | **GND** |
| **BTN2** | Next / ↓ | **D26** | **GND** |
| **BTN3** | Back / ↑ | **D27** | **GND** |

```
ESP32 D25 ── (BTN1 left side) ── (right side) ── GND
ESP32 D26 ── (BTN2 left side) ── (right side) ── GND
ESP32 D27 ── (BTN3 left side) ── (right side) ── GND
```

**Important:** do not take two pins **from the same side** (1+2 or 3+4) — they are always shorted, GPIO stays forever LOW and buttons “don’t work”.

If Serial shows `D25=0 D26=0 D27=0` constantly — that is this mistake. Use a **diagonal** (1 and 3, or 2 and 4) or one left + one right pin.

---

## ESP32 pin map (what is taken)

| GPIO | Assignment |
|------|------------|
| 3V3 | TFT, SD, BMP, MAX, MPU, TFT LED |
| GND | all (+ buttons) |
| VIN/5V | MQ, HX711 |
| **D2** | MQ A0 |
| **D4** | TFT RESET |
| **D5** | TFT CS |
| **D13** | SD MOSI (side 2) |
| **D14** | SD SCK (side 2) |
| **D15** | TFT A0/DC |
| **RX2 (D16)** | HX711 DT |
| **TX2 (D17)** | HX711 SCK |
| **D18** | TFT SCK |
| **D19** | free (was SD MISO) |
| **D21** | I²C SDA (BMP+MAX+MPU) |
| **D22** | I²C SCL |
| **D23** | TFT MOSI |
| **D25** | BTN1 Select |
| **D26** | BTN2 Next |
| **D27** | BTN3 Back |
| **D32** | SD MISO (side 2) |
| **D33** | SD CS (side 2) |
| **D34** | analog pulse (opt.) |
| RX0/TX0 | USB — do not touch |

---

## Build order (to avoid confusion)

1. TFT  
2. I²C bus: BMP280 → MAX30102 → MPU-6500 (all on 21/22 + 3V3/GND)  
3. MQ-135  
4. microSD  
5. HX711  
6. Buttons BTN1–3 (D25/D26/D27 → GND)  
7. Analog pulse — optional  

## Watch firmware + SD

`prototype/hardware/watch/pulsar_watch/pulsar_watch.ino`  
- **no LINK** (no BT client and no `LINK` from `npm run bt`) → JSON is written to `/pulsar.jsonl` on SD  
- **LINK appears** → dump file over USB/BT and **clear** SD  
SD pins: CS33 SCK14 MOSI13 MISO32 (side 2).
