#!/usr/bin/env bash
# Replaces the badges branch with the files of <dir>: one commit with no parent that holds those files alone, pushed
# with a lease on the head this run read. A writer that moved the branch after that read keeps its head, and this run
# fails. Only the badges ref is pushed; master is never written. A run whose commit is older than the one the branch's
# files were counted from, while master still holds that one, pushes nothing, and so does a run of that same commit
# with the same files, and a run of a commit master no longer holds; the same files from a later commit are pushed
# again, so that the head names that commit.
#
#   bash scripts/badges/publish-badges-branch.sh <dir> [<remote>] [<branch>]
#
# Run it inside a clone that can push to <remote> (default origin; branch default badges) and holds master's history
# (actions/checkout with fetch-depth: 0); a shallow clone fetches the commit the branch names. The commit message names
# the commit the files were counted from: BADGES_SOURCE_SHA, or the clone's HEAD, which must be in the history of
# BADGES_SOURCE_BRANCH (default master) on <remote>. The Test Suite workflow's Update Badges job runs it on pushes to
# master, with the files its Unit Tests job wrote (scripts/badges/write-badge-json.js).
set -euo pipefail

DIR="${1:?usage: publish-badges-branch.sh <dir> [<remote>] [<branch>]}"
REMOTE="${2:-origin}"
REF="refs/heads/${3:-badges}"
SOURCE="${BADGES_SOURCE_SHA:-$(git rev-parse HEAD)}"
MASTER="refs/heads/${BADGES_SOURCE_BRANCH:-master}"

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

# The run's commit must still be in master's history. After a force-push replaced that history, a delayed run of a
# commit master dropped would otherwise replace the badges of the history master now holds. Later commits on master
# (the index commits auto-index.yml pushes, say) keep the run's commit in that history.
if ! git fetch --quiet --no-tags "$REMOTE" "$MASTER"; then
  echo "::error::Could not fetch $MASTER from $REMOTE." >&2
  exit 1
fi
master_head=$(git rev-parse FETCH_HEAD)
held=0
git merge-base --is-ancestor "$SOURCE" "$master_head" 2> /dev/null || held=$?
case "$held" in
  0) ;;
  1)
    echo "$SOURCE is not in the history of $MASTER on $REMOTE (a force-push replaced it, or it was never there); nothing to push."
    exit 0
    ;;
  *)
    echo "::error::Could not tell whether $SOURCE is in the history of $MASTER (git merge-base exited $held)." >&2
    exit 1
    ;;
esac

# The head this run replaces, or none when the branch does not exist yet. ls-remote --exit-code exits 2 when the ref
# is missing; any other failure stops the run before anything is pushed.
status=0
git ls-remote --exit-code "$REMOTE" "$REF" > /dev/null || status=$?
case "$status" in
  0)
    git fetch --quiet --no-tags --depth=1 "$REMOTE" "$REF"
    expected=$(git rev-parse FETCH_HEAD)
    # The head's message names the commit its files were counted from.
    published=$(git log -1 --format=%s "$expected" | sed -n 's/^badges for \([0-9a-f]\{40\}\)$/\1/p')
    if [ "$published" = "$SOURCE" ] && [ "$(git rev-parse "$expected^{tree}")" = "$tree" ]; then
      echo "$REF at $expected already holds these files for $SOURCE; nothing to push."
      exit 0
    fi
    # Update Badges runs one job at a time but in no set order, so a run of an earlier master commit can reach the
    # branch after a later commit's run has published, and its lease on that head holds. When the commit the head
    # names is still on master and descends from this run's, the branch keeps the later badges. Otherwise this run's
    # files replace them, even files equal to the branch's, so that the head names the latest commit counted and a
    # delayed run of a commit between the two finds it. A commit master no longer holds (a force-push moved master
    # back past it, or away from it) is never the later one.
    if [ -n "$published" ] && [ "$published" != "$SOURCE" ]; then
      git cat-file -e "$published^{commit}" 2> /dev/null \
        || git fetch --quiet --no-tags "$REMOTE" "$published" 2> /dev/null \
        || true
      kept=0
      git merge-base --is-ancestor "$published" "$master_head" 2> /dev/null || kept=$?
      case "$kept" in
        0)
          order=0
          git merge-base --is-ancestor "$SOURCE" "$published" 2> /dev/null || order=$?
          case "$order" in
            0)
              echo "$REF at $expected holds the badges of $published, a later commit on $MASTER than $SOURCE; nothing to push."
              exit 0
              ;;
            1) ;;
            *)
              echo "::warning::$REF holds the badges of $published, which this clone cannot order against $SOURCE (git merge-base exited $order); this run's files replace them." >&2
              ;;
          esac
          ;;
        1)
          echo "$REF holds the badges of $published, a commit $MASTER no longer holds; this run's files replace them."
          ;;
        *)
          echo "::warning::$REF holds the badges of $published, a commit this clone cannot find (git merge-base exited $kept); this run's files replace them." >&2
          ;;
      esac
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
