#!/bin/bash

install_rclone() {
  wget https://github.com/rclone/rclone/releases/download/v1.64.0/rclone-v1.64.0-linux-amd64.zip
  unzip rclone-v1.64.0-linux-amd64.zip
  rm rclone-v1.64.0-linux-amd64.zip

  # mkdir -p  ~/.config/rclone
  # echo "$RCLONE_CONF" > ~/.config/rclone/rclone.conf
}

test -d rclone-v1.64.0-linux-amd64 || install_rclone
export rclone=rclone-v1.64.0-linux-amd64/rclone

rm -rf filters || true
mkdir filters

while true
do

  pushd filters

  KO=0
  curl -O https://easylist-downloads.adblockplus.org/abpindo.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/abpvn.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/bulgarian_list.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/dandelion_sprouts_nordic_filters.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistchina.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistczechslovak.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistdutch.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistgermany.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/israellist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/hufilter.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistitaly.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistlithuania.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistpolish.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistportuguese.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistspanish.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/global-filters.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/indianlist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/japanese-filters.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/koreanlist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/latvianlist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/liste_ar.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/liste_fr.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/rolist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/ruadlist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/turkish-filters.txt || KO=1

  curl -O https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/abpindo+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/abpvn+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/bulgarian_list+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/dandelion_sprouts_nordic_filters+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistchina+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistczechslovak+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistdutch+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/israellist+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistitaly+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistlithuania+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistpolish+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistportuguese+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easylistspanish+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/indianlist+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/koreanlist+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/latvianlist+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/liste_ar+liste_fr+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/liste_fr+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/rolist+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/ruadlist+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/i_dont_care_about_cookies.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/fanboy-notifications.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/easyprivacy.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/fanboy-social.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/japanese-filters+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/global-filters+easylist.txt || KO=1
  curl -O https://easylist-downloads.adblockplus.org/turkish-filters+easylist.txt || KO=1

  curl -o badmojr-1Hosts-master-Pro-adblock.txt https://raw.githubusercontent.com/badmojr/1Hosts/master/Pro/adblock.txt || KO=1
  curl -O https://badblock.celenity.dev/abp/badblock_lite.txt || KO=1

  NOW=$(date +"%Y-%m-%dT%H:%M:%S%z")
  echo Last Update $NOW > LAST-UPDATE.txt

  popd

  $rclone sync filters ftp:www.cromite.org/filters --log-level INFO
  $rclone sync filters ftp:www.cromite.org/filters --log-level INFO

  echo "You can stop now"
  sleep 24h

done