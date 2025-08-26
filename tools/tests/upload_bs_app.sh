#!/bin/bash

APP_NAME=$1
APP_APK=$2

echo Removing $APP_NAME
for id in $(curl -s -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
                 -X GET "https://api-cloud.browserstack.com/app-automate/recent_apps" | \
            jq --arg APP_NAME "$APP_NAME"  -rc '.[] | select (.custom_id == $APP_NAME) | .app_id') ; do
  echo ..Removing $id
  curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
    -X DELETE "https://api-cloud.browserstack.com/app-automate/app/delete/${id}"
done

echo Uploading $APP_NAME from $APP_APK
curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@$APP_APK" \
  -F "custom_id=$APP_NAME"
