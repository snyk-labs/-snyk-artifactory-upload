import fs from 'fs'; // Import the Node.js file system module
import * as types from './types'
import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

export function encodeUrl(subdirectory: string): string {
  return subdirectory
    .split('')
    .map(char => (char === '/' ? char : encodeURIComponent(char)))
    .join('');
}

export function findLocalReportFile(): string | null {
  const givenDate = new Date()
  const directory : any = tl.getVariable('Agent.TempDirectory');
  const filesInDirectory = fs.readdirSync(directory);
  
  for (const file of filesInDirectory) {
    if (file.startsWith('report-') && file.endsWith('.json')) {
      const fileDateStr = file.replace('report-', '').replace('.json', '');
      const [year, month, day, hours, minutes, seconds] = fileDateStr.split(/[-T:]/);
      const fileDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds));
      if (!isNaN(fileDate.getTime())) {
        const tenMinutesInMilliseconds = 10 * 60 * 1000; // 10 minutes in milliseconds
        const differenceInMilliseconds = Math.abs(givenDate.getTime() - fileDate.getTime());
        

        if (true) {
          const filePath = path.join(directory, file)
          console.log("Snyk report file found: " + filePath)
          return filePath // File found and within 10 minutes of the given date
        }
      }
    }
  }

  return null; // No suitable file found
}

export async function readFileContents(filePath: string): Promise<object | null> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        reject(err); // Reject the promise if there's an error
        return;
      }

      try {
        const jsonObject = JSON.parse(data); // Parse the data as JSON
        resolve(jsonObject); // Resolve the promise with the parsed JSON object
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        console.log("Contents of Snyk JSON file: " + data)
        resolve(null); // Resolve with null if parsing fails
        process.exit(1)
      }
    });
  });
}

export function processCode(codeOutput: any): types.CodeProperties {

    let scanProperties: types.CodeProperties = {
        snyk_sast_scan_status: 'Complete',
        snyk_sast_findings_present: false,
        snyk_sast_highest_severity_level: 'None',
        snyk_sast_high_severity_count: 0,
        snyk_sast_medium_severity_count: 0,
        snyk_sast_low_severity_count: 0,
        snyk_sast_project_link: 'None'
    }

    if (codeOutput && Array.isArray(codeOutput['runs'])) {
      const runs: any[] = codeOutput['runs']; 
    
      for (let runIndex = 0; runIndex < runs.length; runIndex++) {
        const run = runs[runIndex];

        if (run && Array.isArray(run['results'])) {
          const results: any[] = run['results']; 
          
          //filter through each issue
          for (let issueIndex = 0; issueIndex < results.length; issueIndex++) {
            scanProperties.snyk_sast_scan_status = "complete"
            //process each issue and amend the codeOutput object
            const issue = results[issueIndex];
            if(issue.level == 'info' || issue.level =='note'){
                scanProperties.snyk_sast_low_severity_count++
                if(scanProperties.snyk_sast_highest_severity_level == 'None'){
                    scanProperties.snyk_sast_highest_severity_level = 'low'
                }
                scanProperties.snyk_sast_findings_present = true
            }
            else if(issue.level == 'warning'){
                scanProperties.snyk_sast_medium_severity_count++
                if(scanProperties.snyk_sast_highest_severity_level == 'None' || scanProperties.snyk_sast_highest_severity_level == 'low'){
                    scanProperties.snyk_sast_highest_severity_level = 'medium'
                }
                scanProperties.snyk_sast_findings_present = true
            }
            else if(issue.level == 'error'){
                scanProperties.snyk_sast_high_severity_count++
                if(scanProperties.snyk_sast_highest_severity_level == 'None' || scanProperties.snyk_sast_highest_severity_level == 'low' || scanProperties.snyk_sast_highest_severity_level == 'medium'){
                    scanProperties.snyk_sast_highest_severity_level = 'high'
                }
                scanProperties.snyk_sast_findings_present = true
            }
          }
          //add report data
          if (typeof run?.properties?.uploadResult?.reportUrl === 'string'){
            scanProperties.snyk_sast_project_link = run.properties.uploadResult.reportUrl
          }
        }
      }
    }


    return scanProperties
  }
  // Function to add pipeline info to an existing object
export function addPipelineInfo(existingObj: any): any {
    try {
      // Retrieve pipeline variables
      const projectName = tl.getVariable('System.TeamProject');
      const repoName = tl.getVariable('Build.Repository.Name');
      const sourceBranch = tl.getVariable('Build.SourceBranch');
  
      // Add pipeline info to the existing object
      const newObj = {
        ...existingObj, // Spread existing object
        ado_project_name: projectName,
        code_repository_name: repoName,
        code_branch_name: sourceBranch
      };
  
      return newObj;
    } catch (error) {
      console.error('Error:', error);
      // Handle errors here or return the original object if an error occurs
      return existingObj;
    }
  }


  

  