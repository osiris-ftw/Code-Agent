FROM ubuntu:22.04
LABEL cloudcodex=true

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    coreutils \
    curl \
    wget \
    git \
    vim \
    nano \
    less \
    grep \
    sed \
    gawk \
    jq \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash codeuser \
    && mkdir -p /home/codeuser/workspace \
    && chown -R codeuser:codeuser /home/codeuser

WORKDIR /home/codeuser/workspace
USER codeuser
ENV TERM=xterm-256color

CMD ["bash"]
