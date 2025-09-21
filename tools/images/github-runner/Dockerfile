#FROM nestybox/ubuntu-focal-systemd-docker
FROM ubuntu:20.04

RUN dpkg --add-architecture i386

RUN set -xe && \
    echo '#!/bin/sh' > /usr/sbin/policy-rc.d && \
    echo 'exit 101' >> /usr/sbin/policy-rc.d && \
    chmod +x /usr/sbin/policy-rc.d && \
    dpkg-divert --local --rename --add /sbin/initctl && \
    cp -a /usr/sbin/policy-rc.d /sbin/initctl && \
    sed -i 's/^exit.*/exit 0/' /sbin/initctl && \
    echo 'force-unsafe-io' > /etc/dpkg/dpkg.cfg.d/docker-apt-speedup && \
    echo 'DPkg::Post-Invoke { "rm -f /var/cache/apt/archives/*.deb /var/cache/apt/archives/partial/*.deb /var/cache/apt/*.bin || true"; };' > /etc/apt/apt.conf.d/docker-clean && \
    echo 'APT::Update::Post-Invoke { "rm -f /var/cache/apt/archives/*.deb /var/cache/apt/archives/partial/*.deb /var/cache/apt/*.bin || true"; };' >> /etc/apt/apt.conf.d/docker-clean && \
    echo 'Dir::Cache::pkgcache ""; Dir::Cache::srcpkgcache "";' >> /etc/apt/apt.conf.d/docker-clean && \
    echo 'Acquire::Languages "none";' > /etc/apt/apt.conf.d/docker-no-languages && \
    echo 'Acquire::GzipIndexes "true"; Acquire::CompressionTypes::Order:: "gz";' > /etc/apt/apt.conf.d/docker-gzip-indexes && \
    echo 'Apt::AutoRemove::SuggestsImportant "false";' > /etc/apt/apt.conf.d/docker-autoremove-suggests

RUN mkdir -p /run/systemd && echo 'docker' > /run/systemd/container

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      systemd systemd-sysv libsystemd0 ca-certificates dbus \
      iptables iproute2 kmod locales sudo udev socat && \
    echo "ReadKMsg=no" >> /etc/systemd/journald.conf && \
    apt-get clean -y && \
    rm -rf /var/cache/debconf/* /var/lib/apt/lists/* /var/log/* /tmp/* /var/tmp/* \
           /usr/share/doc/* /usr/share/man/* /usr/share/local/* && \
    useradd --create-home --shell /bin/bash admin && \
    echo "admin:admin" | chpasswd && \
    adduser admin sudo

STOPSIGNAL SIGRTMIN+3

RUN apt-get update && \
    apt-get install --no-install-recommends -y apt-transport-https ca-certificates \
      curl gnupg-agent software-properties-common && \
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add - && \
    apt-key fingerprint 0EBFCD88 && \
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" && \
    apt-get update && apt-get install --no-install-recommends -y docker-ce docker-ce-cli && \
    apt-get clean -y && \
    rm -rf /var/cache/debconf/* /var/lib/apt/lists/* /var/log/* /tmp/* /var/tmp/* \
           /usr/share/doc/* /usr/share/man/* /usr/share/local/* && \
    usermod -a -G docker admin

RUN apt-get update && apt-get install --no-install-recommends -y openssh-server && \
    mkdir /home/admin/.ssh && \
    chown admin:admin /home/admin/.ssh

#EXPOSE 22

# Extra deps for GHA Runner
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y \
    curl \
    jq \
    sudo \
    unzip \
    wget \
    zip \
    git \
    pigz nano \
    && rm -rf /var/lib/apt/list/*

# Add and config runner user as sudo
# Remove default admin user
# https://github.com/nestybox/dockerfiles/blob/master/ubuntu-focal-systemd/Dockerfile
RUN useradd -m runner \
    && usermod -aG sudo runner \
    && usermod -aG docker runner \
    && echo "%sudo   ALL=(ALL:ALL) NOPASSWD:ALL" > /etc/sudoers \
    && userdel -r admin

# Build args
ARG TARGETPLATFORM=amd64
ARG RUNNER_VERSION=2.328.0
WORKDIR /runner

# Runner download supports amd64 as x64
RUN export ARCH=$(echo ${TARGETPLATFORM} | cut -d / -f2) \
    && if [ "$ARCH" = "amd64" ]; then export ARCH=x64 ; fi \
    && curl -Ls -o runner.tar.gz https://github.com/uazo/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${ARCH}-${RUNNER_VERSION}.tar.gz \
    && tar xzf ./runner.tar.gz \
    && rm runner.tar.gz \
    && ./bin/installdependencies.sh \
    && rm -rf /var/lib/apt/lists/*

# Dumb Init
RUN export ARCH=$(echo ${TARGETPLATFORM} | cut -d / -f2) \
    && curl -Ls  -o /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_${ARCH} \
    && chmod +x /usr/local/bin/dumb-init

#AWS client
#RUN curl -Ls "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip \
# && unzip awscliv2.zip \
# && ./aws/install \
# && rm -rf awscliv2.zip

COPY startup.sh /usr/local/bin/

# Add patched scripts from GHA runner (svc.sh and RunnerService.js)
COPY --chown=runner:runner patched/ ./patched/

RUN chmod +x ./patched/runsvc.sh /usr/local/bin/startup.sh

USER runner

RUN wget https://github.com/docker/buildx/releases/download/v0.10.4/buildx-v0.10.4.linux-amd64 && \
    mkdir -p /home/runner/.docker/cli-plugins && \
    mv buildx-v0.10.4.linux-amd64 /home/runner/.docker/cli-plugins/docker-buildx && \
    chmod +x /home/runner/.docker/cli-plugins/docker-buildx

ENV HTTP_PROXY="http://127.0.0.1:8118"
ENV HTTPS_PROXY="http://127.0.0.1:8118"
ENV http_proxy="http://127.0.0.1:8118"
ENV https_proxy="http://127.0.0.1:8118"
COPY docker.default /etc/default/docker
COPY proxy.conf /etc/apt/apt.conf.d/proxy.conf

ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]
CMD ["startup.sh"]
