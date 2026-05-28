"""
Shared PostHog client for Pulse Python scripts.

Usage:
    from posthog_client import ph

    ph.capture("script_name", event="script_ran", properties={"key": "value"})
    ph.shutdown()
"""

import os

try:
    from posthog import Posthog

    _api_key = os.environ.get("POSTHOG_API_KEY", "")
    _host = os.environ.get("POSTHOG_HOST", "")

    ph = Posthog(project_api_key=_api_key, host=_host) if _api_key and _host else None

except ImportError:
    ph = None


def capture(distinct_id: str, event: str, properties: dict | None = None) -> None:
    if ph is None:
        return
    ph.capture(distinct_id=distinct_id, event=event, properties=properties or {})


def shutdown() -> None:
    if ph is not None:
        ph.shutdown()
