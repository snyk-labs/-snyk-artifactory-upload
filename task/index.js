"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const tl = require("azure-pipelines-task-lib/task");
const fs_1 = __importDefault(require("fs")); // Import the Node.js file system module
const Utils = __importStar(require("./helpers"));
const Artifactory = require('./artifactory-api-helpers');
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        //determine whether to use forward or backslash depending on OS
        const os = process.env.AGENT_OS;
        let slash;
        if (os === 'Windows_NT') {
            slash = '\\'; // Backslash for Windows
        }
        else {
            slash = '/'; // Forward slash for Linux and macOS
        }
        //Get operation to be performed, can be copy, process or both
        const operation = tl.getInput('Operation', true);
        const snykFilePath = tl.getInput('SnykDirectory') + slash;
        if (operation == "Copy" || operation == "CopyAndProcess") {
            //get file location from file path directory
            let fileLocation = "";
            try {
                console.log("Attempting to retrieve Snyk report file from location: " + snykFilePath);
                fileLocation = Utils.findLocalReportFile();
                if (fileLocation == null) {
                    console.log("Failed to find Snyk report file");
                    process.exit(1);
                }
            }
            catch (err) {
                console.log("Error retrieving Snyk report file: " + err);
                process.exit(1);
            }
            //create scan data object
            let scanData = {};
            if (fileLocation) {
                try {
                    let codeJson = yield Utils.readFileContents(fileLocation); // Only call function if fileLocation is defined
                    scanData = Utils.processCode(codeJson);
                }
                catch (err) {
                    console.log("Error processing code results: " + err);
                    process.exit(1);
                }
            }
            else {
                console.error('File location is undefined or empty.');
                process.exit(1);
            }
            //copy to filesystem
            try {
                const jsonFilePath = `${snykFilePath}SnykReport.json`;
                tl.writeFile(jsonFilePath, JSON.stringify(scanData));
                console.log(`Wrote Snyk vulnerability data to ${jsonFilePath} `);
            }
            catch (err) {
                console.error("Failed to upload Snyk report to path: " + snykFilePath);
                console.log(err);
                process.exit(1);
            }
        }
        if (operation == "Process" || operation == "CopyAndProcess") {
            //retrieve scan data
            let scanData = {};
            console.log("Proccesing Snyk data from: " + snykFilePath);
            try {
                let scanData = fs_1.default.readFileSync(`${snykFilePath}SnykReport.json`, 'utf-8');
                scanData = JSON.parse(scanData);
                console.log("Successfully retrieved scan data: " + JSON.stringify(scanData));
                //set properties in artifactory with scan data
                try {
                    Artifactory.setProperties(scanData);
                }
                catch (err) {
                    console.log("Error setting properties on artifact: " + err);
                    process.exit(1);
                }
            }
            catch (err) {
                console.error("Error while attempting to retrieve scan data: " + err);
                process.exit(1);
            }
            //test
        }
    });
}
run();
