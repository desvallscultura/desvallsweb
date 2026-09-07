#!/usr/bin/env python3
"""
update_versions.py
==================
Script de cache busting per a Desvalls Cultura.

Executa'l cada vegada que facis canvis al web abans de pujar els fitxers:
    python update_versions.py

Que fa:
  1. Calcula el hash MD5 real de cada fitxer CSS i JS local.
  2. Substitueix els ?v=... a tots els HTMLs pel hash actual.
     - Si el fitxer no ha canviat, el hash es el mateix -> la cache segueix valida.
     - Si el fitxer ha canviat, el hash es diferent -> el navegador el torna a descarregar.
  3. Afegeix les meta tags no-cache a les pagines que no les tinguin.
"""

import hashlib
import os
import re
from pathlib import Path

# ── Configuracio ──────────────────────────────────────────────────────────────
WEB_DIR = Path(__file__).parent

# Fitxers estatics per als quals calculem el hash
ASSETS = [
    "css/style.css",
    "js/main.js",
    "js/seo-schema.js",
]

# Pagines HTML a processar
HTML_FILES = list(WEB_DIR.glob("*.html"))

# Meta tags no-cache que han d'estar a totes les pagines
NO_CACHE_METAS = """\
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">"""

# ── Funcions ──────────────────────────────────────────────────────────────────

def md5_short(filepath: Path, length: int = 8) -> str:
    """Retorna els primers `length` caracters del hash MD5 del fitxer."""
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:length]


def compute_hashes() -> dict:
    """Retorna un diccionari {ruta_relativa: hash} per a cada asset."""
    hashes = {}
    for asset in ASSETS:
        asset_path = WEB_DIR / asset
        if asset_path.exists():
            hashes[asset] = md5_short(asset_path)
            print(f"  [ok] {asset}  ->  ?v={hashes[asset]}")
        else:
            print(f"  [--] {asset}  ->  fitxer no trobat, s'omet")
    return hashes


def update_asset_versions(html: str, hashes: dict) -> tuple:
    """Substitueix tots els ?v=... per el hash actual de cada asset."""
    changes = 0
    for asset, version in hashes.items():
        # Coincideix amb: href="css/style.css" o href="css/style.css?v=qualsevol"
        # També amb src="js/main.js" etc.
        pattern = rf'((?:href|src)="{re.escape(asset)})(?:\?v=[^"]*)?(")'
        new_ref = rf'\g<1>?v={version}\g<2>'
        new_html, n = re.subn(pattern, new_ref, html)
        if n:
            changes += n
            html = new_html
    return html, changes


def ensure_no_cache_metas(html: str) -> tuple:
    """Afegeix les meta tags no-cache just despres de <head> si no hi son."""
    if 'http-equiv="Cache-Control"' in html or "http-equiv='Cache-Control'" in html:
        return html, False  # ja les te

    # Insereix les metas just despres de la primera linia amb <meta charset...>
    charset_match = re.search(r'(<meta\s+charset[^>]+>)', html, re.IGNORECASE)
    if charset_match:
        insert_pos = charset_match.end()
        html = html[:insert_pos] + "\n" + NO_CACHE_METAS + html[insert_pos:]
    else:
        # Fallback: insereix just despres de <head>
        html = re.sub(r'(<head[^>]*>)', r'\1\n' + NO_CACHE_METAS, html, count=1, flags=re.IGNORECASE)

    return html, True


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 55)
    print("  Cache Busting - Desvalls Cultura")
    print("=" * 55)

    print("\n>> Calculant hashes dels assets...")
    hashes = compute_hashes()

    if not hashes:
        print("\n[!] Cap asset trobat. Comprova que els fitxers CSS/JS existeixen.")
        return

    print(f"\n>> Processant {len(HTML_FILES)} fitxers HTML...")
    total_asset_changes = 0
    total_meta_additions = 0

    for html_file in sorted(HTML_FILES):
        original = html_file.read_text(encoding="utf-8")

        updated, n_assets = update_asset_versions(original, hashes)
        updated, added_meta = ensure_no_cache_metas(updated)

        if updated != original:
            html_file.write_text(updated, encoding="utf-8")
            notes = []
            if n_assets:
                notes.append(f"{n_assets} versio(ns) d'asset")
            if added_meta:
                notes.append("meta no-cache afegida")
            print(f"  [mod] {html_file.name}  ->  {', '.join(notes)}")
            total_asset_changes += n_assets
            total_meta_additions += int(added_meta)
        else:
            print(f"  [ok]  {html_file.name}  (sense canvis)")

    print()
    print("=" * 55)
    print(f"  OK: {total_asset_changes} referencies d'asset actualitzades")
    print(f"  OK: {total_meta_additions} pagines amb meta no-cache afegida")
    print("=" * 55)
    print("\nConsell: puja els fitxers HTML JUNTAMENT amb els CSS/JS")
    print("modificats perque la versio sigui coherent.\n")


if __name__ == "__main__":
    main()
