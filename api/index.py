"""Vercel entry point for the same Gemini features used by localhost."""
import json
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from local_server import (
    ApiError, Handler, MAX_BODY, MAX_CHAT_BODY,
    analysis_scope, chat, custom_analysis, insights, repair,
)


ROUTES = {
    "insights": insights,
    "chat": chat,
    "repair": repair,
    "scope": analysis_scope,
    "custom-analysis": custom_analysis,
}


class handler(Handler):
    def do_GET(self):
        self.reply(405, {"error": "API yêu cầu phương thức POST."})

    do_HEAD = do_GET

    def do_POST(self):
        url = urlsplit(self.path)
        feature = parse_qs(url.query).get("feature", [url.path.rsplit("/", 1)[-1]])[0]
        route = ROUTES.get(feature)
        if route is None:
            self.reply(404, {"error": "Không tìm thấy API."})
            return
        try:
            host = self.headers.get("Host", "")
            if not host or self.headers.get("Origin") not in (None, f"https://{host}"):
                raise ApiError(403, "Yêu cầu phải đến từ trang web này.")
            if self.headers.get_content_type() != "application/json":
                raise ApiError(415, "Yêu cầu phải dùng JSON.")
            size = int(self.headers.get("Content-Length", "0"))
            limit = MAX_CHAT_BODY if route is chat else MAX_BODY
            if not 0 < size <= limit:
                raise ApiError(400, "Kích thước yêu cầu không hợp lệ.")
            self.connection.settimeout(10)
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError("Expected a JSON object")
            self.reply(200, route(body))
        except ApiError as exc:
            self.reply(exc.status, {"error": str(exc)})
        except (ValueError, OverflowError, TimeoutError):
            self.reply(400, {"error": "Dữ liệu yêu cầu không hợp lệ."})
