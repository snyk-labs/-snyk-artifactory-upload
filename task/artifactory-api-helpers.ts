import tl = require('azure-pipelines-task-lib/task');
import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as Utils from './helpers'
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
      axios.put(artifactUrl, null, {
          params: queryParams,
          headers: headers,
      })
          .then(response => {
          console.log(`Successfully set property '${prop}' on Artifact ${artifactUrlShort}`)
      })
          .catch(error => {
            //test
          console.log('Error while attempting to add property to Artifact:' + error);
          // Handle errors here
          process.exit(1); // Exiting with a non-zero code indicating an error
      });
  });
}
  }else if (inputType == "build"){

    const buildName = tl.getInput('BuildName', true)
    const buildNumber = tl.getInput('BuildNumber', true)
    const projectName = tl.getInput('ProjectKey', true)
    const BuildStatus = tl.getInput('BuildStatus', false)
    const searchBody = {
      "buildName": buildName,
      "buildNumber": buildNumber,
      "project" : projectName,
      ...(BuildStatus !== null && { myProperty: BuildStatus }),
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
          console.log('Error while attempting to add property to Artifact: ' + error);
          // Handle errors here
          process.exit(1); // Exiting with a non-zero code indicating an error
      })
        , 1000)
    });
  }
})
  .catch((error) => {
    console.error('Error from Artifactory search builds API:', error.response ? error.response.data : error.message);
    process.exit(1)
  });
}
}
