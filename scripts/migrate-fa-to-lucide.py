#!/usr/bin/env python3
"""
Font Awesome → lucide-react migration script
Replaces <i className="fa-solid fa-iconname rest"> with <LucideName className="rest" />
"""

import os
import re
import json
import sys
from pathlib import Path

# Load mapping
script_dir = Path(__file__).parent
with open(script_dir / 'fa-lucide-map.json') as f:
    FA_MAP = json.load(f)

# Track stats
files_changed = 0
icons_replaced = 0
unmapped_icons = set()
skipped_dynamic = 0

def lucide_to_class(name):
    """Convert LucideName to kebab-case for no-op check"""
    return name

def get_lucide_name(fa_name):
    """Look up FA icon name in the mapping"""
    # Strip fa- prefix if present
    name = fa_name.replace('fa-', '') if fa_name.startswith('fa-') else fa_name
    return FA_MAP.get(name)

def process_static_i_tag(match, source_file):
    """Process a static <i className="fa-..."> tag"""
    global icons_replaced, unmapped_icons

    full_match = match.group(0)
    class_str = match.group(1)

    # Skip dynamic template literals (contain ${...})
    if '${' in class_str:
        return None  # Signal to skip

    classes = class_str.split()

    # Identify FA prefix class (fa-solid, fa-regular, fa-brands)
    fa_type = None
    fa_icon = None
    other_classes = []
    has_spin = False

    for cls in classes:
        if cls in ('fa-solid', 'fa-regular', 'fa-brands', 'fa-light', 'fa-thin', 'fa-duotone'):
            fa_type = cls
        elif cls == 'fa-spin':
            has_spin = True
        elif cls.startswith('fa-'):
            fa_icon = cls[3:]  # Strip fa- prefix
        else:
            other_classes.append(cls)

    if not fa_icon:
        return None  # No icon name found, skip

    lucide_name = get_lucide_name(fa_icon)

    if not lucide_name:
        unmapped_icons.add(fa_icon)
        return None  # Can't map, skip

    # Build className for the Lucide component
    if has_spin:
        other_classes.append('animate-spin')

    # Build the Lucide JSX
    if other_classes:
        class_attr = f' className="{" ".join(other_classes)}"'
    else:
        class_attr = ''

    icons_replaced += 1
    return f'<{lucide_name}{class_attr} />'

def add_lucide_import(content, icons_needed):
    """Add or merge lucide-react import"""
    if not icons_needed:
        return content

    existing_import_pattern = re.compile(
        r"import\s*\{([^}]+)\}\s*from\s*['\"]lucide-react['\"]"
    )

    existing_match = existing_import_pattern.search(content)

    if existing_match:
        # Merge with existing import
        existing_icons = set(i.strip() for i in existing_match.group(1).split(',') if i.strip())
        all_icons = existing_icons | icons_needed
        sorted_icons = sorted(all_icons)
        new_import = f"import {{ {', '.join(sorted_icons)} }} from 'lucide-react'"
        content = content[:existing_match.start()] + new_import + content[existing_match.end():]
    else:
        # Add new import after last existing import or at top
        sorted_icons = sorted(icons_needed)
        new_import_line = f"import {{ {', '.join(sorted_icons)} }} from 'lucide-react';\n"

        # Find the last import statement
        last_import = None
        for m in re.finditer(r'^import\s+.*?;?\s*$', content, re.MULTILINE):
            last_import = m

        if last_import:
            insert_pos = last_import.end()
            content = content[:insert_pos] + '\n' + new_import_line + content[insert_pos:]
        else:
            content = new_import_line + content

    return content

def process_file(filepath):
    global files_changed, skipped_dynamic

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    icons_needed = set()

    # Pattern: <i className="...fa-..." ...></i> or <i className="...fa-..." ... />
    # Handle both self-closing and separate closing tag
    pattern = re.compile(
        r'<i\s+className=["\']((?:[^"\']*fa-[^"\']*))["\']\s*(?:[^>]*)?>(?:</i>)?',
        re.DOTALL
    )

    # Also handle <i className={`...`}> (template literals) - skip these
    template_pattern = re.compile(
        r'<i\s+className=\{`[^`]*`\}\s*(?:[^>]*)?>(?:</i>)?'
    )

    # And className={`...`} with braces
    brace_template_pattern = re.compile(
        r'<i\s+className=\{[^}]*fa-[^}]*\}\s*(?:[^>]*)?>(?:</i>)?'
    )

    def replace_match(match):
        result = process_static_i_tag(match, filepath)
        if result is None:
            return match.group(0)  # Keep original

        # Track which icon component was used
        # Extract lucide name from result
        lucide_match = re.match(r'<(\w+)', result)
        if lucide_match:
            icons_needed.add(lucide_match.group(1))

        return result

    # Process template literal patterns (mark as skip)
    template_matches = list(template_pattern.finditer(content))
    brace_matches = list(brace_template_pattern.finditer(content))
    skipped_dynamic += len(template_matches) + len(brace_matches)

    # Now do the static replacements
    new_content = pattern.sub(replace_match, content)

    # If anything changed, add the imports
    if new_content != content or icons_needed:
        new_content = add_lucide_import(new_content, icons_needed)

    if new_content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        files_changed += 1
        return True

    return False

def main():
    src_dir = Path('/f/pulse1/src')

    if not src_dir.exists():
        src_dir = Path('f:/pulse1/src')

    if not src_dir.exists():
        print("ERROR: Could not find src directory")
        sys.exit(1)

    print(f"Scanning {src_dir}...")

    tsx_files = list(src_dir.rglob('*.tsx'))
    print(f"Found {len(tsx_files)} TSX files")

    for i, filepath in enumerate(tsx_files):
        changed = process_file(filepath)
        if changed and (i % 20 == 0):
            print(f"  Progress: {i+1}/{len(tsx_files)}, changed {files_changed} so far...")

    print(f"\n=== MIGRATION COMPLETE ===")
    print(f"Files changed: {files_changed}")
    print(f"Icons replaced: {icons_replaced}")
    print(f"Dynamic patterns skipped: {skipped_dynamic}")

    if unmapped_icons:
        print(f"\nUnmapped icons ({len(unmapped_icons)}):")
        for icon in sorted(unmapped_icons):
            print(f"  - {icon}")

if __name__ == '__main__':
    main()
