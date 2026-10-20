#!/usr/bin/env bash
# Replaces the badges branch with the files of <dir>: one commit with no parent that holds those files alone, pushed
# with a lease on the head this run read. A writer that moved the branch after that read keeps its head, and this run
# fails. Only the badges ref is pushed; master is never written. Files equal to the branch's push nothing.
#
#   bash scripts/badges/publish-badges-branch.sh <dir> [<remote>] [<branch>]
#
# Run it inside a clone that can push to <remote> (default origin; branch default badges). The commit message names
# the commit the files were counted from: BADGES_SOURCE_SHA, or the clone's HEAD. The Test Suite workflow's Update
# Badges job runs it on pushes to master, with the files its Unit Tests job wrote (scripts/badges/write-badge-json.js).
set -euo pipefail

DIR="${1:?usage: publish-badges-branch.sh <dir> [<remote>] [<branch>]}"
REMOTE="${2:-origin}"
REF="refs/heads/${3:-badges}"
SOURCE="${BADGES_SOURCE_SHA:-$(git rev-parse HEAD)}"

export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-github-actions[bot]}"
export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
export GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-$GIT_AUTHOR_NAME}"
export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-$GIT_AUTHOR_EMAIL}"

# The tree: the directory's files, flat.
entries=""
for f in "$DIR"/*; do
  [ -f "$f" ] || continue
  entries+="100644 blob $(git hash-object -w -- "$f")"$'\t'"$(basename -- "$f")"$'\n'
done
if [ -z "$entries" ]; then
  echo "::error::$DIR holds no files to publish." >&2
  exit 1
fi
tree=$(printf '%s' "$entries" | git mktree)

# The head this run replaces, or none when the branch does not exist yet. ls-remote --exit-code exits 2 when the ref
# is missing; any other failure stops the run before anything is pushed.
status=0
git ls-remote --exit-code "$REMOTE" "$REF" > /dev/null || status=$?
case "$status" in
  0)
    git fetch --quiet --no-tags --depth=1 "$REMOTE" "$REF"
    expected=$(git rev-parse FETCH_HEAD)
    if [ "$(git rev-parse 'FETCH_HEAD^{tree}')" = "$tree" ]; then
      echo "$REF at $expected already holds these files; nothing to push."
      exit 0
    fi
    ;;
  2)
    expected=""
    ;;
  *)
    echo "::error::Could not read $REF from $REMOTE: git ls-remote exited with $status." >&2
    exit 1
    ;;
esac

commit=$(git commit-tree "$tree" -m "badges for $SOURCE")
# An empty lease means the branch must not exist yet (git push --force-with-lease=<ref>:).
if ! git push --quiet --force-with-lease="$REF:$expected" "$REMOTE" "$commit:$REF"; then
  echo "::error::The push to $REF failed or its lease (${expected:-no branch}) no longer held; the branch keeps the head it has." >&2
  exit 1
fi
echo "$REF: ${expected:-absent} -> $commit (badges for $SOURCE)"
