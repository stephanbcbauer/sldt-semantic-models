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

/**
 * Naming convention checks for MS2 criteria
 */

// Check: Camel Case
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

// Check: No consecutive underscores
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

// Check: Capital letter for model elements (except properties)
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

// Check: Small letter for properties
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

// Check: Property and Characteristic should not have the same name
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

module.exports = {
    checkCamelCase,
    checkNoConsecutiveUnderscores,
    checkCapitalLetterModelElements,
    checkSmallLetterProperties,
    checkPropertyCharacteristicNameDiff
};
