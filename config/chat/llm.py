"""Small OpenAI-compatible client for a local llama.cpp server."""

import requests
from django.conf import settings


class LLMServiceError(Exception):
    """Raised when llama.cpp cannot return a valid completion."""


def chat_completion(messages, tools=None):
    base_url = getattr(settings, "LLAMA_CPP_BASE_URL", "http://127.0.0.1:2001/v1").rstrip("/")
    model = getattr(settings, "LLAMA_CPP_MODEL", "local-model")
    timeout = getattr(settings, "LLAMA_CPP_TIMEOUT_SECONDS", 120)

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "stream": False,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            json=payload,
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError) as exc:
        raise LLMServiceError("Could not get a valid response from the llama.cpp server.") from exc
