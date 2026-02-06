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

const { promisify } = require('util');
const { exec } = require("child_process");

const execPromise = promisify(exec);

/**
 * SAMM validation checks for MS2 criteria
 */

// Check: SAMM Validation
async function checkSammValidation(file, sammSdkPath, sammVersion) {
    try {
        const { stdout, stderr } = await execPromise(`java -jar ${sammSdkPath} aspect ${file} validate`);
        return { 
            status: 'pass', 
            message: `Model validates successfully with SAMM CLI ${sammVersion}`
        };
    } catch (error) {
        return { 
            status: 'fail', 
            message: `Validation failed with SAMM CLI ${sammVersion}: ${error.message}`,
            details: error.stderr || error.stdout
        };
    }
}

module.exports = {
    checkSammValidation
};
