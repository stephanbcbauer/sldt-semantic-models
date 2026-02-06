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

const fs = require('fs');
const path = require('path');

/**
 * File existence and format checks for MS2 criteria
 */

// Check: External models state
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

// Check: metadata.json
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

// Check: JSON schema validation
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

// Check: RELEASE_NOTES.md
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

// Check: Copyright header
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

module.exports = {
    checkExternalModelsState,
    checkMetadataJson,
    checkJsonSchemaValidation,
    checkReleaseNotes,
    checkCopyrightHeader
};
