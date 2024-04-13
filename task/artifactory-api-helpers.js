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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setProperties = void 0;
const tl = require("azure-pipelines-task-lib/task");
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const Utils = __importStar(require("./helpers"));
(0, axios_retry_1.default)(axios_1.default, {
    retries: 10, // Number of retries
    retryDelay: axios_retry_1.default.exponentialDelay, // Retry delay strategy
    onRetry: (retryCount, error, Config) => { console.log("Axios request failed with " + error + " retrying now.."); }
});
function setProperties(properties) {
    var _a, _b;
    const inputType = (_a = tl.getInput("InputType", true)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    // get username/password details from service connection
    const serviceConnectionId = tl.getInput('artifactoryServiceConnection', true);
    const auth = tl.getEndpointAuthorization(serviceConnectionId, false);
    let authType = tl.getEndpointAuthorizationScheme(serviceConnectionId, false);
    let authToken = '';
    if (authType == 'UsernamePassword') {
        const username = auth === null || auth === void 0 ? void 0 : auth.parameters['username'];
        const password = auth === null || auth === void 0 ? void 0 : auth.parameters['password'];
        authToken = Buffer.from(`${username}:${password}`).toString('base64');
        authType = 'Basic';
    }
    else if (authType == 'Token') {
        authToken = auth === null || auth === void 0 ? void 0 : auth.parameters['apitoken'];
        authType = 'Bearer';
    }
    const baseUrl = tl.getEndpointUrl(serviceConnectionId, true);
    //set API headers
    const headers = {
        Authorization: `${authType} ${authToken}`,
        'Content-Type': 'application/json', // Set content type based on your requirements
    };
    //Retrieve artifact URLs
    let artifactUrls = [];
    if (inputType == "urllist") {
        const delimiter = tl.getInput('delimiter', false) || ',';
        artifactUrls = (_b = tl.getInput('artifactUrls', true)) === null || _b === void 0 ? void 0 : _b.split(delimiter);
        //add properties to each artifact
        for (let artifactUrlShort of artifactUrls) {
            artifactUrlShort = Utils.encodeUrl(artifactUrlShort);
            const artifactUrl = `${baseUrl}/api/storage/${artifactUrlShort}`; // Construct the complete URL
            Object.keys(properties).forEach((prop) => {
                const queryParams = {
                    "properties": [prop] + '=' + properties[prop], // Assuming 'prop' and 'properties' are defined elsewhere
                };
                axios_1.default.put(artifactUrl, null, {
                    params: queryParams,
                    headers: headers,
                })
                    .then(response => {
                    console.log(`Successfully set property '${prop}' on Artifact ${artifactUrlShort}`);
                })
                    .catch(error => {
                    //test
                    console.log('Error while attempting to add property to Artifact:' + error);
                    // Handle errors here
                    process.exit(1); // Exiting with a non-zero code indicating an error
                });
            });
        }
    }
    else if (inputType == "build") {
        const buildName = tl.getInput('BuildName', true);
        const buildNumber = tl.getInput('BuildNumber', true);
        const projectName = tl.getInput('ProjectKey', true);
        const BuildStatus = tl.getInput('BuildStatus', false);
        const searchBody = Object.assign({ "buildName": buildName, "buildNumber": buildNumber, "project": projectName }, (BuildStatus !== null && { myProperty: BuildStatus }));
        const searchUrl = `${baseUrl}/api/search/buildArtifacts`;
        axios_1.default.post(searchUrl, JSON.stringify(searchBody), {
            headers: headers,
        })
            .then((response) => {
            console.log("Data received from build search API: " + JSON.stringify(response.data));
            artifactUrls = response.data.results.map((obj) => {
                const { downloadUri } = obj;
                const trimmedUrl = downloadUri.replace(`${baseUrl}/`, "");
                return trimmedUrl;
            });
            for (let artifactUrlShort of artifactUrls) {
                artifactUrlShort = Utils.encodeUrl(artifactUrlShort);
                const artifactUrl = `${baseUrl}/api/storage/${artifactUrlShort}`; // Construct the complete URL
                Object.keys(properties).forEach((prop) => {
                    const queryParams = {
                        "properties": [prop] + '=' + properties[prop], // Assuming 'prop' and 'properties' are defined elsewhere
                    };
                    setTimeout(() => axios_1.default.put(artifactUrl, null, {
                        params: queryParams,
                        headers: headers,
                    })
                        .then(response => {
                        console.log(`Successfully set property '${prop}' on Artifact ${artifactUrlShort}`);
                        // Adding a delay between each API call
                    })
                        .catch(error => {
                        console.log('Error while attempting to add property to Artifact: ' + error);
                        // Handle errors here
                        process.exit(1); // Exiting with a non-zero code indicating an error
                    }), 1000);
                });
            }
        })
            .catch((error) => {
            console.error('Error from Artifactory search builds API:', error.response ? error.response.data : error.message);
            process.exit(1);
        });
    }
}
exports.setProperties = setProperties;
