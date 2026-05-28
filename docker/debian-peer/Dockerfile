# Default: Debian. Override at build time for Ubuntu, e.g.:
#   docker compose build --build-arg BASE_IMAGE=ubuntu:24.04 ubuntu-peer
ARG BASE_IMAGE=debian:bookworm-slim
FROM ${BASE_IMAGE}

ARG CO21_DISTRO=debian
ENV CO21_DISTRO=${CO21_DISTRO}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        dnsutils \
        iproute2 \
        iputils-ping \
        netcat-openbsd \
        python3 \
        wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/co21-peer

COPY health-server.py entrypoint.sh ./
RUN sed -i 's/\r$//' entrypoint.sh health-server.py \
    && chmod +x entrypoint.sh

EXPOSE 9080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1:9080/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
