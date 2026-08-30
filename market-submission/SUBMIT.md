# Submit to Plugin Market (do this tomorrow)

dsh-market v1.37.0 reads the curated catalog at
https://github.com/awesome-dsh-plugin/awesome-dsh-plugin — not the
dsh-market app repo. Do **not** PR plugin entries against dsh-market.

Repo created: 2026-08-30T09:10:54Z
CI requires the GitHub repo to be **at least 1 day old** and to have
**≥ 10 commits**. Commits are already at 10. Wait until **2026-08-31**
(or 24h after `created_at`) before opening the PR.

## Checklist

- [x] Public repo: https://github.com/iimaguest/dsh-contradictions-indicator
- [x] Topic `dsh-plugin` on the repo
- [x] Root `package.json` declares `dsh.bundle.patch`
- [x] `cordis.patch.yml` at repo root
- [x] Apache-2.0 LICENSE
- [x] ≥ 10 commits
- [x] `screenshots.json` at repo root listing 4 images under
      `market-submission/screenshots/` (per contributing.md: 1–8
      repo-relative paths, next to `package.json`; storefronts pick them up
      on the next nightly build — nothing to add to the PR itself)
- [ ] Repo age ≥ 1 day
- [ ] Open PR on awesome-dsh-plugin with **one** YAML file

## Open the PR

```sh
gh repo clone awesome-dsh-plugin/awesome-dsh-plugin
cd awesome-dsh-plugin
git checkout -b add-dsh-contradictions-indicator
cp /path/to/dsh-contradictions-indicator/market-submission/iimaguest__dsh-contradictions-indicator.yml \
   data/plugins/iimaguest__dsh-contradictions-indicator.yml
npm ci
node scripts/generate-readme.mjs
git add data/plugins/iimaguest__dsh-contradictions-indicator.yml README.md README.zh.md
git commit -m "Add iimaguest/dsh-contradictions-indicator"
git push -u origin add-dsh-contradictions-indicator
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --title "Add iimaguest/dsh-contradictions-indicator" \
  --body "Adds the Contradictions Indicator plugin (header coherence badge + parallel analysis)."
```

After merge, dsh-market and https://dshmarket.com pick the entry up
automatically (usually within a day). No extra PR against dsh-market.
