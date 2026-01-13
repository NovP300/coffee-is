from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "kitchen-service"
    database_url: str

    model_config = SettingsConfigDict(env_file=None, extra="ignore")


settings = Settings()
