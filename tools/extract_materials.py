#!/usr/bin/env python3
"""Verify catalogued originals and regenerate their searchable text copies."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
W = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
A = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}


def inside_repo(value: str) -> Path:
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError(f'Path leaves repository: {value}')
    return path


def extract(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == '.docx':
        with ZipFile(path) as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
        return '\n'.join(
            ''.join(node.text or '' for node in para.findall('.//w:t', W))
            for para in root.findall('.//w:p', W)
        ).strip() + '\n'
    if suffix == '.pptx':
        output = []
        with ZipFile(path) as archive:
            slides = [name for name in archive.namelist()
                      if name.startswith('ppt/slides/slide') and name.endswith('.xml')]
            slides.sort(key=lambda name: int(name.rsplit('slide', 1)[1].split('.')[0]))
            for number, name in enumerate(slides, 1):
                root = ET.fromstring(archive.read(name))
                output.append(f'\nSLIDE {number}\n' + '\n'.join(
                    node.text or '' for node in root.findall('.//a:t', A)))
        return '\n'.join(output).strip() + '\n'
    if suffix == '.pdf':
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise SystemExit('PDF extraction needs: python -m pip install -r requirements-docs.txt') from exc
        return '\n'.join(f'\nPAGE {index}\n{page.extract_text() or ""}'
                         for index, page in enumerate(PdfReader(path).pages, 1)).strip() + '\n'
    raise ValueError(f'Unsupported text extraction format: {suffix}')


def main() -> None:
    catalog = json.loads((ROOT / 'materials/catalog.json').read_text(encoding='utf-8'))
    sources = catalog['sources']
    # Check every original before writing any derived file.
    for item in sources:
        path = inside_repo(item['path'])
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item['sha256']:
            raise SystemExit(f'Original differs from catalog: {item["path"]}')
    for item in sources:
        if not item.get('textPath'):
            continue
        source, destination = inside_repo(item['path']), inside_repo(item['textPath'])
        destination.parent.mkdir(parents=True, exist_ok=True)
        text = '\n'.join(line.rstrip() for line in extract(source).splitlines()) + '\n'
        destination.write_text(text, encoding='utf-8')
        print(f'{item["id"]}: {item["textPath"]}')


if __name__ == '__main__':
    main()
