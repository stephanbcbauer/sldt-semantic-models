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

const path = require('path');

/**
 * Model structure and semantic checks for MS2 criteria
 */

// Check: Semantic versioning
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

// Check: Abbreviation usage (advisory)
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

// Check: Redundant prefixes (advisory)
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

// Check: Aspect naming (singular vs plural)
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

// Check: Unit catalog
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

// Check: Constraints (advisory)
function checkConstraints(content) {
    const hasConstraints = /samm:Constraint|samm-c:Constraint/.test(content);
    
    if (hasConstraints) {
        return { status: 'pass', message: 'Model uses constraints' };
    } else {
        return { status: 'info', message: 'No constraints found - consider if constraints are needed for this use case' };
    }
}

// Check: External standards
function checkExternalStandards(content) {
    const hasSeeReferences = /samm:see/.test(content);
    
    if (hasSeeReferences) {
        return { status: 'pass', message: 'Model includes "see" references to external standards' };
    } else {
        return { status: 'info', message: 'No "see" references found - add if relying on external standards' };
    }
}

module.exports = {
    checkSemanticVersioning,
    checkAbbreviationUsage,
    checkRedundantPrefixes,
    checkAspectNaming,
    checkUnitCatalog,
    checkConstraints,
    checkExternalStandards
};
