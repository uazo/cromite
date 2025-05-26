#!/bin/bash

if [[ -z "${INDEX_VERSION}" ]]; then
   echo "Please set INDEX_VERSION env variable"
   exit 1
fi

FLD=/storage/images/$INDEX_VERSION/android/true/x64
test -d $FLD || FLD=/casefold/storage/images/$INDEX_VERSION/android/true/x64
test -d $FLD || echo "wrong directory" && exit 1

cp $FLD/cromite.idx .
cp $FLD/RELEASE .

DOCKER_BUILDKIT=1 docker build -t uazo/bromite-remote-index:$INDEX_VERSION \
                --progress plain \
                --no-cache \
                .

echo RELEASE:$(cat RELEASE): TAG:$INDEX_VERSION
