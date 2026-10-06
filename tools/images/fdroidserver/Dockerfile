FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive

RUN \
    install -v -d -o ubuntu -g ubuntu /opt/venv && \
    apt-get update && \
    apt-get install -y --no-install-recommends --allow-remove-essential \
        aria2 curl git gnupg socat \
        patch publicsuffix ssh-client \
        busybox less nano vim xxd \
        coreutils-from-uutils- coreutils-from-gnu \
        python3-venv

RUN \
    apt-get install -y \
        default-jdk-headless default-jre-headless && \
    apt-get install -y \
        fdroidserver

WORKDIR /opt/venv
USER ubuntu
RUN python3 -m venv fdroidserver-env && \
    . ./fdroidserver-env/bin/activate && \
    pip install --upgrade pip uv && \
    uv pip install git+https://gitlab.com/fdroid/fdroidserver.git

USER root
WORKDIR /

