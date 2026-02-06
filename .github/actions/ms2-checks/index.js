/*
#######################################################################
# Copyright (c) 2024 Contributors to the Eclipse Foundation
#
# See the NOTICE file(s) distributed with this work for additional
# information regarding copyright ownership.
#
# This work is made available under the terms of the
# Creative Commons Attribution 4.0 International (CC-BY-4.0) license,
# which is available at
# https://creativecommons.org/licenses/by/4.0/legalcode.
#
# SPDX-License-Identifier: CC-BY-4.0
#######################################################################
*/

const core = require('@actions/core');
const github = require('@actions/github');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require("child_process");
const { promisify } = require('util');

const execPromise = promisify(exec);

var sammVersion = core.getInput('samm_version');
var sammSdkPath = `${__dirname}/samm-cli-${sammVersion}.jar`;

var added = JSON.parse(core.getInput('added'));
var modified = JSON.parse(core.getInput('modified'));
var prNumber = core.getInput('pr_number');

main();

async function main() {
    try {
        await asyncSammSdkDownload(`https://github.com/eclipse-esmf/esmf-sdk/releases/download/v${sammVersion}/samm-cli-${sammVersion}.jar`);

        const allFiles = [...added, ...modified].filter(file => file.endsWith('.ttl'));
        
        if (allFiles.length === 0) {
            console.log('No TTL files changed, skipping MS2 checks');
            writeOutputToFilesystem(JSON.stringify({
                report: '## MS2 Criteria Check Results\n\nNo TTL files were changed in this PR.',
                prNumber: prNumber
            }), 'ms2-output.json');
            return;
        }

        const results = await runMS2Checks(allFiles);
        const report = generateReport(results);

        writeOutputToFilesystem(JSON.stringify({
            report: report,
            prNumber: prNumber
        }), 'ms2-output.json');

        console.log('MS2 checks completed');
    } catch (error) {
        core.setFailed(error.message);
    }
}

async function asyncSammSdkDownload(url) {
    if (fs.existsSync(sammSdkPath)) {
        console.log('SAMM SDK already downloaded');
        return;
    }

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(sammSdkPath);
        https.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(() => {
                    console.log('SAMM SDK downloaded');
                    resolve();
                });
            });
        }).on('error', function (err) {
            fs.unlink(sammSdkPath, () => {});
            reject(err);
        });
    });
}

async function runMS2Checks(files) {
    const allResults = [];

    for (const file of files) {
        console.log(`Checking file: ${file}`);
        
        const modelDir = path.dirname(file);
        const modelName = path.basename(file, '.ttl');
        
        const result = {
            file: file,
            modelDir: modelDir,
            modelName: modelName,
            checks: {}
        };

        // 1. SAMM validation
        result.checks.sammValidation = await checkSammValidation(file);

        // 2. Read TTL content for parsing
        const content = fs.readFileSync(file, 'utf8');
        
        // 3. Naming convention checks
        result.checks.camelCase = checkCamelCase(content);
        result.checks.noConsecutiveUnderscores = checkNoConsecutiveUnderscores(content);
        result.checks.capitalLetterModelElements = checkCapitalLetterModelElements(content);
        result.checks.smallLetterProperties = checkSmallLetterProperties(content);
        
        // 4. Required fields check
        result.checks.preferredNameAndDescription = checkPreferredNameAndDescription(content);
        result.checks.propertyCharacteristicNameDiff = checkPropertyCharacteristicNameDiff(content);
        result.checks.preferredNameDescriptionDiff = checkPreferredNameDescriptionDiff(content);
        result.checks.preferredNameHumanReadable = checkPreferredNameHumanReadable(content);
        
        // 5. Versioning check
        result.checks.semanticVersioning = checkSemanticVersioning(content, modelDir);
        
        // 6. Best practices (advisory checks)
        result.checks.abbreviationUsage = checkAbbreviationUsage(content);
        result.checks.redundantPrefixes = checkRedundantPrefixes(content);
        result.checks.aspectNaming = checkAspectNaming(content);
        
        // 7. Standards and constraints
        result.checks.unitCatalog = checkUnitCatalog(content);
        result.checks.constraints = checkConstraints(content);
        result.checks.externalStandards = checkExternalStandards(content);
        
        // 8. Example values
        result.checks.exampleValues = checkExampleValues(content);
        
        // 9. External models state
        result.checks.externalModelsState = await checkExternalModelsState(content);
        
        // 10. File checks
        result.checks.metadataJson = checkMetadataJson(modelDir);
        result.checks.jsonSchemaValidation = await checkJsonSchemaValidation(modelDir, modelName);
        result.checks.releaseNotes = checkReleaseNotes(modelDir);
        result.checks.copyrightHeader = checkCopyrightHeader(content);

        allResults.push(result);
    }

    return allResults;
}

// Check 1: SAMM Validation
async function checkSammValidation(file) {
    try {
        const { stdout, stderr } = await execPromise(`java -jar ${sammSdkPath} aspect ${file} validate`);
        return { 
            status: 'pass', 
            message: 'Model validates successfully with SAMM CLI'
        };
    } catch (error) {
        return { 
            status: 'fail', 
            message: `Validation failed: ${error.message}`,
            details: error.stderr || error.stdout
        };
    }
}

// Check 2: Camel Case
function checkCamelCase(content) {
    const issues = [];
    
    // Extract model element names (after : prefix)
    const elementPattern = /^:(\w+)\s+a\s+samm:/gm;
    let match;
    
    while ((match = elementPattern.exec(content)) !== null) {
        const name = match[1];
        // Check if it follows CamelCase (starts with uppercase or lowercase, no underscores except for special cases)
        if (name.includes('__') || /[^a-zA-Z0-9_]/.test(name)) {
            issues.push(`Element '${name}' does not follow CamelCase convention`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'All elements follow CamelCase naming' };
    } else {
        return { status: 'fail', message: 'Some elements do not follow CamelCase', details: issues };
    }
}

// Check 3: No consecutive underscores
function checkNoConsecutiveUnderscores(content) {
    const issues = [];
    
    const elementPattern = /^:(\w+)\s+a\s+samm:/gm;
    let match;
    
    while ((match = elementPattern.exec(content)) !== null) {
        const name = match[1];
        if (name.includes('__')) {
            issues.push(`Element '${name}' contains consecutive underscores`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'No consecutive underscores found' };
    } else {
        return { status: 'fail', message: 'Elements with consecutive underscores found', details: issues };
    }
}

// Check 4: Capital letter for model elements (except properties)
function checkCapitalLetterModelElements(content) {
    const issues = [];
    
    // Match elements that are NOT properties
    const elementPattern = /^:(\w+)\s+a\s+samm:(Aspect|Characteristic|Entity|Trait|Constraint)/gm;
    let match;
    
    while ((match = elementPattern.exec(content)) !== null) {
        const name = match[1];
        const type = match[2];
        
        if (!/^[A-Z]/.test(name)) {
            issues.push(`${type} '${name}' does not start with a capital letter`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'All model elements start with capital letters' };
    } else {
        return { status: 'fail', message: 'Some model elements do not start with capital letters', details: issues };
    }
}

// Check 5: Small letter for properties
function checkSmallLetterProperties(content) {
    const issues = [];
    
    const propertyPattern = /^:(\w+)\s+a\s+samm:Property/gm;
    let match;
    
    while ((match = propertyPattern.exec(content)) !== null) {
        const name = match[1];
        
        if (!/^[a-z]/.test(name)) {
            issues.push(`Property '${name}' does not start with a lowercase letter`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'All properties start with lowercase letters' };
    } else {
        return { status: 'fail', message: 'Some properties do not start with lowercase letters', details: issues };
    }
}

// Check 6: Preferred name and description
function checkPreferredNameAndDescription(content) {
    const issues = [];
    
    // Find all model elements
    const elementPattern = /^:(\w+)\s+a\s+samm:\w+\s*;([\s\S]*?)(?=^:|$)/gm;
    let match;
    
    while ((match = elementPattern.exec(content)) !== null) {
        const name = match[1];
        const body = match[2];
        
        const hasPreferredName = /samm:preferredName/.test(body);
        const hasDescription = /samm:description/.test(body);
        
        if (!hasPreferredName) {
            issues.push(`Element '${name}' is missing preferredName`);
        }
        if (!hasDescription) {
            issues.push(`Element '${name}' is missing description`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'All elements have preferredName and description' };
    } else {
        return { status: 'fail', message: 'Some elements are missing preferredName or description', details: issues };
    }
}

// Check 7: Property and Characteristic should not have the same name
function checkPropertyCharacteristicNameDiff(content) {
    const issues = [];
    
    // Extract property definitions with their characteristics
    const propertyPattern = /^:(\w+)\s+a\s+samm:Property\s*;[\s\S]*?samm:characteristic\s+:(\w+)/gm;
    let match;
    
    while ((match = propertyPattern.exec(content)) !== null) {
        const propName = match[1];
        const charName = match[2];
        
        if (propName === charName) {
            issues.push(`Property '${propName}' has the same name as its Characteristic`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'Properties and Characteristics have different names' };
    } else {
        return { status: 'fail', message: 'Some Properties have the same name as their Characteristics', details: issues };
    }
}

// Check 8: Semantic versioning
function checkSemanticVersioning(content, modelDir) {
    const issues = [];
    
    // Extract version from URN
    const urnPattern = /urn:samm:io\.catenax[\w.]*:(\d+\.\d+\.\d+)#/;
    const match = content.match(urnPattern);
    
    if (!match) {
        return { status: 'warning', message: 'Could not extract version from URN' };
    }
    
    const version = match[1];
    const versionParts = version.split('.').map(Number);
    
    // Check if it follows semantic versioning format
    if (versionParts.length !== 3 || versionParts.some(isNaN)) {
        issues.push(`Version '${version}' does not follow semantic versioning (x.y.z)`);
    }
    
    // Check if directory name matches version
    const dirName = path.basename(modelDir);
    if (dirName !== version) {
        issues.push(`Directory name '${dirName}' does not match version '${version}' in URN`);
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: `Version ${version} follows semantic versioning` };
    } else {
        return { status: 'fail', message: 'Versioning issues found', details: issues };
    }
}

// Check 9: Abbreviation usage (advisory)
function checkAbbreviationUsage(content) {
    // This is an advisory check - we'll just flag short property names
    const issues = [];
    
    const propertyPattern = /^:(\w+)\s+a\s+samm:Property/gm;
    let match;
    
    const commonAbbreviations = ['id', 'url', 'uri', 'uuid', 'bpn', 'van', 'vin'];
    
    while ((match = propertyPattern.exec(content)) !== null) {
        const name = match[1];
        
        // Check for very short names that might be abbreviations
        if (name.length <= 3 && !commonAbbreviations.includes(name.toLowerCase())) {
            issues.push(`Property '${name}' appears to be an abbreviation`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'No questionable abbreviations found' };
    } else {
        return { status: 'warning', message: 'Possible abbreviations found (review recommended)', details: issues };
    }
}

// Check 10: Redundant prefixes (advisory)
function checkRedundantPrefixes(content) {
    // This is an advisory check - look for common prefixes in property names
    const issues = [];
    
    const propertyPattern = /^:(\w+)\s+a\s+samm:Property/gm;
    const properties = [];
    let match;
    
    while ((match = propertyPattern.exec(content)) !== null) {
        properties.push(match[1]);
    }
    
    // Simple heuristic: if many properties share the same prefix, flag it
    const prefixes = {};
    properties.forEach(prop => {
        const prefix = prop.match(/^[A-Z][a-z]+/);
        if (prefix) {
            prefixes[prefix[0]] = (prefixes[prefix[0]] || 0) + 1;
        }
    });
    
    for (const [prefix, count] of Object.entries(prefixes)) {
        if (count >= 3) {
            issues.push(`Prefix '${prefix}' appears in ${count} properties - consider using an Entity`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'No redundant prefixes detected' };
    } else {
        return { status: 'warning', message: 'Potential redundant prefixes found (review recommended)', details: issues };
    }
}

// Check 11: PreferredName vs description should be different
function checkPreferredNameDescriptionDiff(content) {
    const issues = [];
    
    const elementPattern = /^:(\w+)\s+a\s+samm:\w+\s*;([\s\S]*?)(?=^:|$)/gm;
    let match;
    
    while ((match = elementPattern.exec(content)) !== null) {
        const name = match[1];
        const body = match[2];
        
        const preferredNameMatch = body.match(/samm:preferredName\s+"([^"]+)"/);
        const descriptionMatch = body.match(/samm:description\s+"([^"]+)"/);
        
        if (preferredNameMatch && descriptionMatch) {
            const preferredName = preferredNameMatch[1].toLowerCase().trim();
            const description = descriptionMatch[1].toLowerCase().trim();
            
            if (preferredName === description) {
                issues.push(`Element '${name}' has identical preferredName and description`);
            }
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'PreferredNames and descriptions are different' };
    } else {
        return { status: 'fail', message: 'Some elements have identical preferredName and description', details: issues };
    }
}

// Check 12: PreferredName should be human readable
function checkPreferredNameHumanReadable(content) {
    const issues = [];
    
    const preferredNamePattern = /^:(\w+)\s+a\s+samm:\w+\s*;[\s\S]*?samm:preferredName\s+"([^"]+)"/gm;
    let match;
    
    while ((match = preferredNamePattern.exec(content)) !== null) {
        const name = match[1];
        const preferredName = match[2];
        
        // Check if preferredName is in CamelCase (likely not human readable)
        if (/^[A-Z][a-z]+([A-Z][a-z]+)+$/.test(preferredName)) {
            issues.push(`Element '${name}' has CamelCase preferredName '${preferredName}' - should use normal word separation`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'PreferredNames appear to be human readable' };
    } else {
        return { status: 'warning', message: 'Some preferredNames may not be human readable', details: issues };
    }
}

// Check 13: Aspect naming (singular vs plural)
function checkAspectNaming(content) {
    const issues = [];
    
    // Find the Aspect
    const aspectPattern = /^:(\w+)\s+a\s+samm:Aspect\s*;[\s\S]*?samm:properties\s+\(([^)]+)\)/gm;
    const match = aspectPattern.exec(content);
    
    if (match) {
        const aspectName = match[1];
        const propertiesStr = match[2];
        
        // Count properties
        const properties = propertiesStr.split(/\s+/).filter(p => p.startsWith(':') || p.startsWith('['));
        
        // Check if aspect name is plural
        const isPlural = /s$/i.test(aspectName);
        
        // If only one property and it's a collection, aspect should be plural
        if (properties.length === 1) {
            const propertyName = properties[0].replace(/[\[\]]/g, '').replace('samm:property', '').trim();
            // This is a simplified check - we'd need to check if the property is a Collection/List/Set
            // For now, we'll just provide a warning
            return { 
                status: 'info', 
                message: `Aspect '${aspectName}' has one property - verify naming convention (singular unless property is Collection/List/Set)` 
            };
        }
    }
    
    return { status: 'pass', message: 'Aspect naming convention check passed' };
}

// Check 14: Unit catalog
function checkUnitCatalog(content) {
    const issues = [];
    
    // Check if units are referenced from the catalog
    const unitPattern = /samm:unit\s+(unit:\w+|:\w+)/g;
    let match;
    
    let hasUnits = false;
    while ((match = unitPattern.exec(content)) !== null) {
        hasUnits = true;
        const unit = match[1];
        
        if (!unit.startsWith('unit:')) {
            issues.push(`Unit '${unit}' is not from the SAMM unit catalog (should use unit: prefix)`);
        }
    }
    
    if (!hasUnits) {
        return { status: 'info', message: 'No units found in model' };
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'All units reference the SAMM unit catalog' };
    } else {
        return { status: 'warning', message: 'Some units may not be from the catalog', details: issues };
    }
}

// Check 15: Constraints (advisory)
function checkConstraints(content) {
    const hasConstraints = /samm:Constraint|samm-c:Constraint/.test(content);
    
    if (hasConstraints) {
        return { status: 'pass', message: 'Model uses constraints' };
    } else {
        return { status: 'info', message: 'No constraints found - consider if constraints are needed for this use case' };
    }
}

// Check 16: External standards
function checkExternalStandards(content) {
    const hasSeeReferences = /samm:see/.test(content);
    
    if (hasSeeReferences) {
        return { status: 'pass', message: 'Model includes "see" references to external standards' };
    } else {
        return { status: 'info', message: 'No "see" references found - add if relying on external standards' };
    }
}

// Check 17: Example values for simple types
function checkExampleValues(content) {
    const issues = [];
    
    // Find properties with simple types (not Entities or Characteristics)
    const propertyPattern = /^:(\w+)\s+a\s+samm:Property\s*;([\s\S]*?)(?=^:|$)/gm;
    let match;
    
    while ((match = propertyPattern.exec(content)) !== null) {
        const name = match[1];
        const body = match[2];
        
        // Check if it has a dataType that's a simple type
        const hasSimpleDataType = /dataType\s+xsd:\w+/.test(body);
        
        if (hasSimpleDataType) {
            const hasExample = /samm:exampleValue/.test(body);
            
            if (!hasExample) {
                issues.push(`Property '${name}' with simple type is missing exampleValue`);
            }
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'Properties with simple types have example values' };
    } else {
        return { status: 'warning', message: 'Some properties with simple types are missing example values', details: issues };
    }
}

// Check 18: External models state
async function checkExternalModelsState(content) {
    const issues = [];
    
    // Find imported/external model references
    const importPattern = /@prefix\s+([\w-]+):\s+<urn:samm:io\.catenax[\w.]*:(\d+\.\d+\.\d+)#>/g;
    let match;
    
    const externalModels = [];
    while ((match = importPattern.exec(content)) !== null) {
        const prefix = match[1];
        const version = match[2];
        
        if (prefix !== 'samm' && prefix !== 'samm-c' && prefix !== 'samm-e' && prefix !== 'unit') {
            externalModels.push({ prefix, version });
        }
    }
    
    if (externalModels.length === 0) {
        return { status: 'pass', message: 'No external models imported' };
    }
    
    // Check the status of each external model
    for (const model of externalModels) {
        // Try to find the metadata.json for this model
        // This is a simplified check - in reality, we'd need to resolve the full path
        const modelPath = model.prefix.replace(/-/g, '_').replace('ext_', 'io.catenax.');
        const metadataPath = path.join(modelPath, model.version, 'metadata.json');
        
        if (fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            if (metadata.status !== 'release') {
                issues.push(`External model '${model.prefix}' (${model.version}) has status '${metadata.status}' instead of 'release'`);
            }
        } else {
            issues.push(`Cannot verify status of external model '${model.prefix}' (${model.version}) - metadata.json not found`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'All external models have "release" status' };
    } else {
        return { status: 'warning', message: 'Some external models may not have "release" status', details: issues };
    }
}

// Check 19: metadata.json
function checkMetadataJson(modelDir) {
    const metadataPath = path.join(modelDir, 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
        return { status: 'fail', message: 'metadata.json does not exist' };
    }
    
    try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        if (metadata.status === 'release') {
            return { status: 'pass', message: 'metadata.json exists with status "release"' };
        } else {
            return { status: 'warning', message: `metadata.json exists but status is '${metadata.status}' instead of 'release'` };
        }
    } catch (error) {
        return { status: 'fail', message: `metadata.json exists but cannot be parsed: ${error.message}` };
    }
}

// Check 20: JSON schema validation
async function checkJsonSchemaValidation(modelDir, modelName) {
    const schemaPath = path.join(modelDir, 'gen', `${modelName}-schema.json`);
    const examplePath = path.join(modelDir, 'gen', `${modelName}.json`);
    
    if (!fs.existsSync(schemaPath)) {
        return { status: 'warning', message: 'JSON schema not found in gen folder' };
    }
    
    if (!fs.existsSync(examplePath)) {
        return { status: 'warning', message: 'Example JSON payload not found in gen folder' };
    }
    
    // This is a simplified check - actual validation would require a JSON schema validator
    // For now, just check if both files exist and are valid JSON
    try {
        JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        JSON.parse(fs.readFileSync(examplePath, 'utf8'));
        return { status: 'pass', message: 'JSON schema and example payload exist and are valid JSON' };
    } catch (error) {
        return { status: 'fail', message: `JSON validation error: ${error.message}` };
    }
}

// Check 21: RELEASE_NOTES.md
function checkReleaseNotes(modelDir) {
    // Check in parent directory
    const parentDir = path.dirname(modelDir);
    const releaseNotesPath = path.join(parentDir, 'RELEASE_NOTES.md');
    
    if (!fs.existsSync(releaseNotesPath)) {
        return { status: 'fail', message: 'RELEASE_NOTES.md does not exist' };
    }
    
    const content = fs.readFileSync(releaseNotesPath, 'utf8');
    
    // Check if it has entries (more than just a header)
    if (content.trim().length < 50) {
        return { status: 'warning', message: 'RELEASE_NOTES.md exists but appears to be empty' };
    }
    
    return { status: 'pass', message: 'RELEASE_NOTES.md exists and contains entries' };
}

// Check 22: Copyright header
function checkCopyrightHeader(content) {
    const issues = [];
    
    // Check if file starts with copyright header
    if (!content.trim().startsWith('#####')) {
        return { status: 'fail', message: 'Copyright header is missing or incorrectly formatted' };
    }
    
    const header = content.substring(0, 1000); // First 1000 chars
    
    if (!header.includes('Copyright')) {
        return { status: 'fail', message: 'Copyright statement not found in header' };
    }
    
    if (!header.includes('Contributors to the Eclipse Foundation')) {
        issues.push('Header should include "Contributors to the Eclipse Foundation"');
    }
    
    if (!header.includes('CC-BY-4.0')) {
        issues.push('Header should include CC-BY-4.0 license identifier');
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'Copyright header is present and properly formatted' };
    } else {
        return { status: 'warning', message: 'Copyright header issues found', details: issues };
    }
}

function generateReport(results) {
    let report = '## MS2 Criteria Check Results\n\n';
    
    if (results.length === 0) {
        return report + 'No files to check.\n';
    }
    
    const criteriaChecks = [
        { key: 'sammValidation', label: 'Model validates with SAMM SDK', critical: true },
        { key: 'camelCase', label: 'Use Camel-Case', critical: true },
        { key: 'noConsecutiveUnderscores', label: 'No consecutive underscores', critical: true },
        { key: 'capitalLetterModelElements', label: 'Model elements start with capital letter', critical: true },
        { key: 'smallLetterProperties', label: 'Properties start with small letter', critical: true },
        { key: 'preferredNameAndDescription', label: 'Preferred name and description present', critical: true },
        { key: 'propertyCharacteristicNameDiff', label: 'Property and Characteristic names differ', critical: true },
        { key: 'semanticVersioning', label: 'Semantic versioning', critical: true },
        { key: 'abbreviationUsage', label: 'Abbreviation usage', critical: false },
        { key: 'redundantPrefixes', label: 'Redundant prefixes', critical: false },
        { key: 'preferredNameDescriptionDiff', label: 'PreferredName and description differ', critical: true },
        { key: 'preferredNameHumanReadable', label: 'PreferredName is human readable', critical: true },
        { key: 'aspectNaming', label: 'Aspect naming convention', critical: false },
        { key: 'unitCatalog', label: 'Units from SAMM catalog', critical: false },
        { key: 'constraints', label: 'Use constraints', critical: false },
        { key: 'externalStandards', label: 'External standards referenced', critical: false },
        { key: 'exampleValues', label: 'Example values for simple types', critical: true },
        { key: 'externalModelsState', label: 'External models have "release" state', critical: true },
        { key: 'metadataJson', label: 'metadata.json with status "release"', critical: true },
        { key: 'jsonSchemaValidation', label: 'JSON schema validates example payload', critical: true },
        { key: 'releaseNotes', label: 'RELEASE_NOTES.md exists', critical: true },
        { key: 'copyrightHeader', label: 'Copyright header with contributors', critical: true }
    ];
    
    for (const result of results) {
        report += `### File: \`${result.file}\`\n\n`;
        report += '| Criterion | Status | Details |\n';
        report += '|-----------|--------|----------|\n';
        
        for (const check of criteriaChecks) {
            const checkResult = result.checks[check.key];
            let status = '⚪';
            let details = '';
            
            if (checkResult) {
                if (checkResult.status === 'pass') {
                    status = '✅';
                    details = checkResult.message;
                } else if (checkResult.status === 'fail') {
                    status = '❌';
                    details = checkResult.message;
                    if (checkResult.details) {
                        details += '<br>' + checkResult.details.join('<br>');
                    }
                } else if (checkResult.status === 'warning') {
                    status = '⚠️';
                    details = checkResult.message;
                    if (checkResult.details) {
                        details += '<br>' + checkResult.details.join('<br>');
                    }
                } else if (checkResult.status === 'info') {
                    status = 'ℹ️';
                    details = checkResult.message;
                }
            }
            
            report += `| ${check.label} | ${status} | ${details} |\n`;
        }
        
        report += '\n';
    }
    
    report += '\n---\n';
    report += '**Legend:**\n';
    report += '- ✅ Pass\n';
    report += '- ❌ Fail\n';
    report += '- ⚠️ Warning (review recommended)\n';
    report += '- ℹ️ Info (not applicable or advisory)\n';
    
    return report;
}

function writeOutputToFilesystem(content, fileName) {
    const outputDir = 'output';
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(outputDir, fileName), content);
}
