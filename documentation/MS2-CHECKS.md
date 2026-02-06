# MS2 Criteria Automated Checks

This repository includes automated MS2 criteria checks that run on every pull request.

## Overview

The MS2 criteria checks are implemented as a GitHub Actions workflow that automatically validates semantic models against the MS2 modeling guidelines. When you open or update a pull request, the workflow:

1. Detects changed `.ttl` (Turtle) files
2. Runs comprehensive checks against MS2 criteria
3. Posts results as a PR comment with visual indicators (✅/❌/⚠️/ℹ️)
4. Updates the comment on subsequent commits

## Automated Checks

The following MS2 criteria are checked automatically:

### Critical Checks (Must Pass)
- ✅ **SAMM Validation**: Model validates with SAMM CLI 2.11.1
- ✅ **Camel-Case Naming**: All identifiers follow CamelCase convention
- ✅ **No Consecutive Underscores**: Identifiers don't contain `__`
- ✅ **Capital Letters**: Model elements (Aspect, Characteristic, Entity, Trait) start with uppercase
- ✅ **Lowercase Properties**: Property identifiers start with lowercase
- ✅ **Preferred Name & Description**: All elements have both fields in English
- ✅ **Property vs Characteristic**: Must have different names
- ✅ **Semantic Versioning**: URN follows x.y.z format
- ✅ **Different Fields**: preferredName and description must differ
- ✅ **Human-Readable Names**: preferredName uses normal word separation (not CamelCase)
- ✅ **Example Values**: Properties with simple types include examples
- ✅ **External Models**: Imported models have "release" status
- ✅ **metadata.json**: Exists with status "release"
- ✅ **JSON Schema**: Validates against example payload
- ✅ **RELEASE_NOTES.md**: Exists with change entries
- ✅ **Copyright Header**: Includes contributors and license

### Advisory Checks (Warnings/Info)
- ⚠️ **Abbreviations**: Flags potentially unclear short names
- ⚠️ **Redundant Prefixes**: Suggests Entity grouping for repeated prefixes
- ℹ️ **Aspect Naming**: Verifies singular/plural convention
- ℹ️ **Unit Catalog**: Encourages SAMM unit catalog usage
- ℹ️ **Constraints**: Encourages explicit constraints
- ℹ️ **External Standards**: Suggests "see" references

## Manual Review Still Required

Some MS2 criteria require human judgment and are NOT automated:

- Whether abbreviations are "sufficiently common"
- If redundant prefixes could be better organized
- Whether descriptions are truly "comprehensible"
- If constraints adequately capture all requirements
- Verification that all model contributors are in copyright header

## Understanding the Results

The automated check posts a comment on your PR with a table showing:

```markdown
| Criterion | Status | Details |
|-----------|--------|----------|
| Model validates with SAMM SDK | ✅ | Model validates successfully |
| Use Camel-Case | ❌ | Some elements do not follow CamelCase<br>Element 'my_property' contains underscores |
```

### Status Indicators
- ✅ **Pass**: Check passed successfully
- ❌ **Fail**: Check failed - must be fixed
- ⚠️ **Warning**: Issue found but not critical - review recommended
- ℹ️ **Info**: Informational message or not applicable

## What to Do When Checks Fail

1. **Review the Details**: Click on the workflow run to see detailed logs
2. **Fix Issues**: Update your `.ttl` files to address failures
3. **Commit Changes**: Push new commits to the PR branch
4. **Automatic Re-check**: The workflow runs again automatically
5. **Updated Comment**: The PR comment is updated with new results

## Workflow Files

The MS2 checks consist of:

- **Workflow**: `.github/workflows/ms2-checks.yml` - Orchestrates the checks
- **Action**: `.github/actions/ms2-checks/` - Contains the check logic
  - `action.yml` - Action definition
  - `index.js` - Main check implementation
  - `package.json` - Node.js dependencies
  - `Readme.md` - Technical documentation

## Local Testing

Before pushing, you can validate models locally:

```bash
# Install SAMM CLI (download from GitHub)
wget https://github.com/eclipse-esmf/esmf-sdk/releases/download/v2.11.1/samm-cli-2.11.1.jar

# Validate a model
java -jar samm-cli-2.11.1.jar aspect path/to/YourModel.ttl validate
```

## Troubleshooting

### Workflow Doesn't Run
- Ensure `.ttl` files were changed in the PR
- Check that the workflow is enabled in repository settings
- Verify branch protection rules don't prevent workflow execution

### False Positives
- Some checks use heuristics and may flag valid code
- Review warnings and use your judgment
- Advisory checks (⚠️/ℹ️) don't block merging

### Permission Errors
- The workflow requires `pull-requests: write` permission
- This is configured in the workflow file automatically

## Contributing

To improve the MS2 checks:

1. Edit `.github/actions/ms2-checks/index.js`
2. Add or modify check functions
3. Update the `criteriaChecks` array
4. Test your changes
5. Submit a PR with your improvements

## Support

For issues or questions:
- Open an issue in the repository
- Check existing workflow runs for error messages
- Review the action logs in the GitHub Actions tab
