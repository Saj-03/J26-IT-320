"""
Add columns that exist in the models but not yet in the database.

Why: tables are created with Base.metadata.create_all, which creates NEW tables but never
adds new COLUMNS to tables that already exist. When a model gets new fields, an older
database (e.g. the shared Neon database) is missing them and every query on that table fails.

Safe: only ADD COLUMN IF NOT EXISTS - nothing is dropped or changed. Existing rows get the
column's default value (or NULL when there is no simple default).

Run (from backend/):
  .venv\\Scripts\\python -m scripts.add_missing_columns          # dry run: only prints the SQL
  .venv\\Scripts\\python -m scripts.add_missing_columns --apply  # really changes the database
"""
import argparse

from sqlalchemy import inspect, text

import app.db.base  # noqa: F401  (registers every table)
from app.db.session import Base, engine


def default_sql(column) -> str:
    """'DEFAULT false' / 'DEFAULT 0' / "DEFAULT 'other'" for simple Python defaults, else ''."""
    d = column.default
    if d is None or not d.is_scalar:
        return ""
    value = d.arg
    if isinstance(value, bool):
        return f"DEFAULT {'true' if value else 'false'}"
    if isinstance(value, (int, float)):
        return f"DEFAULT {value}"
    if isinstance(value, str):
        return "DEFAULT '" + value.replace("'", "''") + "'"
    return ""


def missing_columns_sql() -> list[str]:
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    statements = []
    for name, table in Base.metadata.tables.items():
        if name not in existing_tables:
            continue                                     # create_all makes whole new tables
        have = {c["name"] for c in insp.get_columns(name)}
        for col in table.columns:
            if col.name in have:
                continue
            col_type = col.type.compile(dialect=engine.dialect)
            statements.append(f'ALTER TABLE {name} ADD COLUMN IF NOT EXISTS {col.name} {col_type} {default_sql(col)}'.strip())
    return statements


def main() -> None:
    parser = argparse.ArgumentParser(description="Add missing model columns to the database")
    parser.add_argument("--apply", action="store_true", help="really run the SQL (default: only print it)")
    args = parser.parse_args()

    print("Database:", engine.url.render_as_string(hide_password=True))
    statements = missing_columns_sql()
    if not statements:
        print("Nothing to do - every model column exists.")
        return
    for sql in statements:
        print(" ", sql)
    if not args.apply:
        print(f"\nDry run: {len(statements)} column(s) missing. Run again with --apply to add them.")
        return

    with engine.begin() as conn:                         # one transaction: all or nothing
        for sql in statements:
            conn.execute(text(sql))
    print(f"\nAdded {len(statements)} column(s).")


if __name__ == "__main__":
    main()
