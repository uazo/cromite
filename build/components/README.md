## Components on Cromite

Cromite needs to download certain static files for certain features.
Specifically, the need arises from making the fonts used by the browser standard, in order to minimise the use of fingerprint scripts based on the fonts present on the device.

To do this, the automatic update of components was reactivated with some differences compared to Chromium:

- Since there is no backend, the response to the request for updates is static (see `query.json`). It currently resides on the cromite.org site because, deliberately, no request log is active.
- The update file (a zip file) is downloaded only once and, if already done, nothing more is requested externally, unless the user goes to `chrome://components` and requests the update check.

It is possible to generate a zip for the components in this way:

### prerequisites

- generate a der file, used to 'sign' the zip:

```
openssl genrsa 4096 | openssl pkcs8 \
   -inform PEM -nocrypt -topk8 -outform DER \
   -out cromite.pkcs8.der
```

currently the certificate used for cromite is in the pkcs8.der.asc, encrypted with gpg, so not public, for security reasons.

- build `crx3_build_action`, necessary for 'signing' the zip:

```
ninja -C out/lin64 crx3_build_action
```

### how to generate the zip

simply:

```
zip -j fonts.zip fonts/*
out/lin64/crx3_build_action fonts_component.zip fonts.zip pkcs8.der
```

the resulting zip cannot currently be unzipped with system tools.

The zip must contain the file `manifest.json`.

### important sections in the query.json

- `appid`:
is the value used to identify the component. currently I do not know how to create a new one, there is no documentation or code to generate it.
- `codebase`:
is the base url from which to download the file
- `name`:
is the name of the file to download, the url is "codebase + name"
- `hash_sha256`:
is the hash of the resulting zip, used for comparison. compatible with sha256sum
- `fp`:
currently not used, is an additional protection mechanism for which I have found no documentation.
