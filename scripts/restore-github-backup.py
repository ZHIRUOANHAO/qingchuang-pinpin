"""Verify downloaded GitHub backup parts and combine them without overwriting files."""

import argparse
import hashlib
import json
from pathlib import Path, PureWindowsPath


def safe_name(value):
    if not isinstance(value, str) or not value or Path(value).name != value or PureWindowsPath(value).name != value or value in {".", ".."} or ":" in value:
        raise ValueError("Manifest names must be simple file names")
    return value


def sha256(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def restore(manifest_path):
    manifest_path = manifest_path.resolve()
    root = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    if manifest.get("format") != "raw-concatenation-in-listed-order":
        raise ValueError("Unsupported archive format")
    results = []
    for archive in manifest["archives"]:
        output = root / safe_name(archive["output"])
        if output.exists():
            if output.stat().st_size == archive["bytes"] and sha256(output) == archive["sha256"]:
                results.append({"file": output.name, "verified": True, "alreadyPresent": True})
                continue
            raise FileExistsError(f"Different existing file preserved: {output.name}")
        parts = []
        for part in archive["parts"]:
            path = root / safe_name(part["name"])
            if path.stat().st_size != part["bytes"] or sha256(path) != part["sha256"]:
                raise ValueError(f"Part checksum mismatch: {path.name}")
            parts.append(path)
        partial = output.with_name(output.name + ".partial")
        whole = hashlib.sha256()
        with partial.open("xb") as target:
            for part in parts:
                with part.open("rb") as source:
                    while chunk := source.read(1024 * 1024):
                        target.write(chunk)
                        whole.update(chunk)
        if partial.stat().st_size != archive["bytes"] or whole.hexdigest() != archive["sha256"]:
            raise ValueError(f"Combined archive failed verification; partial file preserved: {partial.name}")
        if output.exists():
            raise FileExistsError(f"Output appeared during restore; files preserved: {output.name}")
        partial.rename(output)
        results.append({"file": output.name, "verified": True, "alreadyPresent": False})
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", nargs="?", default="archive-parts.json")
    args = parser.parse_args()
    print(json.dumps(restore(Path(args.manifest)), ensure_ascii=False, indent=2))
