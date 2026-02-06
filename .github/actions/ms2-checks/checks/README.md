# MS2 Checks - Developer Guide

This directory contains modular check functions organized by category for better maintainability.

## Structure

Each category has its own module file:

- **`validation.js`** - SAMM CLI validation checks
- **`naming.js`** - Naming convention checks
- **`content.js`** - Content quality checks (preferredName, description, spelling)
- **`structure.js`** - Model structure checks (versioning, aspects, constraints)
- **`files.js`** - File and metadata checks

## Check ID System

All checks use a standardized ID format: `MS2_<category>_<number>`

### Categories:
- **MS2_1_x**: SAMM Validation
- **MS2_2_x**: Naming Conventions
- **MS2_3_x**: Content Quality
- **MS2_4_x**: Model Structure
- **MS2_5_x**: Files & Metadata

## How to Add a New Check

### Step 1: Decide the Category

Determine which category your check belongs to:
- **Validation**: Checks using SAMM CLI
- **Naming**: Naming conventions and patterns
- **Content**: Quality of human-readable content
- **Structure**: Model architecture and relationships
- **Files**: File existence and metadata

### Step 2: Assign an ID

Pick the next available number in your category:
- Look at `../index.js` in the `MS2_CHECKS_REGISTRY` object
- Find your category (e.g., `content`)
- Use the next sequential number (e.g., if MS2_3_5 exists, use MS2_3_6)

### Step 3: Implement the Check Function

Add your function to the appropriate module file (e.g., `content.js`):

```javascript
/**
 * MS2_3_6: Check for proper terminology usage
 * Ensures model uses standardized terminology
 */
function checkTerminology(content) {
    const issues = [];
    
    // Your check logic here
    const badTerms = content.match(/deprecated-term/gi);
    if (badTerms) {
        issues.push('Found deprecated terminology');
    }
    
    if (issues.length === 0) {
        return { 
            status: 'pass', 
            message: 'All terminology is current' 
        };
    } else {
        return { 
            status: 'fail',  // or 'warning', 'info'
            message: 'Terminology issues found', 
            details: issues  // Array or string
        };
    }
}
```

**Important:** Always export your function:
```javascript
module.exports = {
    checkPreferredNameAndDescription,
    checkSpelling,
    checkTerminology,  // <-- Add your new check here
    // ... other exports
};
```

### Step 4: Register in the Central Registry

Open `../index.js` and add your check to `MS2_CHECKS_REGISTRY`:

```javascript
// Category 3: Content Quality
content: [
    { id: 'MS2_3_1', key: 'preferredNameAndDescription', label: 'Preferred name and description present', severity: 'critical', module: 'content' },
    // ... existing checks ...
    { id: 'MS2_3_6', key: 'terminology', label: 'Proper terminology usage', severity: 'advisory', module: 'content' }  // <-- Add here
],
```

**Fields:**
- `id`: Your unique MS2 ID (e.g., 'MS2_3_6')
- `key`: Function name without 'check' prefix (e.g., 'terminology')
- `label`: Human-readable description
- `severity`: `'critical'` for critical checks, `'advisory'` for best practices
- `module`: Category name ('validation', 'naming', 'content', 'structure', 'files')

### Step 5: Add to the Executor

In `../index.js`, find the `runCheckCategory()` function and add your case:

```javascript
// Content checks
case 'terminology':
    checkResult = contentChecks.checkTerminology(content);
    break;
```

### Step 6: Test Your Check

1. Create a test TTL file with your scenario
2. Run the action locally or in a test PR
3. Verify the check runs and reports correctly
4. Check that it appears in the grouped output under the right category

## Check Function Guidelines

### Return Format

Always return an object with:
```javascript
{
    status: 'pass' | 'fail' | 'warning' | 'info',
    message: 'Brief description of result',
    details: ['Optional', 'array', 'of', 'issues']  // or string
}
```

### Status Meanings

- **`pass`** ✅: Check passed successfully
- **`fail`** ❌: Critical issue found, needs fixing
- **`warning`** ⚠️: Non-critical issue, review recommended
- **`info`** ℹ️: Informational only, not applicable or advisory

### Best Practices

1. **Keep functions focused**: One check per function
2. **Use clear variable names**: Make code self-documenting
3. **Handle edge cases**: Empty content, missing fields, etc.
4. **Provide actionable feedback**: Tell users what to fix
5. **Use regex carefully**: Test patterns thoroughly
6. **Document assumptions**: Add comments explaining logic

### Example Patterns

**Checking for presence:**
```javascript
if (content.includes('samm:preferredName')) {
    return { status: 'pass', message: 'Found preferredName' };
}
```

**Pattern matching:**
```javascript
const pattern = /^:(\w+)\s+a\s+samm:/gm;
const matches = [...content.matchAll(pattern)];
```

**Multiple issues:**
```javascript
const issues = [];
// collect issues...
if (issues.length === 0) {
    return { status: 'pass', message: 'All good' };
} else {
    return { status: 'fail', message: 'Issues found', details: issues };
}
```

## Output Organization

Your check will automatically appear in:

1. **Console logs**: Grouped by category with your ID
   ```
   ::group::📋 Content Quality Checks
     [MS2_3_6] Proper terminology usage: pass
   ::endgroup::
   ```

2. **PR Comment**: In a category-specific table
   ```markdown
   📋 **Category 3: Content Quality**
   | ID | Criterion | Severity | Status | Details |
   | MS2_3_6 | Proper terminology usage | 🟡 | ✅ | All terminology is current |
   ```

3. **Summary**: Included in overall statistics

**Severity Icons:**
- 🔴 **Critical** - Must pass for MS2 compliance
- 🟡 **Advisory** - Recommended best practice

## Questions?

- Check existing checks in the module files for examples
- Look at `../index.js` for the registry structure
- Review console output in GitHub Actions for debugging
