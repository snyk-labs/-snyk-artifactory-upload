"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPipelineInfo = exports.processCode = exports.readFileContents = exports.findLocalReportFile = exports.encodeUrl = void 0;
const fs_1 = __importDefault(require("fs")); // Import the Node.js file system module
const tl = require("azure-pipelines-task-lib/task");
const path = require("path");
function encodeUrl(subdirectory) {
    return subdirectory
        .split('')
        .map(char => (char === '/' ? char : encodeURIComponent(char)))
        .join('');
}
exports.encodeUrl = encodeUrl;
function findLocalReportFile() {
    const givenDate = new Date();
    const directory = tl.getVariable('Agent.TempDirectory');
    const filesInDirectory = fs_1.default.readdirSync(directory);
    for (const file of filesInDirectory) {
        if (file.startsWith('report-') && file.endsWith('.json')) {
            const fileDateStr = file.replace('report-', '').replace('.json', '');
            const [year, month, day, hours, minutes, seconds] = fileDateStr.split(/[-T:]/);
            const fileDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds));
            if (!isNaN(fileDate.getTime())) {
                const tenMinutesInMilliseconds = 10 * 60 * 1000; // 10 minutes in milliseconds
                const differenceInMilliseconds = Math.abs(givenDate.getTime() - fileDate.getTime());
                if (true) {
                    const filePath = path.join(directory, file);
                    console.log("Snyk report file found: " + filePath);
                    return filePath; // File found and within 10 minutes of the given date
                }
            }
        }
    }
    return null; // No suitable file found
}
exports.findLocalReportFile = findLocalReportFile;
function readFileContents(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs_1.default.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error('Error reading the file:', err);
                    reject(err); // Reject the promise if there's an error
                    return;
                }
                try {
                    const jsonObject = JSON.parse(data); // Parse the data as JSON
                    resolve(jsonObject); // Resolve the promise with the parsed JSON object
                }
                catch (parseError) {
                    console.error('Error parsing JSON:', parseError);
                    console.log("Contents of Snyk JSON file: " + data);
                    resolve(null); // Resolve with null if parsing fails
                    process.exit(1);
                }
            });
        });
    });
}
exports.readFileContents = readFileContents;
function processCode(codeOutput) {
    var _a, _b;
    let scanProperties = {
        snyk_sast_scan_status: 'Complete',
        snyk_sast_findings_present: false,
        snyk_sast_highest_severity_level: 'None',
        snyk_sast_high_severity_count: 0,
        snyk_sast_medium_severity_count: 0,
        snyk_sast_low_severity_count: 0,
        snyk_sast_project_link: 'None'
    };
    if (codeOutput && Array.isArray(codeOutput['runs'])) {
        const runs = codeOutput['runs'];
        for (let runIndex = 0; runIndex < runs.length; runIndex++) {
            const run = runs[runIndex];
            if (run && Array.isArray(run['results'])) {
                const results = run['results'];
                //filter through each issue
                for (let issueIndex = 0; issueIndex < results.length; issueIndex++) {
                    scanProperties.snyk_sast_scan_status = "complete";
                    //process each issue and amend the codeOutput object
                    const issue = results[issueIndex];
                    if (issue.level == 'info' || issue.level == 'note') {
                        scanProperties.snyk_sast_low_severity_count++;
                        if (scanProperties.snyk_sast_highest_severity_level == 'None') {
                            scanProperties.snyk_sast_highest_severity_level = 'low';
                        }
                        scanProperties.snyk_sast_findings_present = true;
                    }
                    else if (issue.level == 'warning') {
                        scanProperties.snyk_sast_medium_severity_count++;
                        if (scanProperties.snyk_sast_highest_severity_level == 'None' || scanProperties.snyk_sast_highest_severity_level == 'low') {
                            scanProperties.snyk_sast_highest_severity_level = 'medium';
                        }
                        scanProperties.snyk_sast_findings_present = true;
                    }
                    else if (issue.level == 'error') {
                        scanProperties.snyk_sast_high_severity_count++;
                        if (scanProperties.snyk_sast_highest_severity_level == 'None' || scanProperties.snyk_sast_highest_severity_level == 'low' || scanProperties.snyk_sast_highest_severity_level == 'medium') {
                            scanProperties.snyk_sast_highest_severity_level = 'high';
                        }
                        scanProperties.snyk_sast_findings_present = true;
                    }
                }
                //add report data
                if (typeof ((_b = (_a = run === null || run === void 0 ? void 0 : run.properties) === null || _a === void 0 ? void 0 : _a.uploadResult) === null || _b === void 0 ? void 0 : _b.reportUrl) === 'string') {
                    scanProperties.snyk_sast_project_link = run.properties.uploadResult.reportUrl;
                }
            }
        }
    }
    return scanProperties;
}
exports.processCode = processCode;
// Function to add pipeline info to an existing object
function addPipelineInfo(existingObj) {
    try {
        // Retrieve pipeline variables
        const projectName = tl.getVariable('System.TeamProject');
        const repoName = tl.getVariable('Build.Repository.Name');
        const sourceBranch = tl.getVariable('Build.SourceBranch');
        // Add pipeline info to the existing object
        const newObj = Object.assign(Object.assign({}, existingObj), { ado_project_name: projectName, code_repository_name: repoName, code_branch_name: sourceBranch });
        return newObj;
    }
    catch (error) {
        console.error('Error:', error);
        // Handle errors here or return the original object if an error occurs
        return existingObj;
    }
}
exports.addPipelineInfo = addPipelineInfo;
