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

// Import modular check functions
const namingChecks = require('./checks/naming');
const contentChecks = require('./checks/content');
const structureChecks = require('./checks/structure');
const fileChecks = require('./checks/files');
const validationChecks = require('./checks/validation');

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
        
        // 1. SAMM validation
        console.log('::group::🔍 SAMM Validation');
        result.checks.sammValidation = await validationChecks.checkSammValidation(file, sammSdkPath);
        console.log(`  Status: ${result.checks.sammValidation.status}`);
        console.log('::endgroup::');

        // 2. Naming convention checks
        console.log('::group::📝 Naming Convention Checks');
        result.checks.camelCase = namingChecks.checkCamelCase(content);
        result.checks.noConsecutiveUnderscores = namingChecks.checkNoConsecutiveUnderscores(content);
        result.checks.capitalLetterModelElements = namingChecks.checkCapitalLetterModelElements(content);
        result.checks.smallLetterProperties = namingChecks.checkSmallLetterProperties(content);
        result.checks.propertyCharacteristicNameDiff = namingChecks.checkPropertyCharacteristicNameDiff(content);
        console.log(`  CamelCase: ${result.checks.camelCase.status}`);
        console.log(`  No consecutive underscores: ${result.checks.noConsecutiveUnderscores.status}`);
        console.log(`  Capital letters: ${result.checks.capitalLetterModelElements.status}`);
        console.log(`  Lowercase properties: ${result.checks.smallLetterProperties.status}`);
        console.log(`  Property/Characteristic names: ${result.checks.propertyCharacteristicNameDiff.status}`);
        console.log('::endgroup::');
        
        // 3. Content checks
        console.log('::group::📋 Content Quality Checks');
        result.checks.preferredNameAndDescription = contentChecks.checkPreferredNameAndDescription(content);
        result.checks.preferredNameDescriptionDiff = contentChecks.checkPreferredNameDescriptionDiff(content);
        result.checks.preferredNameHumanReadable = contentChecks.checkPreferredNameHumanReadable(content);
        result.checks.exampleValues = contentChecks.checkExampleValues(content);
        console.log(`  PreferredName & Description: ${result.checks.preferredNameAndDescription.status}`);
        console.log(`  Fields differ: ${result.checks.preferredNameDescriptionDiff.status}`);
        console.log(`  Human readable: ${result.checks.preferredNameHumanReadable.status}`);
        console.log(`  Example values: ${result.checks.exampleValues.status}`);
        console.log('::endgroup::');
        
        // 4. Structure checks
        console.log('::group::🏗️ Model Structure Checks');
        result.checks.semanticVersioning = structureChecks.checkSemanticVersioning(content, modelDir);
        result.checks.abbreviationUsage = structureChecks.checkAbbreviationUsage(content);
        result.checks.redundantPrefixes = structureChecks.checkRedundantPrefixes(content);
        result.checks.aspectNaming = structureChecks.checkAspectNaming(content);
        result.checks.unitCatalog = structureChecks.checkUnitCatalog(content);
        result.checks.constraints = structureChecks.checkConstraints(content);
        result.checks.externalStandards = structureChecks.checkExternalStandards(content);
        console.log(`  Semantic versioning: ${result.checks.semanticVersioning.status}`);
        console.log(`  Abbreviations: ${result.checks.abbreviationUsage.status}`);
        console.log(`  Redundant prefixes: ${result.checks.redundantPrefixes.status}`);
        console.log(`  Aspect naming: ${result.checks.aspectNaming.status}`);
        console.log(`  Unit catalog: ${result.checks.unitCatalog.status}`);
        console.log(`  Constraints: ${result.checks.constraints.status}`);
        console.log(`  External standards: ${result.checks.externalStandards.status}`);
        console.log('::endgroup::');
        
        // 5. File checks
        console.log('::group::📁 File & Metadata Checks');
        result.checks.externalModelsState = await fileChecks.checkExternalModelsState(content);
        result.checks.metadataJson = fileChecks.checkMetadataJson(modelDir);
        result.checks.jsonSchemaValidation = await fileChecks.checkJsonSchemaValidation(modelDir, modelName);
        result.checks.releaseNotes = fileChecks.checkReleaseNotes(modelDir);
        result.checks.copyrightHeader = fileChecks.checkCopyrightHeader(content);
        console.log(`  External models: ${result.checks.externalModelsState.status}`);
        console.log(`  metadata.json: ${result.checks.metadataJson.status}`);
        console.log(`  JSON schema: ${result.checks.jsonSchemaValidation.status}`);
        console.log(`  RELEASE_NOTES.md: ${result.checks.releaseNotes.status}`);
        console.log(`  Copyright header: ${result.checks.copyrightHeader.status}`);
        console.log('::endgroup::');

        allResults.push(result);
    }

    return allResults;
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
    
    // Calculate summary statistics
    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;
    let warningChecks = 0;
    let infoChecks = 0;
    
    for (const result of results) {
        for (const check of criteriaChecks) {
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
    
    // Add complete checks summary table
    report += '**All Checks Overview:**\n\n';
    report += '| Check | Status | Category |\n';
    report += '|-------|--------|----------|\n';
    
    // Aggregate status for each check across all files
    for (const check of criteriaChecks) {
        let overallStatus = '✅'; // Default to pass
        let hasFailure = false;
        let hasWarning = false;
        let hasInfo = false;
        
        for (const result of results) {
            const checkResult = result.checks[check.key];
            if (checkResult) {
                if (checkResult.status === 'fail') {
                    hasFailure = true;
                } else if (checkResult.status === 'warning') {
                    hasWarning = true;
                } else if (checkResult.status === 'info') {
                    hasInfo = true;
                }
            }
        }
        
        // Determine overall status (fail > warning > info > pass)
        if (hasFailure) {
            overallStatus = '❌';
        } else if (hasWarning) {
            overallStatus = '⚠️';
        } else if (hasInfo) {
            overallStatus = 'ℹ️';
        }
        
        const category = check.critical ? 'Critical' : 'Advisory';
        report += `| ${check.label} | ${overallStatus} | ${category} |\n`;
    }
    
    report += '\n';
    
    if (failedChecks > 0) {
        report += '**❌ Failed Checks Details:**\n';
        for (const result of results) {
            const failedChecksList = [];
            for (const check of criteriaChecks) {
                const checkResult = result.checks[check.key];
                if (checkResult && checkResult.status === 'fail') {
                    failedChecksList.push(`- ${check.label}`);
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
    
    // Detailed results per file
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
