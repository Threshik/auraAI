"""
Phoenix LLM Observability
─────────────────────────
Auto-instruments every Azure OpenAI call (inputs, outputs, latency, token
counts) and sends OpenTelemetry traces to a Phoenix collector.

Phoenix server (run once, separately):
    docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix

Then open  http://localhost:6006  to browse traces.

Environment variables:
    PHOENIX_ENDPOINT   OTLP collector URL (default: http://localhost:6006/v1/traces)
    PHOENIX_PROJECT    Project name shown in Phoenix UI (default: ai-chat-platform)
    PHOENIX_ENABLED    Set to "false" to disable tracing (default: true)
"""

import logging
import os

logger = logging.getLogger(__name__)


def setup_phoenix() -> None:
    """Register Phoenix OTEL tracing and instrument the OpenAI client."""
    if os.getenv("PHOENIX_ENABLED", "true").lower() == "false":
        logger.info("Phoenix tracing disabled (PHOENIX_ENABLED=false)")
        return

    endpoint = os.getenv("PHOENIX_ENDPOINT", "http://localhost:6006/v1/traces")
    project  = os.getenv("PHOENIX_PROJECT", "ai-chat-platform")

    try:
        from phoenix.otel import register
        from openinference.instrumentation.openai import OpenAIInstrumentor

        tracer_provider = register(
            project_name=project,
            endpoint=endpoint,
        )
        OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)

        ui_url = endpoint.replace("/v1/traces", "")
        logger.info("🔭 Phoenix tracing active → project=%s  UI=%s", project, ui_url)

    except ImportError:
        logger.warning(
            "Phoenix packages missing — run: "
            "pip install arize-phoenix-otel openinference-instrumentation-openai"
        )
    except Exception as exc:
        # Phoenix server not running yet — traces will be dropped silently.
        # Start it with: docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix
        logger.warning("Phoenix tracing unavailable (%s) — continuing without it", exc)
