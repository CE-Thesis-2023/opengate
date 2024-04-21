import peewee as pw

from opengate.models import Event

SQL = pw.SQL


def migrate(migrator, database, fake=False, **kwargs):
    migrator.remove_fields(Event, ["plus_id"])


def rollback(migrator, database, fake=False, **kwargs):
    pass
