# Release Process

## Versioning

Semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes to plugin/skill API or user-facing contracts
- **MINOR**: New features, new tier capabilities
- **PATCH**: Bug fixes, documentation updates

## Milestone Tags

Each completed milestone gets a tag:

```
v0.0.0-milestone-0   # Repo bootstrap
v0.1.0-milestone-1   # Tier 0 kernel
v0.2.0-milestone-2   # Tier 1 core IDE
v0.3.0-milestone-3   # Tier 2 AI coding
...
```

## Release Steps

1. Ensure all milestone PRs are merged to `main`
2. All CI checks green
3. Update version in root `package.json`
4. Create release branch: `release/v0.2.0`
5. Final testing on release branch
6. Merge to `main`
7. Tag: `git tag v0.2.0`
8. Push tag: `git push origin v0.2.0`
9. Create GitHub release with changelog

## Changelog

Generated from conventional commits:

```bash
git log --oneline v0.1.0..v0.2.0
```

Group by type: feat, fix, docs, refactor, test, ci.
