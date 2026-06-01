# Contributing to Frame Codex

Welcome! This document is a high-level, human-friendly guide for contributing to **Frame Codex**.  
For the full, step-by-step workflow, see [`docs/contributing/how-to-submit.md`](docs/contributing/how-to-submit.md).

---

## 1. What is Frame Codex?

Frame Codex is a **data-only, markdown-first knowledge fabric** designed for AI systems:

- **Fabric** – The entire repository: a collection of weaves.
- **Weave** – Top-level knowledge universe (e.g. `weaves/frame/`, `weaves/wiki/`).
- **Loom** – Any subdirectory inside a weave (topic/module, inferred from folders).
- **Strand** – Individual markdown file at any depth inside a weave (atomic unit).

There is **no UI** in this repo. The primary viewer lives at:

- **Frame.dev Codex UI**: <https://frame.dev/codex>  
- **Repo**: <https://github.com/framerslab/frame.dev> (app that renders this Codex)

---

## 2. Recommended Contribution Path (Frame.dev UI)

The easiest way to contribute is **inside the Codex UI** at [`frame.dev/codex`](https://frame.dev/codex):

1. Open the Codex viewer and browse to the area you want to extend.
2. Click **“Contribute”** in the toolbar (or use the contribution hotkey).
3. Fill out:
   - **Title** (required)
   - **Summary** (20–300 chars, required)
   - **Content** (markdown, required)
   - **Weave + Loom** (optional – UI can suggest based on current path/content)
   - **Tags, Difficulty, Subjects, Topics** (optional but encouraged)
4. (Optional) Toggle **AI Enhancement** to let the pipeline refine tags and metadata.
5. (Optional) Provide a **GitHub Personal Access Token (PAT)** to let the browser create a PR via API.
6. Preview the generated markdown + frontmatter.
7. Click **“Create Pull Request”**:
   - With PAT → a PR is created via the GitHub API from your fork.
   - Without PAT → GitHub’s web editor opens with the file pre-filled.

### GitHub PAT Privacy

- PAT is entered **only** into the Codex contribution modal in your browser.
- It is stored **only in memory** in that tab while the modal is open.
- It is **never** written to:
  - `localStorage`
  - `sessionStorage`
  - IndexedDB / SQL cache
  - Any Frame.dev backend
- The token is sent **only** to GitHub’s API endpoints for:
  - Forking `framersai/codex`
  - Creating a branch + file
  - Opening a pull request

You can always skip the PAT and use the GitHub web editor flow instead.

---

## 3. Manual Git Workflow (Advanced)

If you prefer the CLI, follow the traditional flow:

1. **Fork & Clone**

   ```bash
   gh repo fork framersai/codex --clone
   cd codex
   ```

2. **Create a Branch**

   ```bash
   git checkout -b add-my-content
   ```

3. **Add Content**

   - Place files under a weave:

     ```text
     weaves/
       [weave]/                # e.g. frame/, wiki/, technology/
         weave.yaml
         overview.md           # Strand at weave root
         guides/               # Loom (folder inferred from path)
           loom.yaml           # Optional
           intro.md            # Strand
           deep-dive/notes.md  # Nested loom/strand
     ```

   - See [`docs/contributing/submission-schema.md`](docs/contributing/submission-schema.md) for required fields.

4. **Validate & Index**

   ```bash
   npm install
   npm run validate
   npm run index -- --validate
   ```

5. **Commit & Push**

   ```bash
   git add .
   git commit -m "feat: add [your content title]"
   git push origin add-my-content
   ```

6. **Open a PR**

   ```bash
   gh pr create --title "Add: [Your Content Title]" --body "Description of your contribution"
   ```

---

## 4. Using the Frame.dev UI with Your Own Codex Repo

You can reuse the Frame.dev Codex UI to render **any** Codex-style repository:

1. **Fork `framersai/frame.dev`**.
2. In your fork, create `.env.local` under `apps/frame.dev`:

   ```bash
   NEXT_PUBLIC_CODEX_REPO_OWNER=your-github-username-or-org
   NEXT_PUBLIC_CODEX_REPO_NAME=your-codex-repo
   NEXT_PUBLIC_CODEX_REPO_BRANCH=main
   ```

3. The viewer reads these in `components/codex/constants.ts` via `REPO_CONFIG`.
4. Run the UI locally:

   ```bash
   cd apps/frame.dev
   pnpm install
   pnpm dev
   ```

5. Visit `http://localhost:3000/codex` to browse your own fabric.

---

## 5. Quality Guidelines

- **Content**: Clear, self-contained strands with real knowledge (no placeholders).
- **Metadata**: Fill in `title`, `summary`, `tags`, `difficulty`, `subjects`, `topics`.
- **Structure**: Use headings, lists, and code blocks for readability.
- **Licensing**: Contributions must be compatible with **CC-BY-4.0**.

For full details, examples, and schema reference, see:

- [`docs/contributing/how-to-submit.md`](docs/contributing/how-to-submit.md)
- [`docs/contributing/submission-schema.md`](docs/contributing/submission-schema.md)
- [`docs/openstrand-architecture.md`](docs/openstrand-architecture.md)


