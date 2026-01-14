from uuid import UUID
import httpx

from app.core.settings import settings


class MenuClient:
    def __init__(self):
        self.base_url = settings.menu_service_url.rstrip("/")

    async def get_item(self, menu_item_id: UUID) -> dict:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{self.base_url}/items/{menu_item_id}")
            if r.status_code == 404:
                raise ValueError("Menu item not found")
            r.raise_for_status()
            return r.json()

