apt update && apt upgrade -y
apt install -y msitools python3 git xz-utils

git clone https://github.com/mstorsjo/msvc-wine.git
msvc-wine/vsdownload.py  \
   --accept-license \
   --major 17 \
   --cache msvc-cache \
   --dest ./out \
   --save-manifest \
   Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64 \
   Microsoft.VisualStudio.Component.VC.14.44.17.14.MFC \
   Microsoft.VisualStudio.Component.Windows11SDK.26100


python3 gen-setenv.py ./out/
