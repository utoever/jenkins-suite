import { DefinitionPropertyType } from '../types/jenkins-types';
import { BuildsModel, JobProperty } from "../types/model";

export function getParameterDefinition(build: BuildsModel | undefined): JobProperty[] {
    if (build) {
        return build.property.filter(val => val._class === DefinitionPropertyType.parametersDefinitionProperty.toString());
    } else {
        return [];
    }
}
