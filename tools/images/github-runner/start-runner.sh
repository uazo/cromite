#!/bin/bash

docker stop gh-proxy

if [ -z "$GHRUNNERHOME" ]; then
   echo "Variable GHRUNNERHOME is empty"
	 echo "   example: GHRUNNERHOME=/home/xxxx/gh-runner/docker-inner/"
	 exit 1
fi
sudo rm -rf $GHRUNNERHOME/tmp

SYSBOX_UID=$(cat /etc/subuid | grep sysbox | cut -d : -f 2)
mkdir -p $GHRUNNERHOME/tmp/proxy
mkdir -p $GHRUNNERHOME/tmp/forward-proxy
mkdir -p $GHRUNNERHOME/redis
mkdir -p $GHRUNNERHOME/var/run

sudo chown $SYSBOX_UID:$SYSBOX_UID $GHRUNNERHOME/tmp/proxy
sudo chown $SYSBOX_UID:$SYSBOX_UID $GHRUNNERHOME/tmp/forward-proxy
sudo chown $SYSBOX_UID:$SYSBOX_UID $GHRUNNERHOME/redis
sudo chown $SYSBOX_UID:$SYSBOX_UID $GHRUNNERHOME/var/run

docker run --rm -d --runtime=sysbox-runc \
  --name=gh-proxy \
  -e "REMOTEEXEC_ADDR=$REMOTEEXEC_ADDR" \
  -v $GHRUNNERHOME/tmp/proxy:/tmp/proxy:rw \
  -v $GHRUNNERHOME/tmp/forward-proxy:/tmp/forward-proxy:rw \
  uazo/squid && \
  docker logs gh-proxy && \
  sleep 30s

while true
do
  #sudo chown -R $SYSBOX_UID:$SYSBOX_UID $GHRUNNERHOME/docker-inner
  test -f $GHRUNNERHOME/var/run/docker.pid && sudo rm $GHRUNNERHOME/var/run/docker.pid

  docker run --runtime=sysbox-runc --name=gh-runner -ti --rm \
    --env-file=.env \
    -v $GHRUNNERHOME/docker-inner/:/var/lib/docker/:rw \
    -v /storage/images:/storage/images:rw \
    -v $GHRUNNERHOME/tmp/proxy:/tmp/proxy:rw \
    -v $GHRUNNERHOME/tmp/forward-proxy:/tmp/forward-proxy:rw \
    -v $GHRUNNERHOME/redis:/redis:rw \
    -v $GHRUNNERHOME/var/run:/var/run \
    -v /casefold:/win_sdk \
    --network none \
    --device=/dev/kvm \
    uazo/github-runner:2.328.0

  echo "You can stop now"
  sleep 5s

done
