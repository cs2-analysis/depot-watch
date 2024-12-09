# depot-watch

Watch steam for depot changes in cs2 and trigger github workflow

## Environment Variables

- `GITHUB_TOKEN` - Github token for the target repository
- `GITHUB_REPOSITORY` - Github repository to trigger workflow on (default: `cs2-analysis/cs2-analysis`)
- `GITHUB_BRANCH` - Github branch to trigger workflow on (default: `master`)
- `GITHUB_WORKFLOW` - Github workflow name or id to trigger (default: `update.yml`)
- `VERSION_FILE` - File used to track the last known version (default: `version.txt`, default in container: `/data/version.txt`)