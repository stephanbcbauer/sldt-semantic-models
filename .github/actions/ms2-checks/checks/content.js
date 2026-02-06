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
 * Content and description checks for MS2 criteria
 */

// Check: Preferred name and description
function checkPreferredNameAndDescription(content) {
    const issues = [];
    
    // Find all model elements - improved pattern to handle TTL formatting better
    const elementPattern = /^:(\w+)\s+a\s+samm:(\w+)\s*;/gm;
    let match;
    
    // Split content into sections for each element
    const lines = content.split('\n');
    let currentElement = null;
    let currentBody = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this line starts a new element definition
        const elementMatch = line.match(/^:(\w+)\s+a\s+samm:(\w+)\s*;/);
        
        if (elementMatch) {
            // Process previous element if exists
            if (currentElement) {
                const bodyText = currentBody.join('\n');
                const hasPreferredName = /samm:preferredName/.test(bodyText);
                const hasDescription = /samm:description/.test(bodyText);
                
                if (!hasPreferredName) {
                    issues.push(`Element '${currentElement}' is missing preferredName`);
                }
                if (!hasDescription) {
                    issues.push(`Element '${currentElement}' is missing description`);
                }
            }
            
            // Start new element
            currentElement = elementMatch[1];
            currentBody = [line];
        } else if (currentElement && line.trim()) {
            // Add to current element body
            currentBody.push(line);
            
            // Stop if we hit a new element or end
            if (line.match(/^\s*\./)) {
                // Process this element
                const bodyText = currentBody.join('\n');
                const hasPreferredName = /samm:preferredName/.test(bodyText);
                const hasDescription = /samm:description/.test(bodyText);
                
                if (!hasPreferredName) {
                    issues.push(`Element '${currentElement}' is missing preferredName`);
                }
                if (!hasDescription) {
                    issues.push(`Element '${currentElement}' is missing description`);
                }
                
                currentElement = null;
                currentBody = [];
            }
        }
    }
    
    // Process last element if exists
    if (currentElement && currentBody.length > 0) {
        const bodyText = currentBody.join('\n');
        const hasPreferredName = /samm:preferredName/.test(bodyText);
        const hasDescription = /samm:description/.test(bodyText);
        
        if (!hasPreferredName) {
            issues.push(`Element '${currentElement}' is missing preferredName`);
        }
        if (!hasDescription) {
            issues.push(`Element '${currentElement}' is missing description`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'All elements have preferredName and description' };
    } else {
        return { status: 'fail', message: 'Some elements are missing preferredName or description', details: issues };
    }
}

// Check: PreferredName vs description should be different
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

// Check: PreferredName should be human readable
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

// Check: Example values for simple types
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

// Check: Spelling in preferredName and description fields
// Check: Spelling check for preferredName and description
function checkSpelling(content) {
    const issues = [];
    
    // Common typos to detect (misspelling -> correct spelling)
    const commonTypos = {
        'recieve': 'receive', 'reciever': 'receiver', 'occured': 'occurred', 'occurance': 'occurrence',
        'seperate': 'separate', 'definately': 'definitely', 'accomodate': 'accommodate',
        'neccessary': 'necessary', 'succesful': 'successful', 'sucessful': 'successful',
        'adress': 'address', 'begining': 'beginning', 'beleive': 'believe',
        'buisness': 'business', 'calender': 'calendar', 'commited': 'committed',
        'concious': 'conscious', 'embarass': 'embarrass',
        'enviroment': 'environment', 'existance': 'existence', 'goverment': 'government',
        'independant': 'independent', 'maintainance': 'maintenance', 'occassion': 'occasion',
        'privelege': 'privilege', 'reccomend': 'recommend', 'refering': 'referring',
        'relavant': 'relevant', 'resistence': 'resistance', 'rythm': 'rhythm',
        'schedual': 'schedule', 'succeded': 'succeeded', 'tommorow': 'tomorrow',
        'untill': 'until', 'wierd': 'weird', 'vehicel': 'vehicle',
        'identifer': 'identifier', 'numbr': 'number', 'manufactur': 'manufacturer',
        'manufacurer': 'manufacturer', 'manufakturer': 'manufacturer', 'analisis': 'analysis',
        'certficate': 'certificate', 'certficates': 'certificates', 'measurment': 'measurement',
        'specifiation': 'specification', 'verson': 'version', 'revsion': 'revision',
        'decription': 'description', 'descripton': 'description', 'descritpion': 'description',
        'caracteristic': 'characteristic', 'charateristic': 'characteristic',
        'proprety': 'property', 'propety': 'property', 'verfication': 'verification',
        'validaton': 'validation', 'verfiy': 'verify', 'complient': 'compliant',
        'complience': 'compliance', 'configuraton': 'configuration', 'documention': 'documentation',
        'authentification': 'authentication', 'autorization': 'authorization'
    };
    
    // Extract preferredName and description values
    const textPattern = /samm:(preferredName|description)\s+"([^"]+)"/g;
    let match;
    const textsToCheck = [];
    
    while ((match = textPattern.exec(content)) !== null) {
        const fieldType = match[1];
        const text = match[2];
        textsToCheck.push({ fieldType, text });
    }
    
    if (textsToCheck.length === 0) {
        return { status: 'info', message: 'No preferredName or description fields found to check' };
    }
    
    // Check each text for spelling
    for (const item of textsToCheck) {
        const words = item.text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ') // Remove punctuation
            .split(/\s+/)
            .filter(word => word.length > 2); // Only check words with 3+ characters
        
        const foundTypos = [];
        for (const word of words) {
            // Skip numbers
            if (/^\d+$/.test(word)) continue;
            
            // Check against common typos
            if (commonTypos[word]) {
                foundTypos.push(`${word} (suggest: ${commonTypos[word]})`);
            }
        }
        
        if (foundTypos.length > 0) {
            issues.push(`Potential typos in ${item.fieldType} "${item.text}": ${foundTypos.join(', ')}`);
        }
    }
    
    if (issues.length === 0) {
        return { status: 'pass', message: 'No common spelling issues detected in preferredName and description fields' };
    } else {
        return { status: 'warning', message: 'Potential spelling issues detected', details: issues };
    }
}


module.exports = {
    checkPreferredNameAndDescription,
    checkPreferredNameDescriptionDiff,
    checkPreferredNameHumanReadable,
    checkExampleValues,
    checkSpelling
};
