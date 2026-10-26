"""Create a verified, deduplicated upload copy without changing original backups."""

import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DATE = "2026-10-26"
PRIVATE_NAMES = {
    "project.private.config.json", ".npmrc", ".pypirc", "credentials.json",
    "credentials", "cookies.json", "cookies.sqlite", "storage-state.json",
    "auth.json", "token.json", "tokens.json", "id_rsa", "id_ed25519",
}


def digest(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def project_path(value):
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT) or path == ROOT:
        raise ValueError(f"Path must remain inside project: {value}")
    return path


def private_path(value):
    parts = PurePosixPath(value.replace("\\", "/")).parts
    if any(part.lower() in {".git", ".openai", "node_modules"} for part in parts):
        return True
    name = parts[-1].lower() if parts else ""
    return (name in PRIVATE_NAMES or name == ".env" or
            (name.startswith(".env.") and name != ".env.example") or
            name.endswith((".pem", ".p12", ".pfx", ".key")))


def inspect_zip(path):
    excluded = []
    with zipfile.ZipFile(path) as source:
        for info in source.infolist():
            member = PurePosixPath(info.filename.replace("\\", "/"))
            if member.is_absolute() or ".." in member.parts or re.match(r"^[A-Za-z]:", str(member)):
                raise ValueError(f"Unsafe ZIP member in {path.name}")
            if private_path(info.filename):
                excluded.append(info.filename)
        if not excluded:
            return None, []
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as cleaned:
            for info in source.infolist():
                if info.filename not in excluded:
                    cleaned.writestr(info, source.read(info))
        with zipfile.ZipFile(io.BytesIO(output.getvalue())) as cleaned:
            if cleaned.testzip() is not None:
                raise ValueError(f"Sanitized ZIP failed integrity: {path.name}")
        return output.getvalue(), excluded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", default=f"output/backup-audit-{DATE}/inventory.json")
    parser.add_argument("--outdir", default=f"output/github-backup-{DATE}")
    args = parser.parse_args()
    inventory_path = project_path(args.inventory)
    outdir = project_path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    inventory = json.loads(inventory_path.read_text(encoding="utf-8-sig"))
    archive_name = f"historical-backups-{DATE}.zip"
    archive_path = outdir / archive_name
    if archive_path.exists():
        raise FileExistsError(f"Existing archive preserved: {archive_path}")
    records, by_hash, expected_members = [], {}, {}
    entries = sorted(inventory["files"], key=lambda item: item["relativePath"])
    source_paths = set()
    with zipfile.ZipFile(archive_path, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for index, entry in enumerate(entries, 1):
            relative = entry["relativePath"]
            if relative in source_paths:
                raise ValueError(f"Duplicate inventory path: {relative}")
            source_paths.add(relative)
            path = project_path(relative)
            if path.is_relative_to(outdir):
                raise ValueError("Cannot archive the output directory itself")
            actual_hash = digest(path)
            if actual_hash.lower() != entry["sha256"].lower() or path.stat().st_size != entry["bytes"]:
                raise ValueError(f"Source changed after inventory: {relative}")
            record = {
                "source": relative, "root": entry.get("root"),
                "sourceBytes": entry["bytes"], "sourceSha256": actual_hash,
                "status": "included", "archiveRelativePath": None,
                "bytes": entry["bytes"], "sha256": actual_hash,
                "sanitized": False, "excludedEntries": [], "duplicateOf": None,
            }
            if private_path(relative):
                record.update(status="excluded", reason="machine-private-configuration")
                records.append(record)
                continue
            cleaned = None
            if path.suffix.lower() == ".zip":
                cleaned, excluded = inspect_zip(path)
                if cleaned is not None:
                    record.update(sanitized=True, excludedEntries=excluded, bytes=len(cleaned), sha256=hashlib.sha256(cleaned).hexdigest())
            elif entry.get("flags"):
                raise ValueError(f"Flagged file requires explicit handling: {relative}")
            previous = by_hash.get(record["sha256"])
            if previous:
                record.update(status="duplicate", duplicateOf=previous["source"], archiveRelativePath=previous["archiveRelativePath"])
            else:
                member = "files/" + relative.replace("\\", "/")
                record["archiveRelativePath"] = member
                if cleaned is not None:
                    archive.writestr(member, cleaned)
                else:
                    with path.open("rb") as source, archive.open(member, "w", force_zip64=True) as target:
                        shutil.copyfileobj(source, target, 1024 * 1024)
                expected_members[member] = record["sha256"]
                by_hash[record["sha256"]] = record
            records.append(record)
            if index % 100 == 0:
                print(f"Prepared {index}/{len(entries)} inventory files", flush=True)
        catalog = {
            "version": "0.1", "last_updated": DATE,
            "inventorySha256": digest(inventory_path),
            "archive": archive_name,
            "summary": {
                "sourceFiles": len(records),
                "sourceBytes": sum(item["sourceBytes"] for item in records),
                "includedUniqueFiles": sum(item["status"] == "included" for item in records),
                "duplicateFiles": sum(item["status"] == "duplicate" for item in records),
                "excludedFiles": sum(item["status"] == "excluded" for item in records),
                "sanitizedFiles": sum(item["sanitized"] for item in records),
            },
            "roots": inventory.get("roots", []),
            "independentRepos": inventory.get("independentRepos", []),
            "files": records,
        }
        catalog_bytes = json.dumps(catalog, ensure_ascii=False, indent=2).encode("utf-8") + b"\n"
        archive.writestr("catalog.json", catalog_bytes)
        expected_members["catalog.json"] = hashlib.sha256(catalog_bytes).hexdigest()
    print("Verifying ZIP CRC and every archived file SHA256", flush=True)
    with zipfile.ZipFile(archive_path) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError(f"ZIP integrity failed: {bad}")
        if set(archive.namelist()) != set(expected_members) or len(archive.namelist()) != len(expected_members):
            raise ValueError("Archive member list mismatch")
        for member, expected_hash in expected_members.items():
            with archive.open(member) as handle:
                if hashlib.file_digest(handle, "sha256").hexdigest() != expected_hash:
                    raise ValueError(f"Archived hash mismatch: {member}")
    catalog["artifact"] = {"name": archive_name, "bytes": archive_path.stat().st_size, "sha256": digest(archive_path), "verifiedMembers": len(expected_members)}
    (outdir / "index.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # The controller adds repository bundles and regenerates this list before upload.
    (outdir / "SHA256SUMS.txt").write_text(f"{catalog['artifact']['sha256']}  {archive_name}\n", encoding="ascii")
    print(json.dumps({"summary": catalog["summary"], "artifact": catalog["artifact"]}, ensure_ascii=True), flush=True)


if __name__ == "__main__":
    main()
