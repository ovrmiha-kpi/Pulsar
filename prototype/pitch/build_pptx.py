#!/usr/bin/env python3
"""Build PULSAR pitch as a real PowerPoint (.pptx)."""

from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent
MEDIA = ROOT / "media"
OUT = ROOT / "PULSAR_Pitch.pptx"

# 16:9
W, H = Inches(13.333), Inches(7.5)

BG = RGBColor(0x07, 0x0D, 0x18)
PANEL = RGBColor(0x13, 0x20, 0x33)
LINE = RGBColor(0x2A, 0x3D, 0x55)
TEXT = RGBColor(0xE8, 0xF4, 0xFF)
MUTED = RGBColor(0x8F, 0xA6, 0xC0)
CYAN = RGBColor(0x3E, 0xC9, 0xE0)
GREEN = RGBColor(0x3D, 0xDC, 0x84)


def set_run(run, size=18, bold=False, color=TEXT, name="Calibri"):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = name


def add_bg(slide):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, H)
    shape.fill.solid()
    shape.fill.fore_color.rgb = BG
    shape.line.fill.background()


def add_accent_bar(slide):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, Emu(50000))
    bar.fill.solid()
    bar.fill.fore_color.rgb = CYAN
    bar.line.fill.background()


def textbox(slide, left, top, width, height):
    return slide.shapes.add_textbox(left, top, width, height)


def write_para(tf, text, size=18, bold=False, color=TEXT, align=PP_ALIGN.LEFT, space_after=8):
    p = tf.add_paragraph() if tf.text else tf.paragraphs[0]
    if tf.text and p is tf.paragraphs[0] and tf.paragraphs[0].text:
        p = tf.add_paragraph()
    # first call on empty
    if not tf.text:
        p = tf.paragraphs[0]
    p.text = text
    p.alignment = align
    p.space_after = Pt(space_after)
    for r in p.runs:
        set_run(r, size=size, bold=bold, color=color)
    return p


def fill_text(shape, lines):
    """lines: list of (text, size, bold, color)"""
    tf = shape.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    first = True
    for text, size, bold, color in lines:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text = text
        p.space_after = Pt(6 if size < 28 else 10)
        if not p.runs:
            run = p.add_run()
            run.text = text
            set_run(run, size=size, bold=bold, color=color)
        else:
            for r in p.runs:
                set_run(r, size=size, bold=bold, color=color)


def card(slide, left, top, width, height, title, body):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shp.fill.solid()
    shp.fill.fore_color.rgb = PANEL
    shp.line.color.rgb = LINE
    shp.line.width = Pt(1)
    tf = shp.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.18)
    tf.margin_right = Inches(0.18)
    tf.margin_top = Inches(0.16)
    p = tf.paragraphs[0]
    p.text = title
    for r in p.runs:
        set_run(r, size=18, bold=True, color=CYAN)
    p2 = tf.add_paragraph()
    p2.text = body
    p2.space_before = Pt(6)
    for r in p2.runs:
        set_run(r, size=14, bold=False, color=MUTED)


def try_picture(slide, path: Path, left, top, width, height):
    if path.exists():
        slide.shapes.add_picture(str(path), left, top, width=width, height=height)
        return True
    # placeholder
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shp.fill.solid()
    shp.fill.fore_color.rgb = PANEL
    shp.line.color.rgb = LINE
    fill_text(shp, [(f"Додайте фото:\n{path.name}", 14, False, MUTED)])
    return False


def new_slide(prs):
    # blank layout
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(slide)
    add_accent_bar(slide)
    return slide


def build():
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H

    # 1 Title
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(1.8), Inches(7.2), Inches(4.2))
    fill_text(
        box,
        [
            ("NASA SPACE APPS 2026", 14, True, CYAN),
            ("PULSAR", 66, True, CYAN),
            (
                "Щоб екіпаж сам бачив зміни здоров’я вчасно —\nі міг діяти, коли Земля далеко.",
                22,
                False,
                MUTED,
            ),
            ("Годинник на зап’ясті + станція для всієї команди", 16, False, TEXT),
        ],
    )
    try_picture(s, MEDIA / "ui-dashboard.png", Inches(8.2), Inches(1.5), Inches(4.5), Inches(4.8))

    # 2 Challenge
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(1.2), Inches(12), Inches(5))
    fill_text(
        box,
        [
            ("THE CHALLENGE", 14, True, CYAN),
            ("Довгі місії — відповідальність на самому екіпажі", 36, True, TEXT),
            ("", 10, False, MUTED),
            (
                "NASA: на довгих польотах астронавти самі мають помічати зміни в собі.\n"
                "Потрібне ПЗ, яке збирає показники здоров’я й допомагає оцінити стан і діяти.",
                22,
                False,
                MUTED,
            ),
            ("", 10, False, MUTED),
            (
                "Create Health Monitoring Software for Astronauts on Space Missions",
                16,
                False,
                CYAN,
            ),
        ],
    )

    # 3 Hazards
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(0.55), Inches(12), Inches(1.2))
    fill_text(
        box,
        [
            ("WHY IT MATTERS", 14, True, CYAN),
            ("Небезпеки польоту б’ють по тілу й психіці", 32, True, TEXT),
        ],
    )
    cards = [
        ("Радіація", "Ризик накопичується — його треба бачити поруч із самопочуттям."),
        ("Ізоляція", "Стрес, сон, настрій — поведінкове здоров’я так само критичне."),
        ("Закрите середовище", "Повітря, CO₂, тиск кабіни впливають на стан екіпажу."),
        ("Змінена гравітація", "Серце, м’язи, хват і маса — дрейф від власної норми."),
        ("Відстань від Землі", "Затримка зв’язку: рішення мають лишатись на борту."),
        ("Наслідок", "Зміни тихі, поки не стають кризою для місії."),
    ]
    for i, (t, b) in enumerate(cards):
        col, row = i % 3, i // 3
        card(
            s,
            Inches(0.7 + col * 4.1),
            Inches(2.0 + row * 2.4),
            Inches(3.9),
            Inches(2.15),
            t,
            b,
        )

    # 4 Gap
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(0.55), Inches(12), Inches(1.2))
    fill_text(
        box,
        [
            ("THE GAP", 14, True, CYAN),
            ("Дані є. Картини для екіпажу — немає", 32, True, TEXT),
        ],
    )
    for i, (t, b) in enumerate(
        [
            ("Розкидано", "Показники в різних місцях. Важко миттєво відповісти: «як ми зараз?»"),
            ("Без тренду", "Одне число не показує, що стан погіршується день за днем."),
            ("Без дії", "Побачити попередження мало — треба зрозуміти наступний крок."),
        ]
    ):
        card(s, Inches(0.7 + i * 4.1), Inches(2.2), Inches(3.9), Inches(3.5), t, b)

    # 5 Answer
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(1.5), Inches(7), Inches(4.5))
    fill_text(
        box,
        [
            ("OUR ANSWER", 14, True, CYAN),
            ("Годинник на зап’ясті і Станція.", 36, True, TEXT),
            ("", 8, False, MUTED),
            (
                "Особистий сенсор завжди з астронавтом.\n"
                "Спільна станція дає команді одну живу картину здоров’я —\n"
                "щоб оцінити ризик і діяти разом.",
                20,
                False,
                MUTED,
            ),
            ("", 8, False, MUTED),
            ("Відчути на собі  →  Побачити всім  →  Діяти вчасно", 18, True, CYAN),
        ],
    )
    try_picture(s, MEDIA / "top_esp32.jpg", Inches(8.0), Inches(1.6), Inches(4.6), Inches(4.6))

    # 6 Watch value
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(0.5), Inches(12), Inches(1.1))
    fill_text(
        box,
        [
            ("THE WATCH", 14, True, CYAN),
            ("Що дає годинник астронавту", 32, True, TEXT),
        ],
    )
    for i, (t, b) in enumerate(
        [
            ("Постійний сигнал тіла", "Пульс, кисень у крові, рух і навантаження — без візиту в медблок."),
            ("Локальна ясність", "Свій стан тут і зараз, навіть коли станція тимчасово мовчить."),
            ("Нічого не губиться", "Якщо зв’язок падає, записи лишаються на пристрої й повертаються в спільну картину."),
        ]
    ):
        card(s, Inches(0.7 + i * 4.1), Inches(1.9), Inches(3.9), Inches(2.6), t, b)
    for i, name in enumerate(
        ["top_max30102.jpg", "top_mpu6050.jpg", "top_hx711.jpg", "top_tft.jpg"]
    ):
        try_picture(
            s,
            MEDIA / name,
            Inches(0.7 + i * 3.15),
            Inches(4.85),
            Inches(3.0),
            Inches(2.2),
        )

    # 7 Device photo slots
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(0.55), Inches(12), Inches(1.3))
    fill_text(
        box,
        [
            ("ON THE WRIST", 14, True, CYAN),
            ("Пристрій, який живе з екіпажем", 32, True, TEXT),
            ("Вставте свої фото зібраного годинника в ці кадри.", 16, False, MUTED),
        ],
    )
    for i, label in enumerate(["На столі / збірка", "На зап’ясті", "Екран у роботі"]):
        left = Inches(0.7 + i * 4.1)
        shp = s.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE, left, Inches(2.3), Inches(3.9), Inches(3.8)
        )
        shp.fill.solid()
        shp.fill.fore_color.rgb = PANEL
        shp.line.color.rgb = LINE
        fill_text(shp, [(label, 18, True, TEXT), ("Ваше фото тут", 14, False, MUTED)])

    # 8 Station value
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(0.55), Inches(12), Inches(1.1))
    fill_text(
        box,
        [
            ("THE STATION", 14, True, CYAN),
            ("Що дає станція всій команді", 32, True, TEXT),
        ],
    )
    for i, (t, b) in enumerate(
        [
            (
                "Одна картина екіпажу",
                "Хто в нормі, хто в попередженні, хто потребує уваги — без ручного збирання файлів.",
            ),
            (
                "Оцінка, не лише число",
                "Тренди за дні й підказки «що перевірити» — щоб зрозуміти зміну до кризи.",
            ),
            (
                "Дія на борту",
                "SOS, глибока перевірка, check-in самопочуття, контекст середовища кабіни.",
            ),
        ]
    ):
        card(s, Inches(0.7 + i * 4.1), Inches(2.1), Inches(3.9), Inches(3.8), t, b)

    # 9 Dashboard
    s = new_slide(prs)
    box = textbox(s, Inches(0.55), Inches(0.45), Inches(5.5), Inches(6.5))
    fill_text(
        box,
        [
            ("EVALUATE", 14, True, CYAN),
            ("Побачити проблему до кризи", 30, True, TEXT),
            ("", 8, False, MUTED),
            (
                "Станція підсвічує, у кого росте пульс, падає кисень, накопичується стрес.\n\n"
                "Командир і медичний офіцер ділять одну живу панель.",
                18,
                False,
                MUTED,
            ),
        ],
    )
    try_picture(s, MEDIA / "ui-dashboard.png", Inches(6.2), Inches(1.0), Inches(6.5), Inches(5.5))

    # 10 Act / details — no skin temp
    s = new_slide(prs)
    try_picture(s, MEDIA / "ui-details-health.png", Inches(0.5), Inches(1.0), Inches(6.2), Inches(5.5))
    box = textbox(s, Inches(7.0), Inches(1.0), Inches(5.7), Inches(5.5))
    fill_text(
        box,
        [
            ("ACT", 14, True, CYAN),
            ("Зрозуміти людину — і зробити крок", 28, True, TEXT),
            ("", 8, False, MUTED),
            ("Тіло", 16, True, CYAN),
            ("Пульс, кисень у крові, хват, маса, активність", 16, False, MUTED),
            ("", 6, False, MUTED),
            ("Самопочуття", 16, True, CYAN),
            ("Сон, стрес, щоденний check-in настрою", 16, False, MUTED),
            ("", 6, False, MUTED),
            ("Середовище кабіни", 16, True, CYAN),
            (
                "Температура навколишнього середовища,\nатмосферний тиск, повітря / CO₂, радіаційний фон",
                16,
                False,
                MUTED,
            ),
        ],
    )

    # 11 Environment visual
    s = new_slide(prs)
    box = textbox(s, Inches(0.55), Inches(0.45), Inches(5.8), Inches(6.5))
    fill_text(
        box,
        [
            ("CABIN CONTEXT", 14, True, CYAN),
            ("Стан людини + стан кабіни", 30, True, TEXT),
            ("", 8, False, MUTED),
            (
                "Закрите середовище — частина здоров’я екіпажу.\n"
                "Станція показує тиск і температуру повітря поруч із віталами,\n"
                "щоб команда бачила не лише тіло, а й умови зміни.",
                18,
                False,
                MUTED,
            ),
        ],
    )
    try_picture(s, MEDIA / "ui-details-env.png", Inches(6.5), Inches(1.0), Inches(6.2), Inches(5.5))

    # 12 Close the loop
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(0.55), Inches(12), Inches(1.2))
    fill_text(
        box,
        [
            ("HOW PULSAR HELPS", 14, True, CYAN),
            ("Зібрати → оцінити → діяти", 32, True, TEXT),
        ],
    )
    for i, (t, b) in enumerate(
        [
            ("Зібрати", "Годинник знімає показники з тіла; станція збирає картину екіпажу й кабіни."),
            ("Оцінити", "Статуси, тренди за дні, зрозумілі попередження мовою місії."),
            ("Діяти", "Рекомендації наступного кроку, SOS, персональна картка — без очікування Землі."),
        ]
    ):
        card(s, Inches(0.7 + i * 4.1), Inches(2.1), Inches(3.9), Inches(3.2), t, b)
    foot = textbox(s, Inches(0.7), Inches(5.7), Inches(12), Inches(1.2))
    fill_text(
        foot,
        [
            (
                "Саме це просить NASA: не ще один лог сенсорів, а інструмент,\n"
                "з яким екіпаж керує своїм здоров’ям на борту.",
                18,
                False,
                MUTED,
            )
        ],
    )

    # 13 Close
    s = new_slide(prs)
    box = textbox(s, Inches(0.7), Inches(2.0), Inches(12), Inches(4))
    fill_text(
        box,
        [
            ("THANK YOU", 14, True, CYAN),
            ("PULSAR", 60, True, CYAN),
            (
                "Годинник на зап’ясті і Станція —\nщоб зміни здоров’я було видно вчасно.",
                24,
                False,
                MUTED,
            ),
            ("", 10, False, MUTED),
            ("Q & A  ·  NASA Space Apps Challenge 2026", 18, True, TEXT),
        ],
    )

    prs.save(OUT)
    print("Wrote", OUT)


if __name__ == "__main__":
    build()
