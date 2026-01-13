from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "auth-service"
    database_url: str

    jwt_secret: str
    jwt_alg: str = "HS256"

    model_config = SettingsConfigDict(env_file=None, extra="ignore")


settings = Settings()
