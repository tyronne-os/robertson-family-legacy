#!/bin/bash
# This launcher assumes the app is run from its installed location at
# /home/hunt/NobilityDepository (or wherever this vault-app/ folder is
# copied to and `npm install` has been run). It resolves its own directory
# so it works from either place.
cd "$(dirname "$(readlink -f "$0")")"
exec node_modules/electron/dist/electron . --no-sandbox
