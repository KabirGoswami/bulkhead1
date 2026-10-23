"""Initial persistent household schema.

Revision ID: 0001
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Frozen schema belongs to this migration; later model edits cannot rewrite history.
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("initial_schema", Path(__file__).resolve().parents[1] / "schema_0001.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.metadata.create_all(bind=op.get_bind())


def downgrade():
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("initial_schema", Path(__file__).resolve().parents[1] / "schema_0001.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.metadata.drop_all(bind=op.get_bind())
