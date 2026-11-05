import os
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = Path(os.environ.get("COCHEF_DB", Path(__file__).resolve().parent.parent / "cochef.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False, "timeout": 30},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_columns(db, table: str, columns: dict[str, str]):
    """Add columns to an existing table if missing. columns maps name -> type."""
    cols = {r[1] for r in db.execute(text(f"PRAGMA table_info({table})")).fetchall()}
    for name, type_ in columns.items():
        if name not in cols:
            db.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {type_}"))


def run_migrations():
    """Lightweight migrations for schema changes on existing databases."""
    with SessionLocal() as db:
        # recipe.cuisine
        _add_columns(db, "recipes", {"cuisine": "VARCHAR(100)"})
        # events
        _add_columns(db, "events", {
            "currency": "VARCHAR(3) DEFAULT 'ILS'",
            "event_type": "VARCHAR(50)",
            "client_id": "INTEGER",
            "agreed_price": "FLOAT DEFAULT 0",
            "deposit_paid": "FLOAT DEFAULT 0",
            "invoice_number": "VARCHAR(50)",
            "invoice_date": "VARCHAR(10)",
        })
        # ingredients
        _add_columns(db, "ingredients", {
            "currency": "VARCHAR(3) DEFAULT 'ILS'",
            "aisle": "VARCHAR(100)",
            "substitution_group": "VARCHAR(100)",
        })
        _add_columns(db, "agents", {"parent_agent_id": "INTEGER"})
        # migrate legacy event statuses -> job lifecycle
        db.execute(text("UPDATE events SET status = 'confirmed' WHERE status = 'upcoming'"))
        # indexes for frequent query paths
        for ddl in (
            "CREATE INDEX IF NOT EXISTS idx_guest_segments_event_id ON guest_segments(event_id)",
            "CREATE INDEX IF NOT EXISTS idx_event_menu_items_lookup ON event_menu_items(event_id, recipe_id, segment_id)",
            "CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id)",
            "CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id)",
            "CREATE INDEX IF NOT EXISTS idx_price_book_ingredient_id ON price_book(ingredient_id)",
            "CREATE INDEX IF NOT EXISTS idx_pantry_holdings_ingredient_id ON pantry_holdings(ingredient_id)",
            "CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id ON agents(parent_agent_id)",
        ):
            db.execute(text(ddl))
        db.commit()
