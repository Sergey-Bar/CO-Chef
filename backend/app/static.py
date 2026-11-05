from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException


class SPAStaticFiles(StaticFiles):
    """Serve client routes without masking missing API endpoints or assets."""

    async def get_response(self, path, scope):
        path = path.replace("\\", "/").lstrip("/")
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404)
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or scope["method"] not in {"GET", "HEAD"}:
                raise
            if "." in path.rsplit("/", 1)[-1] or path.startswith("assets/"):
                raise
            return await super().get_response("index.html", scope)
