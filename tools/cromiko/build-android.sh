#!/bin/bash
# The former name of tools/cromiko/build.sh, which builds every version of CromIKO
# (Android and Windows). Kept for the GitHub Actions workflow and older instructions.
exec "$(dirname "$0")/build.sh" "$@"
