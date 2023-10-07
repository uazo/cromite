#!/bin/bash

RED='\033[0;31m'
NC='\033[0m' # No Color

sudo apt install sed

cd chromium/src

echo -e ${RED} ------- remove v8 subrepo ${NC}
rm -rf v8/.git 
cp -r v8 v8bis
git rm -rf v8 || true
git submodule deinit -f v8 || true
mv v8bis v8
git add -f v8 >/dev/null
git commit -m ":NOEXPORT: v8 repo" >/dev/null

echo -e ${RED} ------- patches ${NC}
cat ../../bromite/build/bromite_patches_list.txt
echo

echo -e ${RED} ------- apply patches ${NC}
for file in $(cat ../../bromite/build/bromite_patches_list.txt) ; do

   if [[ "$file" == *".patch" ]]; then
	#if [[ "$file" == *"Automated-domain-substitution"* ]]; then
	#	echo -e ${RED} " -> Excluding $file" ${NC}
	#	continue
	#fi
	
	echo -e ${RED} " -> Apply $file" ${NC}

	REPL="0,/^---/s//FILE:"$(basename $file)"\n---/"
	cat ../../bromite/build/patches/$file | sed $REPL | git am

	if [ $? -ne 0 ]
	then
            echo -e "Error on ../../bromite/build/patches/${file}"
            exit 1
	fi

	echo " "
    fi
    
done
