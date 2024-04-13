import tl = require('azure-pipelines-task-lib/task');
import fs from 'fs'; // Import the Node.js file system module
import * as Utils from './helpers'
import * as types from './types'
const Artifactory = require('./artifactory-api-helpers');
import * as path from 'path';

async function run() {
  
  //determine whether to use forward or backslash depending on OS
  const os: string | undefined = process.env.AGENT_OS;
  let slash: string;
  if (os === 'Windows_NT') {
      slash = '\\'; // Backslash for Windows
  } else {
      slash = '/'; // Forward slash for Linux and macOS
  }

  //Get operation to be performed, can be copy, process or both
  const operation = tl.getInput('Operation', true);
  const snykFilePath : any = tl.getInput('SnykDirectory') + slash;
  if (operation == "Copy" || operation == "CopyAndProcess"){
    
    //get file location from file path directory
    let fileLocation: string | null = ""
    try{
      console.log("Attempting to retrieve Snyk report file from location: " + snykFilePath)
      fileLocation = Utils.findLocalReportFile()
      if (fileLocation == null){
        console.log("Failed to find Snyk report file")
        process.exit(1)
      }
    }catch (err) {
      console.log("Error retrieving Snyk report file: " + err)
      process.exit(1)
    }

    //create scan data object
    let scanData = {}
    if (fileLocation) {
      try{
        let codeJson = await Utils.readFileContents(fileLocation); // Only call function if fileLocation is defined
        scanData = Utils.processCode(codeJson)
      }catch (err){
        console.log("Error processing code results: " + err)
        process.exit(1)
      }
      } else {
        console.error('File location is undefined or empty.');
        process.exit(1)
      }

    //copy to filesystem
    try{
      const jsonFilePath = `${snykFilePath}SnykReport.json`
      tl.writeFile(jsonFilePath, JSON.stringify(scanData))
      console.log(`Wrote Snyk vulnerability data to ${jsonFilePath} `)
    }catch (err: any) {
      console.error("Failed to upload Snyk report to path: " + snykFilePath)
      console.log(err)
      process.exit(1)
    }
    
  }
  if (operation == "Process" || operation == "CopyAndProcess"){
    
    //retrieve scan data
    let scanData = {}
    console.log("Proccesing Snyk data from: " + snykFilePath)
    try{
      let scanData = fs.readFileSync(`${snykFilePath}SnykReport.json`, 'utf-8');
      scanData = JSON.parse(scanData)
      console.log("Successfully retrieved scan data: " + JSON.stringify(scanData))

      //set properties in artifactory with scan data
      try{
        Artifactory.setProperties(scanData);
      }catch (err){
      console.log("Error setting properties on artifact: " + err)
      process.exit(1)
      }
    }catch (err){
      console.error("Error while attempting to retrieve scan data: " + err)
      process.exit(1)
    }

//test

  }
}
run()