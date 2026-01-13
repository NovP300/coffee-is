from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


def create_db_engine(database_url: str):
    # pool_pre_ping помогает переживать "засыпание" соединений
    return create_engine(database_url, pool_pre_ping=True)


def create_session_factory(engine):
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


def ping_db(engine) -> None:
    # простой запрос, чтобы проверить соединение
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
