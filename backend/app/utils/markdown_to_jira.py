"""Convert Markdown to Jira Wiki Markup."""
from __future__ import annotations

import re


def md_to_jira(text: str) -> str:
    lines = text.split("\n")
    result: list[str] = []
    in_code_block = False
    code_lang = ""

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
            continue

        if in_code_block:
            result.append(line)
            continue

        converted = _convert_line(line)
        result.append(converted)

    return "\n".join(result)


def _convert_line(line: str) -> str:
    # Headings: ## Heading -> h2. Heading
    m = re.match(r"^(#{1,6})\s+(.*)", line)
    if m:
        level = len(m.group(1))
        return f"h{level}. {m.group(2)}"

    # Horizontal rule
    if re.match(r"^-{3,}\s*$", line):
        return "----"

    # Table header row: | H1 | H2 | -> || H1 || H2 ||
    if re.match(r"^\|.*\|$", line.strip()):
        # Skip separator rows like |---|---|
        if re.match(r"^\|[\s\-:|]+\|$", line.strip()):
            return ""
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        # Detect header row (usually first row or bold content)
        return _convert_table_row(cells, line)

    # Unordered list: - item or * item -> * item
    m = re.match(r"^(\s*)[-*]\s+(.*)", line)
    if m:
        indent = len(m.group(1)) // 2 + 1
        return f"{'*' * indent} {_convert_inline(m.group(2))}"

    # Ordered list: 1. item -> # item
    m = re.match(r"^(\s*)\d+\.\s+(.*)", line)
    if m:
        indent = len(m.group(1)) // 2 + 1
        return f"{'#' * indent} {_convert_inline(m.group(2))}"

    # Blockquote: > text -> {quote}text{quote}
    m = re.match(r"^>\s?(.*)", line)
    if m:
        return f"bq. {_convert_inline(m.group(1))}"

    return _convert_inline(line)


_table_context: dict[str, bool] = {"first_row": True}


def _convert_table_row(cells: list[str], raw_line: str) -> str:
    # Simple heuristic: if it's the first table row we see, treat as header
    # Reset context on empty lines (handled by caller patterns)
    if not hasattr(_convert_table_row, "_prev_was_table"):
        _convert_table_row._prev_was_table = False  # type: ignore[attr-defined]

    is_header = not _convert_table_row._prev_was_table  # type: ignore[attr-defined]
    _convert_table_row._prev_was_table = True  # type: ignore[attr-defined]

    if is_header:
        return "|| " + " || ".join(_convert_inline(c) for c in cells) + " ||"
    return "| " + " | ".join(_convert_inline(c) for c in cells) + " |"


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
