"""Rebuild tiny synthetic raster PDFs. No third-party source document is used.

Run from services/ai with the ingestion runtime. Raster typography uses DejaVu
Sans, installed by the ingestion Dockerfile; CTMS_OCR_FIXTURE_FONT can select it
on Windows. Committed PDFs, rather than host fonts, are the test inputs.
"""

import os
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas

ROOT = Path(__file__).parent
FONT = os.environ.get("CTMS_OCR_FIXTURE_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")


def raster(title, lines, table=False):
    image = Image.new("RGB", (1785, 2526), "white")
    draw = ImageDraw.Draw(image)
    draw.text((150, 180), title, font=ImageFont.truetype(FONT, 62), fill="black")
    font = ImageFont.truetype(FONT, 40)
    for i, line in enumerate(lines):
        draw.text((150, 330 + 85 * i), line, font=font, fill="black")
    if table:
        for y in [800, 900, 1000, 1100]:
            draw.line((150, y, 1600, y), fill="black", width=3)
        for x in [150, 900, 1600]:
            draw.line((x, 800, x, 1100), fill="black", width=3)
        for y, cells in zip([830, 930, 1030], [("Sample", "Value ml"), ("Alpha", "250"), ("Beta", "500")]):
            for x, value in zip([185, 950], cells):
                draw.text((x, y), value, font=font, fill="black")
    return image


def pdf(name, pages):
    target = ROOT / name
    canvas = Canvas(str(target), pagesize=(595, 842), invariant=1)
    for image in pages:
        if image is not None:
            canvas.drawImage(ImageReader(image), 0, 0, width=595, height=842)
        canvas.showPage()
    canvas.save()


def visual_only():
    image = Image.new("RGB", (1785, 2526), "white")
    draw = ImageDraw.Draw(image)
    draw.line([(1400, 1700), (650, 1700), (650, 700)], fill="black", width=18)
    draw.polygon([(650, 580), (570, 740), (730, 740)], fill="black")
    return image


if __name__ == "__main__":
    pdf("visual-only.pdf", [visual_only()])
    vi = raster("Tài liệu thử nghiệm", [
        "Nội dung tiếng Việt dùng để kiểm tra phần mềm.",
        "Danh sách đồ dùng", "1. Kiểm tra danh sách trước chuyến đi.",
        "2. Ghi lại các mục còn thiếu.", "3. Giữ nguyên thứ tự của các bước.",
    ])
    en = raster("Fictional field handbook", [
        "This synthetic document tests software extraction.", "Equipment checklist",
        "1. Check the fictional equipment list.", "2. Record the missing sample items.",
        "3. Keep the listed steps in their original order.",
    ])
    pdf("scan-vi.pdf", [vi])
    pdf("scan-en.pdf", [en])
    pdf("scan-multipage.pdf", [vi, en])
    pdf("scan-blank.pdf", [vi, None, en])
    pdf("scan-table.pdf", [raster("Fictional sample table", ["Sample records with numerical values."], table=True)])
    pdf("scan-warning.pdf", [raster("Fictional safety fixture", [
        "WARNING: Test material only. Do not use as advice.",
        "1. Keep the fictional warning with these steps.",
        "2. Check the sample value of 250 ml.",
        "3. Preserve all conditions and units.",
    ])])
    unreadable = en.resize((89, 126), Image.Resampling.BILINEAR).resize(en.size, Image.Resampling.BILINEAR)
    pdf("scan-unreadable.pdf", [unreadable])
    canvas = Canvas(str(ROOT / "mixed.pdf"), pagesize=(595, 842), invariant=1)
    canvas.setFont("Helvetica-Bold", 20)
    canvas.drawString(50, 760, "Fictional native text")
    canvas.setFont("Helvetica", 12)
    canvas.drawString(50, 720, "This page has native text. The next page is a Vietnamese scan.")
    canvas.showPage()
    canvas.drawImage(ImageReader(vi), 0, 0, width=595, height=842)
    canvas.showPage()
    canvas.save()
    # Native text and a raster paragraph on the same page exercises overlap filtering.
    canvas = Canvas(str(ROOT / "mixed-page.pdf"), pagesize=(595, 842), invariant=1)
    canvas.setFont("Helvetica-Bold", 20)
    canvas.drawString(50, 780, "Fictional mixed page")
    crop = en.crop((0, 150, 1785, 850))
    canvas.drawImage(ImageReader(crop), 0, 300, width=595, height=700 / 3)
    canvas.showPage()
    canvas.save()
