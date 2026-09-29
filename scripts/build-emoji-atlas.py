"""Collect existing UI glyphs; preserve edited PNGs and append new slots.

python scripts/build-emoji-atlas.py
python scripts/build-emoji-atlas.py --size small --import-atlas path/to/redrawn.png
"""
import argparse
import json
import math
import shutil
import subprocess
import unicodedata
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'icon-atlas' / 'emoji'
FONT_DIR = Path('C:/Windows/Fonts')
GROUPS = ['Валюты и ресурсы', 'Управление', 'Статусы', 'Оружие и магия', 'Персонажи и объекты', 'Оформление', 'Новые']
# glyph: readable filename, Russian label, category index.
META = {
    '🪙': ('gold', 'Золото', 0), '🔥': ('embers', 'Огоньки души / огонь', 0),
    '🔵': ('mana', 'Мана / эфир', 0), '❤️': ('health', 'Здоровье', 0),
    '💪': ('power', 'Сила', 0), '🎁': ('reward', 'Награда', 0),
    '📜': ('scroll', 'Свиток / фолиант', 0), '🃏': ('card', 'Карта', 0),
    '🔒': ('lock', 'Замок', 1), '🔇': ('sound-off', 'Звук выключен', 1),
    '🔉': ('sound-low', 'Тихий звук', 1), '🔊': ('sound-on', 'Громкий звук', 1),
    '→': ('arrow-right', 'Стрелка вправо', 1), '↔': ('arrow-both', 'Стрелка в обе стороны', 1),
    '↩': ('return', 'Возврат', 1), '⬇️': ('arrow-down', 'Стрелка вниз', 1),
    '▲': ('triangle-up', 'Треугольник вверх', 1), '▼': ('triangle-down', 'Треугольник вниз', 1),
    '▶': ('triangle-right', 'Треугольник вправо', 1), '◀': ('triangle-left', 'Треугольник влево', 1),
    '▸': ('caret-right', 'Малая стрелка вправо', 1), '✓': ('check', 'Галочка', 1),
    '✕': ('close', 'Закрыть', 1), '×': ('multiply', 'Крестик / умножение', 1),
    '+': ('plus', 'Плюс / свободный слот', 1), '−': ('minus', 'Минус', 1),
    '-': ('hyphen', 'Короткий минус', 1), '?': ('question', 'Неизвестно', 1),
    '!': ('exclamation', 'Внимание', 1), '⏳': ('hourglass', 'Ожидание', 1),
    '💫': ('stun', 'Оглушение', 2), '🌀': ('blind', 'Ослепление / вихрь', 2),
    '🎯': ('mark', 'Метка / цель', 2), '🩸': ('bleed', 'Кровотечение', 2),
    '🛡️': ('shield', 'Броня / щит', 2), '🔗': ('chain', 'Цепь / комбо', 2),
    '🟢': ('green-orb', 'Зелёная сфера / слизень', 2),
    '⚔️': ('crossed-swords', 'Скрещённые мечи', 3), '🗡️': ('dagger', 'Кинжал', 3),
    '🔨': ('hammer', 'Молот', 3), '🪓': ('axe', 'Топор', 3),
    '🏹': ('bow', 'Лук', 3), '🧪': ('poison', 'Яд / колба', 3),
    '✂️': ('cuts', 'Ножницы / порезы', 3), '🌪️': ('whirlwind', 'Вихрь / размах', 3),
    '☄️': ('fireball', 'Огненный шар / комета', 3), '❄️': ('snowflake', 'Снежинка / лёд', 3),
    '🧊': ('ice', 'Куб льда', 3), '⚡': ('lightning', 'Молния', 3),
    '🌌': ('void', 'Космос / чёрная дыра', 3), '🔮': ('crystal-ball', 'Магический шар', 3),
    '✨': ('sparkles', 'Искры / событие', 3), '⚒': ('craft', 'Кузница / инструменты', 3),
    '💀': ('skull', 'Череп', 4), '☠️': ('danger-skull', 'Череп с костями', 4),
    '🦴': ('bone', 'Кость', 4), '🐎': ('horse', 'Лошадь', 4),
    '🏃': ('dash', 'Бег / рывок', 4), '🏰': ('castle', 'Замок / база', 4),
    '🐉': ('dragon', 'Дракон', 4), '🐲': ('dragon-head', 'Голова дракона', 4),
    '🐺': ('wolf', 'Волк', 4), '👁️': ('eye', 'Глаз', 4),
    '👺': ('goblin', 'Гоблин', 4), '🦹': ('bandit', 'Бандит', 4),
    '🧙': ('wizard', 'Маг', 4), '🧟': ('zombie', 'Зомби', 4),
    '🕯️': ('candle', 'Свеча', 4), '✦': ('star', 'Четырёхконечная звезда', 5),
    '•': ('bullet', 'Маркер списка', 5), '·': ('middle-dot', 'Точка-разделитель', 5),
    '…': ('ellipsis', 'Многоточие', 5),
}
canonical = lambda text: text.replace('\ufe0e', '').replace('\ufe0f', '')
META = {canonical(glyph): value for glyph, value in META.items()}
ATLAS_SIZES = {'small': 32, 'medium': 64, 'large': 128}


def size_class(category):
    if category in ('Управление', 'Оформление'):
        return 'small'
    if category in ('Оружие и магия', 'Персонажи и объекты'):
        return 'large'
    return 'medium'


def load_json(file):
    return json.loads(file.read_text(encoding='utf-8-sig'))


def save_json(file, data):
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def scan():
    node = shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
    result = subprocess.run([node, str(ROOT / 'scripts/collect-ui-emoji.mjs')], cwd=ROOT,
                            capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(result.stdout)


def describe(item):
    glyph = canonical(item['glyph'])
    fallback = ' + '.join(unicodedata.name(char, f'U+{ord(char):04X}') for char in glyph)
    return META.get(glyph, (item['id'], fallback, 6))


def render_glyph(glyph, cell, category):
    # FE0F affects positioning in Pillow's Windows font rasterizer. Store the
    # untouched aliases in the manifest, but draw the actual base glyph.
    text = canonical(glyph)
    is_emoji = any(ord(char) >= 0x1F000 for char in text) or '\ufe0f' in glyph or text == '⏳'
    font_name = 'seguiemj.ttf' if is_emoji or category not in ('Управление', 'Оформление') else 'seguisym.ttf'
    font = ImageFont.truetype(str(FONT_DIR / font_name), cell * 2)
    mask = font.getmask(text)
    missing = font.getmask('\U0010ffff')
    if mask.size == missing.size and bytes(mask) == bytes(missing):
        raise ValueError(f'Font has no glyph for {glyph!r}; supply a PNG in icons/ instead.')
    canvas = Image.new('RGBA', (cell * 6, cell * 6))
    ImageDraw.Draw(canvas).text((cell * 3, cell * 3), text, font=font,
                               fill='#e4e8ef', embedded_color=True, anchor='mm')
    box = canvas.getbbox()
    if box is None:
        raise ValueError(f'Empty glyph: {glyph!r}')
    max_size = cell // 6 if text == '·' else cell // 3 if text == '•' else cell * 3 // 4
    art = ImageOps.contain(canvas.crop(box), (max_size, max_size), Image.Resampling.LANCZOS)
    image = Image.new('RGBA', (cell, cell))
    image.paste(art, ((cell - art.width) // 2, (cell - art.height) // 2))
    return image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--import-atlas', type=Path, help='Import a redrawn PNG using the current catalogue grid')
    parser.add_argument('--size', choices=ATLAS_SIZES, help='Atlas to import, or size for newly added custom PNGs (default: medium)')
    args = parser.parse_args()
    if args.import_atlas and not args.size:
        parser.error('--import-atlas requires --size small, medium or large')
    (OUT / 'icons').mkdir(parents=True, exist_ok=True)
    catalog_path = OUT / 'catalog.json'
    catalog = load_json(catalog_path) if catalog_path.exists() else {'version': 1, 'cols': 10, 'cellSize': 128, 'icons': []}
    entries = catalog['icons']
    if catalog['version'] == 1:
        # Preserve the original sheet and its coordinate map as a reference.
        archive = OUT / 'archive-v1'
        archive.mkdir(exist_ok=True)
        for name in ('atlas.png', 'atlas.webp', 'atlas-numbered.png', 'manifest.json', 'catalog.json'):
            source = OUT / name
            if source.exists() and not (archive / name).exists():
                shutil.copy2(source, archive / name)
        catalog = {'version': 2, 'sourceCellSize': catalog['cellSize'],
                   'atlases': {name: {'cellSize': cell, 'cols': 8, 'nextSlot': 0}
                               for name, cell in ATLAS_SIZES.items()}, 'icons': entries}

    def assign_slot(entry):
        group = entry.setdefault('sizeClass', size_class(entry['category']))
        if group not in catalog['atlases']:
            raise ValueError(f'Unknown sizeClass: {group}')
        config = catalog['atlases'][group]
        if entry.get('atlasSlot') is None:
            entry['atlasSlot'] = config['nextSlot']
            config['nextSlot'] += 1

    # Reserve all existing slots before assigning new ones. Gaps stay reserved.
    for group, config in catalog['atlases'].items():
        config['nextSlot'] = max(config.get('nextSlot', 0),
                                 max((e['atlasSlot'] + 1 for e in entries
                                      if e.get('sizeClass') == group and e.get('atlasSlot') is not None), default=0))
    for entry in sorted(entries, key=lambda e: e['slot']):
        assign_slot(entry)

    def validate():
        for field in ('id', 'slot', 'file'):
            if len({e[field] for e in entries}) != len(entries):
                raise ValueError(f'Duplicate {field} in catalog.json')
        positions = [(e['sizeClass'], e['atlasSlot']) for e in entries]
        if len(set(positions)) != len(positions):
            raise ValueError('Duplicate atlasSlot; set atlasSlot to null when moving an icon to another sizeClass.')
        for entry in entries:
            if not isinstance(entry['atlasSlot'], int) or entry['atlasSlot'] < 0:
                raise ValueError('atlasSlot must be a nonnegative integer')
            if not (OUT / entry['file']).resolve().is_relative_to((OUT / 'icons').resolve()):
                raise ValueError(f'Icon path must stay inside icons/: {entry["file"]}')

    validate()
    if args.import_atlas:
        selected = [e for e in entries if e['sizeClass'] == args.size]
        config = catalog['atlases'][args.size]
        cell, cols = config['cellSize'], config['cols']
        rows = max(1, math.ceil(config['nextSlot'] / cols))
        source = Image.open(args.import_atlas).convert('RGBA')
        if not selected or source.size != (cols * cell, rows * cell):
            raise ValueError(f'Expected a nonempty {args.size} atlas of {cols * cell}x{rows * cell}; received {source.size}')
        backup = OUT / 'before-import' / args.size
        backup.mkdir(parents=True, exist_ok=True)
        for entry in selected:
            file = OUT / entry['file']
            if file.exists():
                shutil.copy2(file, backup / file.name)
            x, y = entry['atlasSlot'] % cols * cell, entry['atlasSlot'] // cols * cell
            # Keep source PNGs at the common editing size without smoothing pixels.
            source.crop((x, y, x + cell, y + cell)).resize(
                (catalog['sourceCellSize'],) * 2, Image.Resampling.NEAREST).save(file)

    inventory = scan()
    by_id = {entry['id']: entry for entry in entries}
    next_slot = max((entry['slot'] for entry in entries), default=-1) + 1
    for item in sorted(inventory['icons'], key=lambda item: (describe(item)[2], describe(item)[0])):
        if item['id'] not in by_id:
            name, label, category = describe(item)
            entry = {'id': item['id'], 'slot': next_slot, 'glyph': item['glyph'],
                     'label': label, 'category': GROUPS[category], 'file': f'icons/{name}.png'}
            next_slot += 1
            entries.append(entry)
            by_id[entry['id']] = entry
    registered_files = {entry['file'] for entry in entries}
    for file in sorted((OUT / 'icons').glob('*.png')):
        relative = file.relative_to(OUT).as_posix()
        if relative not in registered_files:
            entry = {'id': f'custom-{file.stem}', 'slot': next_slot, 'glyph': '',
                     'label': file.stem, 'category': 'Новые', 'file': relative,
                     'sizeClass': args.size or 'medium'}
            if entry['id'] in by_id:
                raise ValueError(f'Duplicate icon ID: {entry["id"]}')
            next_slot += 1
            entries.append(entry)
            by_id[entry['id']] = entry
    for entry in entries:
        assign_slot(entry)
    validate()
    for entry in entries:
        file = OUT / entry['file']
        if not file.exists():
            if not entry['glyph']:
                raise ValueError(f'Missing custom icon: {file}')
            render_glyph(entry['glyph'], catalog['sourceCellSize'], entry['category']).save(file)

    font = ImageFont.truetype(str(FONT_DIR / 'segoeui.ttf'), 12)
    small_font = ImageFont.truetype(str(FONT_DIR / 'segoeui.ttf'), 10)
    uses = {item['id']: item for item in inventory['icons']}
    manifest_entries = []
    atlas_manifest = {}
    for group, config in catalog['atlases'].items():
        cell, cols = config['cellSize'], config['cols']
        rows = max(1, math.ceil(config['nextSlot'] / cols))
        folder = OUT / group
        folder.mkdir(exist_ok=True)
        atlas = Image.new('RGBA', (cols * cell, rows * cell))
        preview_cell, label_height = 128, 48
        preview = Image.new('RGB', (cols * preview_cell, rows * (preview_cell + label_height)), '#191c25')
        draw = ImageDraw.Draw(preview)
        selected = sorted((e for e in entries if e['sizeClass'] == group), key=lambda e: e['atlasSlot'])
        for entry in selected:
            art = Image.open(OUT / entry['file']).convert('RGBA')
            art = ImageOps.contain(art, (cell, cell), Image.Resampling.NEAREST)
            tile = Image.new('RGBA', (cell, cell))
            tile.paste(art, ((cell - art.width) // 2, (cell - art.height) // 2))
            col, row = entry['atlasSlot'] % cols, entry['atlasSlot'] // cols
            x, y = col * cell, row * cell
            atlas.paste(tile, (x, y))
            px, py = col * preview_cell, row * (preview_cell + label_height)
            enlarged = tile.resize((preview_cell, preview_cell), Image.Resampling.NEAREST)
            preview.paste(enlarged, (px, py), enlarged)
            draw.rectangle((px, py, px + preview_cell - 1, py + preview_cell + label_height - 1), outline='#343b4b')
            draw.text((px + 6, py + preview_cell), f'{entry["atlasSlot"] + 1:02d}  {entry["label"][:16]}', font=font, fill='#e1e6ed')
            draw.text((px + 6, py + preview_cell + 18), Path(entry['file']).stem[:21], font=small_font, fill='#99a8be')
            usage = uses.get(entry['id'], {})
            manifest_entries.append({**entry, 'image': f'{group}/atlas.png', 'index': entry['atlasSlot'],
                                     'row': row, 'col': col, 'x': x, 'y': y, 'width': cell, 'height': cell,
                                     'aliases': usage.get('aliases', []), 'sources': usage.get('sources', [])})
        atlas.save(folder / 'atlas.png')
        atlas.save(folder / 'atlas.webp', lossless=True)
        preview.save(folder / 'atlas-numbered.png')
        atlas_manifest[group] = {'image': f'{group}/atlas.png', 'cellSize': cell, 'cols': cols,
                                 'rows': rows, 'width': atlas.width, 'height': atlas.height, 'count': len(selected)}
        print(f'{group}: {len(selected)} icons; cell {cell}px; atlas {atlas.width}x{atlas.height}')
    save_json(catalog_path, catalog)
    save_json(OUT / 'manifest.json', {'version': 2, 'atlases': atlas_manifest,
                                    'scannedFiles': inventory['scanned'], 'icons': manifest_entries})
    # The previous combined exports are preserved in archive-v1, not active atlases.
    for name in ('atlas.png', 'atlas.webp', 'atlas-numbered.png'):
        previous = OUT / name
        if previous.exists() and (OUT / 'archive-v1' / name).exists():
            previous.unlink()
    print(f'{len(entries)} icons total; existing source PNG edits preserved.')
    subprocess.run([shutil.which('node') or 'C:/Program Files/nodejs/node.exe',
                    str(ROOT / 'scripts/sync-small-icons.mjs')], cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
