"""Add only nullable exchange timestamps. No backfill or data updates."""
from sqlalchemy import inspect, text


def migrate_exchange_timestamps(engine):
    with engine.connect() as connection:
        mysql = engine.dialect.name == "mysql"
        if mysql and connection.execute(text("SELECT GET_LOCK('bookspins_exchange_22', 60)")).scalar() != 1:
            raise RuntimeError("Could not acquire exchange migration lock.")
        try:
            existing = {column["name"] for column in inspect(connection).get_columns("book_requests")}
            for name in ("accepted_at", "declined_at", "cancelled_at", "completed_at"):
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE book_requests ADD COLUMN {name} DATETIME NULL"))
            connection.commit()
        finally:
            if mysql:
                connection.execute(text("SELECT RELEASE_LOCK('bookspins_exchange_22')"))
