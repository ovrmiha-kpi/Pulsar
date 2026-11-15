# PULSAR SCAN — карта по Wi‑Fi CSI

**Не браузер. Не камера.** Desktop OpenCV: позиція людини з **відбиття Wi‑Fi** (CSI) на лінку домашній AP ↔ ESP32 DevKit V1.

## Залізо

| Що | Навіщо |
|----|--------|
| 1× **ESP32 DevKit V1** | CSI RX (окрема прошивка, не годинник) |
| Wi‑Fi AP (роутер) | Джерело пакетів для CSI |
| ПК + USB | Serial → `scan.py` |

З одним DevKit: presence / motion / груба позиція **вздовж** зони відчуття AP–ESP. Немає RF-скелета і точної (x,y) по всій станції.

## 1. Прошивка ESP

Див. [`firmware/csi_node/README.md`](firmware/csi_node/README.md):

1. `secrets.h.example` → `secrets.h` (SSID/пароль).
2. Arduino IDE → ESP32 Dev Module → Upload `csi_node.ino`.
3. Serial 115200: `csi/on` і рядки з `"amp":[...]`.

## 2. Запуск на ПК

```powershell
cd prototype/scan
.\run.ps1                  # покаже COM-порти
.\run.ps1 --port COM11
```

Або:

```powershell
pip install -r requirements.txt
python scan.py --port COM11
python scan.py --port COM11 --ap-x 4 --ap-y 4 --esp-x 18 --esp-y 12
```

1. Перші **~5 с** — порожня кімната (baseline).
2. Ходи між роутером і ESP — на карті з’явиться RF-точка.
3. **Q** — вихід.

Координати AP/ESP на плані HAB/LAB піджени під реальне розставлення (`--ap-x/y`, `--esp-x/y`).

## Що малює

| Елемент | Дані |
|---------|------|
| Лінія AP→ESP | RF-лінк на карті станції |
| Зелена точка | Presence + оцінка позиції вздовж лінка |
| Смуга energy | Зміна CSI vs baseline |

Симульованих «гуляючих» людей немає — точка лише при живому CSI і presence.

## Залежності

```
opencv-python, numpy, pyserial
```
