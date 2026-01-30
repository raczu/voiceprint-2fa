FROM ghcr.io/astral-sh/uv:python3.13-trixie-slim AS builder
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Omit development dependencies.
ENV UV_NO_DEV=1

# Configure python directory so it is consistent.
ENV UV_PYTHON_INSTALL_DIR=/python

# Only use the managed python version.
ENV UV_PYTHON_PREFERENCE=only-managed

WORKDIR /app

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project
COPY . /app

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

# Use a image without uv.
FROM debian:trixie-slim

RUN groupadd --system --gid 999 nonroot \
 && useradd --system --gid 999 --uid 999 --create-home nonroot

# Copy the python version.
COPY --from=builder --chown=python:python /python /python

# Copy the application from the builder.
COPY --from=builder --chown=nonroot:nonroot /app /app

# Set PATH to use executables from the virtual environment.
ENV PATH="/app/.venv/bin:$PATH"

RUN chmod +x /app/scripts/start.sh

# Switch to non-root user.
USER nonroot:nonroot

WORKDIR /app

CMD ["/app/scripts/start.sh"]