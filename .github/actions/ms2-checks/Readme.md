# MS2 Criteria Checks Action

This GitHub Action validates semantic models against the MS2 criteria defined for the Tractus-X project.

## What it checks

The action performs automated checks for the following MS2 criteria:

### Critical Checks (Must Pass)
1. ✅ **SAMM Validation**: Model validates with SAMM SDK CLI
2. ✅ **Camel-Case**: All identifiers follow CamelCase naming convention
3. ✅ **No Consecutive Underscores**: Identifiers don't contain `__`
4. ✅ **Capital Letters for Model Elements**: Aspects, Characteristics, Entities, Traits start with capital letters
5. ✅ **Lowercase for Properties**: Property identifiers start with lowercase letters
6. ✅ **Preferred Name and Description**: All elements have both fields in English
7. ✅ **Property vs Characteristic Names**: They must differ
8. ✅ **Semantic Versioning**: URN follows semantic versioning (x.y.z)
9. ✅ **PreferredName vs Description**: Must be different
10. ✅ **Human-Readable PreferredName**: Not in CamelCase, uses normal word separation
11. ✅ **Example Values**: Properties with simple types have example values
12. ✅ **External Models State**: Imported models have "release" status
13. ✅ **metadata.json**: Exists with status "release"
14. ✅ **JSON Schema Validation**: Schema validates example payload
15. ✅ **RELEASE_NOTES.md**: Exists with change entries
16. ✅ **Copyright Header**: Includes contributors and license

### Advisory Checks (Warnings/Info)
- ⚠️ **Abbreviation Usage**: Flags potential unclear abbreviations
- ⚠️ **Redundant Prefixes**: Suggests using Entities for repeated prefixes
- ℹ️ **Aspect Naming**: Singular vs plural based on properties
- ℹ️ **Unit Catalog**: Units should reference SAMM unit catalog
- ℹ️ **Constraints**: Encourages explicit constraints
- ℹ️ **External Standards**: Suggests "see" references for standards

## Usage

The action is automatically triggered on pull requests. It:

1. Detects changed `.ttl` files
2. Runs all MS2 checks
3. Posts results as a PR comment with ✅/❌/⚠️/ℹ️ indicators

## Manual Checks Still Required

Some MS2 criteria require human judgment and cannot be automated:

- Whether abbreviations are "sufficiently common"
- If redundant prefixes could be better organized
- Whether descriptions are "comprehensible"
- If constraints adequately capture all use case requirements
- Verification that all contributors are mentioned in copyright header

## Output Format

Results are posted as a markdown table in PR comments:

```
## MS2 Criteria Check Results

### File: `path/to/Model.ttl`

| Criterion | Status | Details |
|-----------|--------|----------|
| Model validates with SAMM SDK | ✅ | Model validates successfully |
| Use Camel-Case | ✅ | All elements follow CamelCase naming |
| ... | ... | ... |
```

## Development

To modify the checks:

1. Edit `.github/actions/ms2-checks/index.js`
2. Add/modify check functions
3. Update the `criteriaChecks` array in `generateReport()`
4. Test locally with `node index.js` (after setting inputs)

## Dependencies

- Node.js 16+
- Java 21+ (for SAMM CLI)
- SAMM CLI 2.11.1 (automatically downloaded)
