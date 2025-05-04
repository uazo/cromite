apt update && apt upgrade -y
apt install -y msitools python3 git xz-utils

git clone https://github.com/mstorsjo/msvc-wine.git
msvc-wine/vsdownload.py  \
   --accept-license \
   --major 17 \
   --cache msvc-cache \
   --dest ./out \
   --save-manifest \
   Microsoft.VisualStudio.Component.VC.14.42.17.12.x86.x64 \
   Microsoft.VisualStudio.Component.VC.14.42.17.12.MFC \
   Win11SDK_10.0.26100

mv ./out/kits/ "./out/Windows Kits"

python3 gen-setenv.py ./out/
