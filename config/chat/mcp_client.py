"""MCP bridge: expose safe MCP tools to llama.cpp and execute requested calls."""

import asyncio
import json

from django.conf import settings
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from .llm import LLMServiceError, chat_completion

MAX_TOOL_ROUNDS = 4
MAX_TOOL_RESULT_CHARS = 14000
DISABLED_TOOLS = {"update_config"}  # Keep model requests from changing MCP server configuration.


class MCPServiceError(Exception):
    """Raised when the MCP endpoint cannot be reached or initialized."""


def _as_openai_tool(tool):
    schema = tool.inputSchema or {"type": "object", "properties": {}}
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": (tool.description or f"MCP tool {tool.name}")[:2000],
            "parameters": schema,
        },
    }


def _tool_result_text(result):
    structured = getattr(result, "structuredContent", None)
    if structured is not None:
        text = json.dumps(structured, ensure_ascii=False, default=str)
    else:
        bits = []
        for item in (getattr(result, "content", None) or []):
            if getattr(item, "text", None) is not None:
                bits.append(item.text)
            else:
                bits.append(str(item))
        text = "\n".join(bits) or "The tool returned no content."
    if getattr(result, "isError", False):
        text = "MCP tool error: " + text
    return text[:MAX_TOOL_RESULT_CHARS]


def _message_text(content):
    if isinstance(content, str):
        return content
    if content is None:
        return ""
    if isinstance(content, list):
        return "\n".join(
            str(part.get("text", "")) if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content)


async def _chat_with_mcp(messages):
    mcp_url = getattr(settings, "MCP_SERVER_URL", "http://127.0.0.1:8000/mcp")
    tools_used = []

    try:
        async with streamable_http_client(mcp_url) as (read_stream, write_stream, _session_id):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                discovered = await session.list_tools()
                available = [t for t in discovered.tools if t.name not in DISABLED_TOOLS]
                tool_by_name = {t.name: t for t in available}
                openai_tools = [_as_openai_tool(t) for t in available]

                for _ in range(MAX_TOOL_ROUNDS):
                    assistant_message = chat_completion(messages, tools=openai_tools)
                    tool_calls = assistant_message.get("tool_calls") or []
                    if not tool_calls:
                        answer = _message_text(assistant_message.get("content")).strip()
                        return {"response": answer or "The model returned an empty response.", "tools_used": tools_used}

                    # Preserve the assistant tool-call message for the next model turn.
                    messages.append({
                        "role": "assistant",
                        "content": assistant_message.get("content"),
                        "tool_calls": tool_calls,
                    })

                    for tool_call in tool_calls:
                        call_id = tool_call.get("id", "")
                        function = tool_call.get("function") or {}
                        tool_name = function.get("name", "")
                        raw_arguments = function.get("arguments", "{}")
                        try:
                            arguments = raw_arguments if isinstance(raw_arguments, dict) else json.loads(raw_arguments or "{}")
                            if not isinstance(arguments, dict):
                                raise ValueError("Tool arguments must be a JSON object.")
                            if tool_name in DISABLED_TOOLS or tool_name not in tool_by_name:
                                raise ValueError("Requested tool is unavailable.")
                            result = await session.call_tool(tool_name, arguments)
                            result_text = _tool_result_text(result)
                            if tool_name not in tools_used:
                                tools_used.append(tool_name)
                        except Exception as exc:
                            # Return a controlled tool error to the model instead of crashing the chat request.
                            result_text = json.dumps({"error": "Tool call failed", "reason": str(exc)[:500]})

                        messages.append({
                            "role": "tool",
                            "tool_call_id": call_id,
                            "content": result_text,
                        })

                # Avoid endless tool-calling loops: ask for a final answer without further tools.
                final_message = chat_completion(messages, tools=None)
                answer = _message_text(final_message.get("content")).strip()
                return {"response": answer or "I could not produce a final answer after using the available tools.", "tools_used": tools_used}
    except LLMServiceError:
        raise
    except Exception as exc:
        raise MCPServiceError("Could not connect to or use the data.gov.in MCP server.") from exc


def chat_with_mcp(messages):
    """Synchronous entry point for the normal synchronous Django REST view."""
    return asyncio.run(_chat_with_mcp(messages))
