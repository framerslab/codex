# badges

CI writes these files; nothing here is edited by hand. On each push to master that runs the Test Suite workflow
(.github/workflows/test.yml on master), its Unit Tests job writes them from its own test and coverage run
(scripts/badges/write-badge-json.js), and its Update Badges job replaces this branch with them
(scripts/badges/publish-badges-branch.sh). Each JSON file is a shields.io endpoint
(https://shields.io/badges/endpoint-badge). The README on master reads them through jsDelivr:
https://img.shields.io/endpoint?url=https://cdn.jsdelivr.net/gh/framerslab/codex@badges/<name>.json, with the url parameter URL-encoded.
