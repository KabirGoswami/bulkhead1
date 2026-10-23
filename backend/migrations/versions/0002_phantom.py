"""PHANTOM simulated sensors, decisions, approval bindings and isolated demo runs."""
import importlib.util
from pathlib import Path
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def schema():
    spec = importlib.util.spec_from_file_location("phantom_schema", Path(__file__).resolve().parents[1] / "schema_0002.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.metadata, [t for t in module.metadata.sorted_tables if t.name.startswith("phantom_")]


def upgrade():
    metadata, tables = schema()
    metadata.create_all(bind=op.get_bind(), tables=tables)


def downgrade():
    metadata, tables = schema()
    metadata.drop_all(bind=op.get_bind(), tables=tables)
