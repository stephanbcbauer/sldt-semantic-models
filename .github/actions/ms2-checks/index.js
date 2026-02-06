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
const tc = require('@actions/tool-cache');
const fs = require('fs');
const path = require('path');

// Import modular check functions
const namingChecks = require('./checks/naming');
const contentChecks = require('./checks/content');
const structureChecks = require('./checks/structure');
const fileChecks = require('./checks/files');
const validationChecks = require('./checks/validation');

/**
 * Central MS2 Checks Registry
 * Organized by category with unique IDs for easy reference and maintenance
 * ID Format: MS2_<category>_<number>
 * Categories: 1=Validation, 2=Naming, 3=Content, 4=Structure, 5=Files
 */
const MS2_CHECKS_REGISTRY = {
    // Category 1: SAMM Validation
    validation: [
        { id: 'MS2_1_1', key: 'sammValidation', label: 'Model validates with SAMM SDK', severity: 'critical', module: 'validation' }
    ],
    
    // Category 2: Naming Conventions
    naming: [
        { id: 'MS2_2_1', key: 'camelCase', label: 'Use Camel-Case', severity: 'critical', module: 'naming' },
        { id: 'MS2_2_2', key: 'noConsecutiveUnderscores', label: 'No consecutive underscores', severity: 'critical', module: 'naming' },
        { id: 'MS2_2_3', key: 'capitalLetterModelElements', label: 'Model elements start with capital letter', severity: 'critical', module: 'naming' },
        { id: 'MS2_2_4', key: 'smallLetterProperties', label: 'Properties start with small letter', severity: 'critical', module: 'naming' },
        { id: 'MS2_2_5', key: 'propertyCharacteristicNameDiff', label: 'Property and Characteristic names differ', severity: 'critical', module: 'naming' }
    ],
    
    // Category 3: Content Quality
    content: [
        { id: 'MS2_3_1', key: 'preferredNameAndDescription', label: 'Preferred name and description present', severity: 'critical', module: 'content' },
        { id: 'MS2_3_2', key: 'preferredNameDescriptionDiff', label: 'PreferredName and description differ', severity: 'critical', module: 'content' },
        { id: 'MS2_3_3', key: 'preferredNameHumanReadable', label: 'PreferredName is human readable', severity: 'critical', module: 'content' },
        { id: 'MS2_3_4', key: 'exampleValues', label: 'Example values for simple types', severity: 'critical', module: 'content' },
        { id: 'MS2_3_5', key: 'spelling', label: 'Spelling check (preferredName & description)', severity: 'advisory', module: 'content' }
    ],
    
    // Category 4: Model Structure
    structure: [
        { id: 'MS2_4_1', key: 'semanticVersioning', label: 'Semantic versioning', severity: 'critical', module: 'structure' },
        { id: 'MS2_4_2', key: 'abbreviationUsage', label: 'Abbreviation usage', severity: 'advisory', module: 'structure' },
        { id: 'MS2_4_3', key: 'redundantPrefixes', label: 'Redundant prefixes', severity: 'advisory', module: 'structure' },
        { id: 'MS2_4_4', key: 'aspectNaming', label: 'Aspect naming convention', severity: 'advisory', module: 'structure' },
        { id: 'MS2_4_5', key: 'unitCatalog', label: 'Units from SAMM catalog', severity: 'advisory', module: 'structure' },
        { id: 'MS2_4_6', key: 'constraints', label: 'Use constraints', severity: 'advisory', module: 'structure' },
        { id: 'MS2_4_7', key: 'externalStandards', label: 'External standards referenced', severity: 'advisory', module: 'structure' }
    ],
    
    // Category 5: Files & Metadata
    files: [
        { id: 'MS2_5_1', key: 'externalModelsState', label: 'External models have "release" state', severity: 'critical', module: 'files' },
        { id: 'MS2_5_2', key: 'metadataJson', label: 'metadata.json with status "release"', severity: 'critical', module: 'files' },
        { id: 'MS2_5_3', key: 'jsonSchemaValidation', label: 'JSON schema validates example payload', severity: 'critical', module: 'files' },
        { id: 'MS2_5_4', key: 'releaseNotes', label: 'RELEASE_NOTES.md exists', severity: 'critical', module: 'files' },
        { id: 'MS2_5_5', key: 'copyrightHeader', label: 'Copyright header with contributors', severity: 'critical', module: 'files' }
    ]
};

// Flatten registry for easy iteration
function getAllChecks() {
    return [
        ...MS2_CHECKS_REGISTRY.validation,
        ...MS2_CHECKS_REGISTRY.naming,
        ...MS2_CHECKS_REGISTRY.content,
        ...MS2_CHECKS_REGISTRY.structure,
        ...MS2_CHECKS_REGISTRY.files
    ];
}

var sammVersion = core.getInput('samm_version');
var sammSdkPath = `${__dirname}/samm-cli-${sammVersion}.jar`;

var added = JSON.parse(core.getInput('added'));
var modified = JSON.parse(core.getInput('modified'));
var prNumber = core.getInput('pr_number');
var repository = core.getInput('repository') || '';
var runId = core.getInput('run_id') || '';

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
        const report = generateReport(results, repository, runId);

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

    try {
        console.log(`Downloading SAMM CLI from ${url}...`);
        const downloadPath = await tc.downloadTool(url);
        
        // Move the downloaded file to the expected path
        fs.renameSync(downloadPath, sammSdkPath);
        console.log('SAMM SDK downloaded successfully');
    } catch (error) {
        throw new Error(`Failed to download SAMM SDK: ${error.message}`);
    }
}

async function runMS2Checks(files) {
    const allResults = [];

    for (const file of files) {
        console.log(`\n📄 Checking file: ${file}`);
        
        const modelDir = path.dirname(file);
        const modelName = path.basename(file, '.ttl');
        
        const result = {
            file: file,
            modelDir: modelDir,
            modelName: modelName,
            checks: {}
        };

        // Read TTL content for parsing
        const content = fs.readFileSync(file, 'utf8');
        
        // Run checks by category using the registry
        await runCheckCategory('validation', MS2_CHECKS_REGISTRY.validation, result, content, file, modelDir, modelName);
        await runCheckCategory('naming', MS2_CHECKS_REGISTRY.naming, result, content, file, modelDir, modelName);
        await runCheckCategory('content', MS2_CHECKS_REGISTRY.content, result, content, file, modelDir, modelName);
        await runCheckCategory('structure', MS2_CHECKS_REGISTRY.structure, result, content, file, modelDir, modelName);
        await runCheckCategory('files', MS2_CHECKS_REGISTRY.files, result, content, file, modelDir, modelName);

        allResults.push(result);
    }

    return allResults;
}

/**
 * Run all checks in a specific category
 */
async function runCheckCategory(categoryName, checks, result, content, file, modelDir, modelName) {
    const categoryIcons = {
        validation: '🔍',
        naming: '📝',
        content: '📋',
        structure: '🏗️',
        files: '📁'
    };
    
    const categoryLabels = {
        validation: 'SAMM Validation',
        naming: 'Naming Convention Checks',
        content: 'Content Quality Checks',
        structure: 'Model Structure Checks',
        files: 'Files & Metadata Checks'
    };
    
    console.log(`::group::${categoryIcons[categoryName]} ${categoryLabels[categoryName]}`);
    
    for (const check of checks) {
        // Execute the appropriate check function
        let checkResult;
        
        switch (check.key) {
            // Validation checks
            case 'sammValidation':
                checkResult = await validationChecks.checkSammValidation(file, sammSdkPath, sammVersion);
                break;
                
            // Naming checks
            case 'camelCase':
                checkResult = namingChecks.checkCamelCase(content);
                break;
            case 'noConsecutiveUnderscores':
                checkResult = namingChecks.checkNoConsecutiveUnderscores(content);
                break;
            case 'capitalLetterModelElements':
                checkResult = namingChecks.checkCapitalLetterModelElements(content);
                break;
            case 'smallLetterProperties':
                checkResult = namingChecks.checkSmallLetterProperties(content);
                break;
            case 'propertyCharacteristicNameDiff':
                checkResult = namingChecks.checkPropertyCharacteristicNameDiff(content);
                break;
                
            // Content checks
            case 'preferredNameAndDescription':
                checkResult = contentChecks.checkPreferredNameAndDescription(content);
                break;
            case 'preferredNameDescriptionDiff':
                checkResult = contentChecks.checkPreferredNameDescriptionDiff(content);
                break;
            case 'preferredNameHumanReadable':
                checkResult = contentChecks.checkPreferredNameHumanReadable(content);
                break;
            case 'exampleValues':
                checkResult = contentChecks.checkExampleValues(content);
                break;
            case 'spelling':
                checkResult = contentChecks.checkSpelling(content);
                break;
                
            // Structure checks
            case 'semanticVersioning':
                checkResult = structureChecks.checkSemanticVersioning(content, modelDir);
                break;
            case 'abbreviationUsage':
                checkResult = structureChecks.checkAbbreviationUsage(content);
                break;
            case 'redundantPrefixes':
                checkResult = structureChecks.checkRedundantPrefixes(content);
                break;
            case 'aspectNaming':
                checkResult = structureChecks.checkAspectNaming(content);
                break;
            case 'unitCatalog':
                checkResult = structureChecks.checkUnitCatalog(content);
                break;
            case 'constraints':
                checkResult = structureChecks.checkConstraints(content);
                break;
            case 'externalStandards':
                checkResult = structureChecks.checkExternalStandards(content);
                break;
                
            // File checks
            case 'externalModelsState':
                checkResult = await fileChecks.checkExternalModelsState(content);
                break;
            case 'metadataJson':
                checkResult = fileChecks.checkMetadataJson(modelDir);
                break;
            case 'jsonSchemaValidation':
                checkResult = await fileChecks.checkJsonSchemaValidation(modelDir, modelName);
                break;
            case 'releaseNotes':
                checkResult = fileChecks.checkReleaseNotes(modelDir);
                break;
            case 'copyrightHeader':
                checkResult = fileChecks.checkCopyrightHeader(content);
                break;
                
            default:
                checkResult = { status: 'info', message: 'Check not implemented' };
        }
        
        result.checks[check.key] = checkResult;
        console.log(`  [${check.id}] ${check.label}: ${checkResult.status}`);
    }
    
    console.log('::endgroup::');
}

function generateReport(results, repository, runId) {
    let report = '## MS2 Criteria Check Results\n\n';
    
    if (results.length === 0) {
        return report + 'No files to check.\n';
    }
    
    // Generate workflow run link if available
    let workflowLink = '';
    if (repository && runId) {
        workflowLink = `https://github.com/${repository}/actions/runs/${runId}`;
    }
    
    const allChecks = getAllChecks();
    
    // Calculate summary statistics
    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;
    let warningChecks = 0;
    let infoChecks = 0;
    
    for (const result of results) {
        for (const check of allChecks) {
            const checkResult = result.checks[check.key];
            if (checkResult) {
                totalChecks++;
                if (checkResult.status === 'pass') passedChecks++;
                else if (checkResult.status === 'fail') failedChecks++;
                else if (checkResult.status === 'warning') warningChecks++;
                else if (checkResult.status === 'info') infoChecks++;
            }
        }
    }
    
    // Add summary section
    report += '### Summary\n\n';
    report += `**Overall:** ${passedChecks}/${totalChecks} checks passed`;
    if (failedChecks > 0) report += ` | ${failedChecks} failed ❌`;
    if (warningChecks > 0) report += ` | ${warningChecks} warnings ⚠️`;
    if (infoChecks > 0) report += ` | ${infoChecks} info ℹ️`;
    report += '\n\n';
    
    if (workflowLink) {
        report += `🔗 [View detailed workflow run](${workflowLink})\n\n`;
    }
    
    if (failedChecks > 0) {
        report += '**❌ Failed Checks:**\n';
        for (const result of results) {
            const failedChecksList = [];
            for (const check of allChecks) {
                const checkResult = result.checks[check.key];
                if (checkResult && checkResult.status === 'fail') {
                    failedChecksList.push(`- [${check.id}] ${check.label}`);
                }
            }
            if (failedChecksList.length > 0) {
                report += `\nFile: \`${result.file}\`\n`;
                report += failedChecksList.join('\n') + '\n';
            }
        }
        report += '\n';
    }
    
    report += '---\n\n';
    
    // Detailed results per file - grouped by category
    for (const result of results) {
        report += `### File: \`${result.file}\`\n\n`;
        
        // Generate grouped tables by category
        const categories = [
            { name: 'validation', label: '🔍 **Category 1: SAMM Validation**', checks: MS2_CHECKS_REGISTRY.validation },
            { name: 'naming', label: '📝 **Category 2: Naming Conventions**', checks: MS2_CHECKS_REGISTRY.naming },
            { name: 'content', label: '📋 **Category 3: Content Quality**', checks: MS2_CHECKS_REGISTRY.content },
            { name: 'structure', label: '🏗️ **Category 4: Model Structure**', checks: MS2_CHECKS_REGISTRY.structure },
            { name: 'files', label: '📁 **Category 5: Files & Metadata**', checks: MS2_CHECKS_REGISTRY.files }
        ];
        
        for (const category of categories) {
            report += `${category.label}\n\n`;
            report += '| ID | Criterion | Severity | Status | Details |\n';
            report += '|----|-----------|----------|--------|----------|\n';
            
            for (const check of category.checks) {
                const checkResult = result.checks[check.key];
                let status = '⚪';
                let details = '';
                
                // Get severity icon
                const severityIcon = check.severity === 'critical' ? '🔴' : '🟡';
                
                if (checkResult) {
                    if (checkResult.status === 'pass') {
                        status = '✅';
                        details = checkResult.message;
                    } else if (checkResult.status === 'fail') {
                        status = '❌';
                        details = checkResult.message;
                        if (checkResult.details) {
                            // Handle both array and string details
                            if (Array.isArray(checkResult.details)) {
                                details += '<br>' + checkResult.details.join('<br>');
                            } else {
                                details += '<br>' + checkResult.details;
                            }
                        }
                        // Add link to workflow run for failed checks
                        if (workflowLink) {
                            details += `<br>[View in workflow run →](${workflowLink})`;
                        }
                    } else if (checkResult.status === 'warning') {
                        status = '⚠️';
                        details = checkResult.message;
                        if (checkResult.details) {
                            // Handle both array and string details
                            if (Array.isArray(checkResult.details)) {
                                details += '<br>' + checkResult.details.join('<br>');
                            } else {
                                details += '<br>' + checkResult.details;
                            }
                        }
                    } else if (checkResult.status === 'info') {
                        status = 'ℹ️';
                        details = checkResult.message;
                    }
                }
                
                report += `| ${check.id} | ${check.label} | ${severityIcon} | ${status} | ${details} |\n`;
            }
            
            report += '\n';
        }
    }
    
    report += '\n---\n\n';
    report += '### Legend\n\n';
    report += '**Status Icons:**\n';
    report += '- ✅ **Pass** - Check passed successfully\n';
    report += '- ❌ **Fail** - Check failed, action required\n';
    report += '- ⚠️ **Warning** - Review recommended, potential issue detected\n';
    report += '- ℹ️ **Info** - Informational, not applicable or advisory\n';
    report += '- ⚪ **Not Run** - Check was not executed\n';
    report += '\n';
    report += '**Severity Levels:**\n';
    report += '- 🔴 **Critical** - Must pass for MS2 compliance\n';
    report += '- 🟡 **Advisory** - Recommended best practice\n';
    report += '\n';
    report += '**Check ID Categories:**\n';
    report += '- 🔍 `MS2_1_x` - SAMM Validation\n';
    report += '- 📝 `MS2_2_x` - Naming Conventions\n';
    report += '- 📋 `MS2_3_x` - Content Quality\n';
    report += '- 🏗️ `MS2_4_x` - Model Structure\n';
    report += '- 📁 `MS2_5_x` - Files & Metadata\n';
    
    return report;
}

function writeOutputToFilesystem(content, fileName) {
    const outputDir = 'output';
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(outputDir, fileName), content);
}
