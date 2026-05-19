"""Convert Markdown to Jira Wiki Markup."""
from __future__ import annotations

import re


def md_to_jira(text: str) -> str:
    lines = text.split("\n")
    result: list[str] = []
    in_code_block = False
    code_lang = ""
    in_table = False  # tracks whether previous line was a table row

    for line in lines:
        # Code block toggle
        if line.strip().startswith("```"):
            if not in_code_block:
                code_lang = line.strip().removeprefix("```").strip()
                result.append("{code" + (f":{code_lang}" if code_lang else "") + "}")
                in_code_block = True
            else:
                result.append("{code}")
                in_code_block = False
                code_lang = ""
            in_table = False
            continue

        if in_code_block:
            result.append(line)
            continue

        converted, in_table = _convert_line(line, in_table)
        result.append(converted)

    return "\n".join(result)


def _convert_line(line: str, in_table: bool) -> tuple[str, bool]:
    """Convert a single markdown line. Returns (converted_line, in_table)."""
    # Headings: ## Heading -> h2. Heading
    m = re.match(r"^(#{1,6})\s+(.*)", line)
    if m:
        level = len(m.group(1))
        return f"h{level}. {m.group(2)}", False

    # Horizontal rule
    if re.match(r"^-{3,}\s*$", line):
        return "----", False

    # Table row: | ... |
    if re.match(r"^\|.*\|$", line.strip()):
        # Skip separator rows like |---|---|
        if re.match(r"^\|[\s\-:|]+\|$", line.strip()):
            return "", in_table
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        # First row of a table block → header
        if not in_table:
            return "|| " + " || ".join(_convert_inline(c) for c in cells) + " ||", True
        return "| " + " | ".join(_convert_inline(c) for c in cells) + " |", True

    # Unordered list: - item or * item -> * item (cap depth at 3)
    m = re.match(r"^(\s*)[-*]\s+(.*)", line)
    if m:
        indent = min(len(m.group(1)) // 2 + 1, 3)
        return f"{'*' * indent} {_convert_inline(m.group(2))}", False

    # Ordered list: convert to bullet points at the appropriate depth.
    # Jira nested numbered lists render as "1. 1. 1." which looks broken
    # in comments; bullet points are universally readable.
    m = re.match(r"^(\s*)\d+\.\s+(.*)", line)
    if m:
        indent = min(len(m.group(1)) // 2 + 1, 3)
        return f"{'*' * indent} {_convert_inline(m.group(2))}", False

    # Blockquote: > text -> bq. text
    m = re.match(r"^>\s?(.*)", line)
    if m:
        return f"bq. {_convert_inline(m.group(1))}", False

    return _convert_inline(line), False


def _convert_inline(text: str) -> str:
    # Bold: **text** -> *text*
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    # Italic: _text_ or *text* (single) -> _text_
    # Skip this to avoid conflicts with bold conversion
    # Inline code: `text` -> {{text}}
    text = re.sub(r"`([^`]+)`", r"{{\1}}", text)
    # Strikethrough: ~~text~~ -> -text-
    text = re.sub(r"~~(.+?)~~", r"-\1-", text)
    # Links: [text](url) -> [text|url]
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"[\1|\2]", text)
    # Images: ![alt](url) -> !url!
    text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r"!\2!", text)
    return text
