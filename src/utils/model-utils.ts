import { DefinitionPropertyType } from '../types/jenkins-types';
import { BuildsModel, JobProperty } from "../types/model";

export function getParameterDefinition(build: BuildsModel | undefined): JobProperty[] {
    if (build) {
        return build.property.filter(val => val._class === DefinitionPropertyType.parametersDefinitionProperty.toString());
    } else {
        return [];
    }
}

// export function lookupFolder(jobs: JobsModel): string {
//     let jobPath = '';
//     if (jobs && jobs.parents && jobs.parents.length > 0) {
//         jobs.parents.forEach(job => {
//             jobPath += `job/${job.name}/`;
//         });
//     }
//     jobPath += `job/${jobs.name}`;
//     return jobPath;
// }
