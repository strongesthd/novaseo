#!/usr/bin/env python3
import os
import pathlib
import stat
import sys
import tempfile


KEYS = (b"DB_PASSWORD", b"REDIS_PASSWORD", b"JWT_SECRET", b"ENCRYPTION_KEY")


def normalize(path):
    if path.is_symlink():
        raise ValueError("Runtime environment file must not be a symlink")

    source = path.read_bytes()
    lines = source.splitlines(keepends=True)
    found = set()
    output = []
    changed = False

    for line in lines:
        content = line.rstrip(b"\r\n")
        ending = line[len(content):]
        key = next((item for item in KEYS if content.startswith(item + b"=")), None)
        if key is None:
            output.append(line)
            continue

        if key in found:
            raise ValueError(f"Duplicate {key.decode()} in runtime environment file")
        found.add(key)
        value = content[len(key) + 1:]
        if len(value) >= 2 and value.startswith(b"'") and value.endswith(b"'"):
            output.append(line)
            continue
        if (
            not value
            or value.startswith((b"'", b'"', b"#"))
            or value.endswith((b"'", b'"'))
            or b"'" in value
            or value != value.strip()
            or b" #" in value
            or b"\t#" in value
        ):
            raise ValueError(f"Cannot safely normalize {key.decode()} in runtime environment file")

        output.append(key + b"='" + value + b"'" + ending)
        changed = True

    missing = set(KEYS) - found
    if missing:
        names = ", ".join(key.decode() for key in sorted(missing))
        raise ValueError(f"Missing runtime environment keys: {names}")

    if not changed:
        return False

    info = path.stat()
    descriptor, temporary = tempfile.mkstemp(prefix=".env.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as target:
            target.write(b"".join(output))
            target.flush()
            os.fsync(target.fileno())
        os.chmod(temporary, stat.S_IRUSR | stat.S_IWUSR)
        if (
            hasattr(os, "chown")
            and hasattr(os, "geteuid")
            and (info.st_uid, info.st_gid) != (os.geteuid(), os.getegid())
        ):
            os.chown(temporary, info.st_uid, info.st_gid)
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
    return True


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: normalize-production-env.py <env-file>")

    try:
        changed = normalize(pathlib.Path(sys.argv[1]))
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from error

    if changed:
        print("Normalized runtime secret quoting without changing secret values")


if __name__ == "__main__":
    main()
