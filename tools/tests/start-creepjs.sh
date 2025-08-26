#!/bin/bash

FILE_LIST=devices-list

cat $FILE_LIST | while read current
do
    if [[ $current =~ ^#.* ]]; then
        : # skip comments

    elif [ ! -z "$current" ]; then

        echo $current
        node test_webdriver.js bs "$current" cromite
    fi

done
