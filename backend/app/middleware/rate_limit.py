import time
from collections import defaultdict, deque
from fastapi import Request, HTTPException

# Prosty in-memory rate limiter: 60 req / 60s per IP, burst 100
WINDOW = 60
MAX_REQUESTS = 60
BURST = 100

class RateLimitMiddleware:
    def __init__(self, app):
        self.app = app
        self.hits: dict[str, deque] = defaultdict(deque)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        # health check bez limitu
        path = scope.get("path", "")
        if path in ("/", "/docs", "/openapi.json", "/health"):
            await self.app(scope, receive, send)
            return
        # IP
        headers = dict(scope.get("headers", []))
        # X-Forwarded-For dla proxy
        xff = headers.get(b"x-forwarded-for")
        if xff:
            ip = xff.split(b",")[0].strip().decode(errors="ignore")
        else:
            ip = scope.get("client", ("unknown", 0))[0]
        now = time.time()
        q = self.hits[ip]
        # usun stare
        while q and q[0] <= now - WINDOW:
            q.popleft()
        if len(q) >= MAX_REQUESTS:
            # Burst allowance: pozwól do BURST ale z opóźnieniem? Tu twardy limit
            from starlette.responses import JSONResponse
            resp = JSONResponse({"detail": "Too Many Requests - rate limited"}, status_code=429)
            await resp(scope, receive, send)
            return
        q.append(now)
        await self.app(scope, receive, send)
