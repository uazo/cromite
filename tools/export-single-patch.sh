#!/bin/bash

patch=$1
output=$2

PATCH_FILE=$(git -C ~/chromium/src/ show -s $patch | grep FILE: | sed 's/FILE://g' | sed 's/^[ \t]*//;s/[ \t]*$//')
if [ -z "$output" ]
then
	PATCH_FILE=$(git -C ~/chromium/src/ show -s $patch | tail -n 1 | xargs)
	echo Exporting $patch ~/cromite/build/patches-new/$PATCH_FILE
else
	PATCH_FILE=$output
	echo Exporting new $patch ~/cromite/build/patches-new/$PATCH_FILE
fi

PATCH_MESSAGE=$(git -C ~/chromium/src/ show -s $patch)
if [[ $PATCH_MESSAGE == *NOEXPORT:* ]] ;
then
    echo Request NO export
	exit 0
fi

git -C ~/chromium/src/ format-patch -1 --keep-subject --stdout --full-index --zero-commit --no-signature $patch >~/cromite/build/patches-new/$PATCH_FILE
echo "   exported"

CHANGE_REF=""
while read line; do
	for i in {1..5}
	do
		if [[ "$line" == index* ]]; then
			read next_line
			if [[ "$next_line" != "GIT binary patch" ]]; then
				CHANGE_REF=${CHANGE_REF}"/^${line}/d;"
				break
			else
				line=$next_line
				continue
			fi
		else
			break
		fi
	done
done <~/cromite/build/patches-new/$PATCH_FILE

if [ "$CHANGE_REF" ]
then
	sed -i "$CHANGE_REF" ~/cromite/build/patches-new/$PATCH_FILE
fi
sed -i '/^From 0000000000000000000000000000000000000000/d' ~/cromite/build/patches-new/$PATCH_FILE
sed -i '/^FILE:/d' ~/cromite/build/patches-new/$PATCH_FILE
sed -i '/^ mode change/d' ~/cromite/build/patches-new/$PATCH_FILE
sed -i '/^old mode /d' ~/cromite/build/patches-new/$PATCH_FILE
sed -i '/^new mode /d' ~/cromite/build/patches-new/$PATCH_FILE

echo "--" >> ~/cromite/build/patches-new/$PATCH_FILE
#echo "2.25.1" >> ~/cromite/build/patches-new/$PATCH_FILE
#echo "" >> ~/cromite/build/patches-new/$PATCH_FILE

#unix2dos ~/cromite/build/patches-new/$PATCH_FILE

echo "   done."
echo ""
