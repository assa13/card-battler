# Рендер emoji-иконок карточек в PNG + атлас 5x5 + manifest.
# Запуск: python scripts/render-card-icons.py
# Выход: icon-atlas/card-icons/*.png, icon-atlas/cards-5x5.webp, icon-atlas/card-icons/manifest.json
# Источник данных: HERO_ABILITIES и CARD_MODIFIERS в src/App.jsx (иконки — emoji).
import json
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'icon-atlas', 'card-icons')
ATLAS_PATH = os.path.join(ROOT, 'icon-atlas', 'cards-5x5.webp')
FONT_PATH = r'C:\Windows\Fonts\seguiemj.ttf'
CELL = 256
COLS = ROWS = 5
FONT_SIZE = 200

# (card_id, hero, name, emoji, dmgType, rarity)
CARDS = [
    ('b1',   'p1', 'Удар мечом',     '⚔️',  'melee',  'COMMON'),
    ('s1_1', 'p1', 'Молот Тора',     '🔨', 'melee',  'EPIC'),
    ('s1_2', 'p1', 'Размах',         '🌪️', 'melee',  'COMMON'),
    ('s1_3', 'p1', 'Рывок',          '🏃', 'melee',  'COMMON'),
    ('s1_4', 'p1', 'Берсерк',        '🪓', 'melee',  'EPIC'),
    ('b2',   'p2', 'Кинжал',         '🗡️', 'ranged', 'COMMON'),
    ('s2_1', 'p2', 'Яд',             '🧪', 'ranged', 'COMMON'),
    ('s2_2', 'p2', 'Тысяча порезов', '✂️', 'ranged', 'RARE'),
    ('s2_3', 'p2', 'Танец стали',    '⚔️',  'ranged', 'RARE'),
    ('s2_4', 'p2', 'Кровопускание',  '🩸', 'ranged', 'EPIC'),
    ('b3',   'p3', 'Мертвая лошадь', '🐎', 'magic',  'COMMON'),
    ('s3_1', 'p3', 'Огненный шар',   '☄️',  'magic',  'RARE'),
    ('s3_2', 'p3', 'Ледяной шип',    '❄️',  'magic',  'RARE'),
    ('s3_3', 'p3', 'Цепная молния',  '⚡', 'magic',  'RARE'),
    ('s3_4', 'p3', 'Чёрная дыра',    '🌌', 'magic',  'LEGENDARY'),
    ('mod_armor', 'mod', 'Закал брони',    '🛡️', None, 'RARE'),
    ('mod_chain', 'mod', 'Усиление цепи',  '🔗', None, 'RARE'),
]

def render_emoji(emoji, font):
    # U+FE0F (variation selector) ломает позиционирование glyph'а в Pillow.
    text = emoji.replace('\ufe0f', '')
    im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((CELL // 2, CELL // 2), text, font=font, embedded_color=True, anchor='mm')
    return im

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
    atlas = Image.new('RGBA', (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
    manifest = []

    for i, (card_id, hero, name, emoji, dmg_type, rarity) in enumerate(CARDS):
        im = render_emoji(emoji, font)
        if not im.getbbox():
            print(f'!! пустой рендер: {card_id} {emoji}')
        png_name = f'{card_id}.png'
        im.save(os.path.join(OUT_DIR, png_name))
        col, row = i % COLS, i // COLS
        atlas.paste(im, (col * CELL, row * CELL))
        manifest.append({
            'id': card_id, 'hero': hero, 'name': name, 'emoji': emoji,
            'dmgType': dmg_type, 'rarity': rarity, 'file': f'card-icons/{png_name}',
            'atlas': {'index': i, 'row': row, 'col': col, 'x': col * CELL, 'y': row * CELL,
                      'width': CELL, 'height': CELL},
        })

    atlas.save(ATLAS_PATH, lossless=True)
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump({'cellSize': CELL, 'cols': COLS, 'rows': ROWS,
                   'atlas': os.path.basename(ATLAS_PATH), 'cards': manifest},
                  f, ensure_ascii=False, indent=2)
    print(f'{len(manifest)} иконок -> {OUT_DIR}')
    print(f'атлас -> {ATLAS_PATH}')

if __name__ == '__main__':
    main()
