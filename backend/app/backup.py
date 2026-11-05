"""Create consistent SQLite snapshots, including committed journal contents."""
import sqlite3
from contextlib import closing
from pathlib import Path


def backup_database(source: Path, destination: Path):
    with closing(sqlite3.connect(f"{source.resolve().as_uri()}?mode=ro", uri=True)) as src:
        with closing(sqlite3.connect(destination)) as dst:
            src.backup(dst)


if __name__ == "__main__":
    from datetime import datetime
    from .database import DB_PATH

    if DB_PATH.exists():
        folder = DB_PATH.parent / "backups"
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"cochef-{datetime.now():%Y%m%d-%H%M%S-%f}.db"
        backup_database(DB_PATH, target)
        print(f"Backup saved: {target}")
