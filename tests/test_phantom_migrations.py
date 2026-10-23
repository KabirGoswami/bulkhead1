"""Exercise the frozen migration operations on a disposable database only."""
import importlib.util
from pathlib import Path
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, create_mock_engine, inspect
from bulkhead.db import Base


def migration(name):
    path = Path(__file__).resolve().parents[1] / 'backend' / 'migrations' / 'versions' / name
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def test_sqlite_migration_round_trip_and_no_drift(tmp_path):
    engine = create_engine('sqlite:///' + str(tmp_path / 'migration.db'))
    initial, phantom = migration('0001_households.py'), migration('0002_phantom.py')
    with engine.begin() as connection:
        # Bind the migration context to the same transaction for both operations.
        with Operations.context(MigrationContext.configure(connection)):
            initial.upgrade(); phantom.upgrade()
            assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
            assert len([t for t in inspect(connection).get_table_names() if t.startswith('phantom_')]) == 8
            phantom.downgrade()
            assert not any(t.startswith('phantom_') for t in inspect(connection).get_table_names())
            assert 'households' in inspect(connection).get_table_names()
            phantom.upgrade()
            assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    engine.dispose()


def test_postgresql_ddl_compiles():
    statements = []
    engine = create_mock_engine('postgresql://', lambda sql, *a, **k: statements.append(str(sql.compile(dialect=engine.dialect))))
    metadata, tables = migration('0002_phantom.py').schema()
    metadata.create_all(engine, tables=tables)
    assert len([s for s in statements if 'CREATE TABLE' in s]) == 8
    assert any('UNIQUE (household_id, accepted_id)' in s for s in statements)
