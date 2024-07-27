import tl = require('azure-pipelines-task-lib/task');
import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as Utils from './helpers'
import logger from './logger';
import { json } from 'stream/consumers';


axiosRetry(axios, {
  retries: 10, // Number of retries
  retryDelay: axiosRetry.exponentialDelay, // Retry delay strategy
  onRetry: (retryCount, error, Config)=>{console.log("Axios request failed with " + error + " retrying now..")}
});

export function setProperties(properties: any): void {

  const inputType = tl.getInput("InputType", true)?.toLowerCase()
  // get username/password details from service connection
  const serviceConnectionId: any = tl.getInput('artifactoryServiceConnection', true);
  const auth = tl.getEndpointAuthorization(serviceConnectionId, false);
  let authType: any = tl.getEndpointAuthorizationScheme(serviceConnectionId, false);
  let authToken: any = '';
  if (authType == 'UsernamePassword') {
    const username = auth?.parameters['username'];
    const password = auth?.parameters['password'];
    authToken = Buffer.from(`${username}:${password}`).toString('base64');
    authType = 'Basic';
  } else if (authType == 'Token') {
    authToken = auth?.parameters['apitoken'];
    authType = 'Bearer';
  }
  const baseUrl = tl.getEndpointUrl(serviceConnectionId, true);

  //set API headers
  const headers = {
    Authorization: `${authType} ${authToken}`,
    'Content-Type': 'application/json', // Set content type based on your requirements
  };
  //Retrieve artifact URLs
  let artifactUrls: any = []
  if (inputType == "urllist"){
    const delimiter: any = tl.getInput('delimiter', false) || ','
    artifactUrls = tl.getInput('artifactUrls', true)?.split(delimiter);

  //add properties to each artifact
  for (let artifactUrlShort of artifactUrls) {
    artifactUrlShort = Utils.encodeUrl(artifactUrlShort);
    const artifactUrl = `${baseUrl}/api/storage/${artifactUrlShort}`; // Construct the complete URL
    
    Object.keys(properties).forEach((prop) => {
      const queryParams = {
          "properties": [prop] + '=' + properties[prop], // Assuming 'prop' and 'properties' are defined elsewhere
      };
      setTimeout(() => 
      axios.put(artifactUrl, null, {
          params: queryParams,
          headers: headers,
      })
          .then(response => {
          console.log(`Successfully set property '${prop}' on Artifact ${artifactUrlShort}`)
      })
          .catch(error => {
            console.log('Error while attempting to add property to Artifact:' + error);
            // Handle errors here
            for (let errorStatus of error.response.data.errors) {
              switch (errorStatus.status) {
                case 400:
                  console.log(`Invalid request parameters (headers / body).  See headers here: ${headers} '\n Throwing failing code of 1`);
                  logger.debug(errorStatus)
                  process.exit(1)
                case 401:
                  console.log(`Endpoint requires authentication, please specify credentials.  Message from endpoint is: ${errorStatus.message}  ${errorStatus.status} \n Throwing failing code of 1`);
                  logger.debug(errorStatus)
                  process.exit(1)
                case 403:
                  console.log(`Endpoint permission requirements are not met.  Message from endpoint is:  Message from endpoint is: ${errorStatus.message}  ${errorStatus.status} Please check that account has permission to ${prop} property on Artifact ${artifactUrlShort}.`);
                  logger.debug(errorStatus)
                  console.log(`Artifact URL endpoint that failed ${artifactUrl}`);
                  process.exit(1)
                case 500:
                  console.log(`Server error!  Unexpected error during request handling, check distribution logs.  Message from endpoint is: ${errorStatus.message}  ${errorStatus.status} \n Throwing failing code of 1`);
                  logger.debug(errorStatus)
                  process.exit(1)
                default:
                  console.log(`Endpoint failed with the following error: ${error.message} \n Throwing failing code of 1`);
                  logger.debug(errorStatus)
                  process.exit(1)
              }
            }
            // process.exit(1); // Exiting with a non-zero code indicating an error
          })
        , 1000)
  });
}
  }else if (inputType == "build"){

    const buildName = tl.getInput('BuildName', true)
    const buildNumber = tl.getInput('BuildNumber', true)
    const projectName = tl.getInput('ProjectKey', true)
    const BuildStatus = tl.getInput('BuildStatus', false)
    const repos = tl.getInput('ArtifactoryRepositoryName', false)
    
    const searchBody = {
      "buildName": buildName,
      "buildNumber": buildNumber,
      "project" : projectName,
      ...(repos !== undefined && { repos: [repos] }),
      ...(BuildStatus !== null && { buildStatus: BuildStatus }),
    }

  const searchUrl = `${baseUrl}/api/search/buildArtifacts`
  axios.post(searchUrl, JSON.stringify(searchBody), {
    headers: headers,
  })
    .then((response) => {
      console.log("Data received from build search API: " + JSON.stringify(response.data))
      artifactUrls = response.data.results.map((obj: any) => {
        const { downloadUri } = obj;
        const trimmedUrl = downloadUri.replace(`${baseUrl}/`, "");
        return trimmedUrl;
      }
    );

    for (let artifactUrlShort of artifactUrls) {
      artifactUrlShort = Utils.encodeUrl(artifactUrlShort);
      const artifactUrl = `${baseUrl}/api/storage/${artifactUrlShort}`; // Construct the complete URL
      
      Object.keys(properties).forEach((prop) => {
        const queryParams = {
            "properties": [prop] + '=' + properties[prop], // Assuming 'prop' and 'properties' are defined elsewhere
        };
        setTimeout(()=> 
        axios.put(artifactUrl, null, {
          params: queryParams,
          headers: headers,
      })
          .then(response => {
          console.log(`Successfully set property '${prop}' on Artifact ${artifactUrlShort}`)

          // Adding a delay between each API call
      })
            .catch(error => {
              console.log('Error while attempting to add property to Artifact:' + error);
              // Handle errors here
              for (let errorStatus of error.response.data.errors) {
                switch (errorStatus.status) {
                  case 400:
                    console.log(`Invalid request parameters (headers / body).  See headers here: ${headers} '\n Throwing failing code of 1`);
                    logger.debug(errorStatus)
                    process.exit(1)
                  case 401:
                    console.log(`Endpoint requires authentication, please specify credentials.  Message from endpoint is: ${errorStatus.message}  ${errorStatus.status} \n Throwing failing code of 1`);
                    logger.debug(errorStatus)
                    process.exit(1)
                  case 403:
                    console.log(`Endpoint permission requirements are not met.  Message from endpoint is:  Message from endpoint is: ${errorStatus.message}  ${errorStatus.status} Please check that account has permission to ${prop} property on Artifact ${artifactUrlShort}.`);
                    console.log(`Here is the artifact URL ${artifactUrl}`);
                    logger.debug(errorStatus)
                    process.exit(1)
                  case 500:
                    console.log(`Server error!  Unexpected error during request handling, check distribution logs.  Message from endpoint is: ${errorStatus.message}  ${errorStatus.status} \n Throwing failing code of 1`);
                    logger.debug(errorStatus)
                    process.exit(1)
                  default:
                    console.log(`Endpoint failed with the following error: ${error.message} \n Throwing failing code of 1`);
                    logger.debug(errorStatus)
                    process.exit(1)
                }
              }
              // process.exit(1); // Exiting with a non-zero code indicating an error
            })
        , 1000)
    });
  }
})
  .catch((error) => {
    console.error('Error from Artifactory search builds API:', error.response ? error.response.data : error.message);
    console.log(`Artifactory search builds body: \n ${JSON.stringify(searchBody)}`)
    process.exit(1)
  });
}
}
