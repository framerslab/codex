# Fabric Codex Contribution

## Summary
<!-- Provide a brief description of what knowledge you're adding -->

## Type of Content
- [ ] 📚 New Weave (complete knowledge universe)
- [ ] 🧵 New Loom (curated collection)
- [ ] 📄 New Thread (individual knowledge unit)
- [ ] 🔧 Update to existing content
- [ ] 🐛 Fix errors or inaccuracies

## Pre-submission Checklist

### Required Metadata
- [ ] **Title**: Clear and descriptive (3-100 characters)
- [ ] **Summary**: Concise abstract (20-300 characters)
- [ ] **ID**: Unique identifier (UUID for threads)
- [ ] **Version**: Semantic version number (e.g., 1.0.0)

### Content Quality
- [ ] Minimum 100 characters of meaningful content
- [ ] No placeholder text (lorem ipsum, test content)
- [ ] No TODO or FIXME comments
- [ ] Proper formatting and structure
- [ ] Spell-checked and grammar-checked

### Categorization
- [ ] **Subject tags** from controlled vocabulary
- [ ] **Topic tags** that describe the content
- [ ] **Difficulty level** (beginner/intermediate/advanced/expert)
- [ ] **Content type** specified (markdown/code/data/media)

### Schema Compliance
- [ ] Follows the appropriate schema (weave/loom/strand)
- [ ] All required fields are present
- [ ] YAML frontmatter is valid (for Markdown files)
- [ ] File naming follows conventions

### Relationships (if applicable)
- [ ] Prerequisites listed in `requires`
- [ ] Related content in `references`
- [ ] External resources in `seeAlso`

## Content Details

### File(s) Changed
<!-- List all files being added or modified -->
- `weaves/[weave-name]/...`
- `schema/...`
- `docs/...`

### Keywords/Tags
<!-- Auto-generated or manually specified keywords -->
<!-- Our indexer will suggest additional tags -->

### Target Audience
- [ ] AI/LLM systems
- [ ] Developers
- [ ] Researchers
- [ ] General audience

### License Compliance (mandatory)
- [ ] I own the rights to this content, or I have explicit permission to contribute it
- [ ] Content is original or properly attributed with a permissive license (CC-BY-4.0 or compatible)
- [ ] No proprietary/confidential content; no copyrighted material without written permission
- [ ] References and sources are properly cited

## Validation Results
<!-- Run `npm run validate` and paste results here -->
```
Validation output...
```

## Additional Notes
<!-- Any other information reviewers should know -->

---

## Auto-Review Checklist (For Reviewers)
- [ ] Content adds value to Fabric Codex
- [ ] Metadata is complete and accurate
- [ ] Schema validation passes
- [ ] No duplicate content
- [ ] Appropriate categorization
- [ ] Quality standards met
- [ ] Run automated indexing to verify

### Quick Commands for Reviewers
```bash
# Validate this PR locally
npm run validate -- --files <changed-files>

# Run indexer with quality checks
npm run index -- --validate

# Check for duplicates
npm run check-duplicates -- --path <new-content-path>
```

---

By submitting this PR, I confirm that:
1. The content adheres to Fabric Codex quality standards
2. I have the right to contribute this content (or it is under a license allowing redistribution)
3. The content is free to republish under CC-BY-4.0 (or a compatible license)

/cc @framersai/codex-maintainers
