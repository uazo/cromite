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

echo -e ${RED} ------- remove third_party/devtools-frontend subrepo ${NC}
rm -rf third_party/devtools-frontend/src/.git 
cp -r third_party/devtools-frontend third_party/devtools-frontend-bis
git rm -rf third_party/devtools-frontend || true
git submodule deinit -f third_party/devtools-frontend || true
rm -rf third_party/devtools-frontend
mv third_party/devtools-frontend-bis third_party/devtools-frontend
git add -f third_party/devtools-frontend >/dev/null
git commit -m ":NOEXPORT: third_party/devtools-frontend repo" >/dev/null

echo -e ${RED} ------- remove skia subrepo ${NC}
rm -rf third_party/skia/.git 
cp -r third_party/skia third_party/skia-bis
git rm -rf third_party/skia || true
git submodule deinit -f third_party/skia || true
rm -rf third_party/skia
mv third_party/skia-bis third_party/skia
git add -f third_party/skia >/dev/null
git commit -m ":NOEXPORT: third_party/skia repo" >/dev/null

echo -e ${RED} ------- remove third_party/perfetto subrepo ${NC}
rm -rf third_party/perfetto/.git 
cp -r third_party/perfetto third_party/perfetto-bis
git rm -rf third_party/perfetto || true
git submodule deinit -f third_party/perfetto || true
rm -rf third_party/perfetto
mv third_party/perfetto-bis third_party/perfetto
git add -f third_party/perfetto >/dev/null
git commit -m ":NOEXPORT: third_party/perfetto repo" >/dev/null

echo -e ${RED} ------- remove third_party/boringssl subrepo ${NC}
rm -rf third_party/boringssl/src/.git
cp -r third_party/boringssl/src/ third_party/boringssl/src-bis
git rm -rf third_party/boringssl/src || true
git submodule deinit -f third_party/boringssl/src || true
rm -rf third_party/boringssl/src
mv third_party/boringssl/src-bis third_party/boringssl/src
git add -f third_party/boringssl/src >/dev/null
git commit -m ":NOEXPORT: third_party/boringssl repo" >/dev/null

git prune

echo -e ${RED} ------- patches ${NC}
cat ../../cromite/build/cromite_patches_list.txt
echo

echo -e ${RED} ------- apply patches ${NC}
for file in $(cat ../../cromite/build/cromite_patches_list.txt) ; do

   if [[ "$file" == *".patch" ]]; then
	#if [[ "$file" == *"Automated-domain-substitution"* ]]; then
	#	echo -e ${RED} " -> Excluding $file" ${NC}
	#	continue
	#fi
	
	echo -e ${RED} " -> Apply $file" ${NC}

	REPL="0,/^---/s//FILE:"$(basename $file)"\n---/"
	cat ../../cromite/build/patches/$file | sed $REPL | git am

	if [ $? -ne 0 ]
	then
            echo -e "Error on ../../cromite/build/patches/${file}"
            exit 1
	fi

	echo " "
    fi
    
done
