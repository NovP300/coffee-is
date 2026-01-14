from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "order-service"
    database_url: str
    menu_service_url: str
    rabbitmq_url: str

    model_config = SettingsConfigDict(env_file=None, extra="ignore")


settings = Settings()
