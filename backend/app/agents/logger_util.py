"""
Safe logging utility for Windows console and file handlers.
Prevents charmap / UnicodeEncodeError crashes when models output emojis or special Unicode characters.
"""

import sys

# Force UTF-8 encoding on Windows console streams if supported
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def safe_print(*args, **kwargs) -> None:
    """
    Prints safely without raising UnicodeEncodeError (such as 'charmap' codec crashes on Windows).
    Falls back to backslashreplace/ascii escaping if console encoding rejects any character.
    """
    try:
        print(*args, **kwargs)
    except (UnicodeEncodeError, OSError):
        try:
            target_encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
            safe_args = []
            for a in args:
                if isinstance(a, str):
                    safe_args.append(
                        a.encode(target_encoding, errors="backslashreplace").decode(
                            target_encoding, errors="replace"
                        )
                    )
                else:
                    safe_args.append(a)
            print(*safe_args, **kwargs)
        except Exception:
            pass
    except Exception:
        pass
