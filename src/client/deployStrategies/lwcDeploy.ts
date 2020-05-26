/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFileSync } from 'fs';
import { LightningComponentResource } from '../../utils/deploy';
import { extName } from '../../utils';
import { MetadataComponent, DeployResult, SourceResult } from '../../types';
import { deployTypes } from '../toolingApi';
import { BaseDeploy } from './baseDeploy';

export class LwcDeploy extends BaseDeploy {
  public async deploy(component: MetadataComponent): Promise<DeployResult> {
    this.component = component;
    const lightningResources = await this.buildResourceList();

    try {
      const results = await this.upsert(lightningResources);
      return this.formatBundleOutput(results);
    } catch (e) {
      const failures = [
        this.parseLwcError(e.message, lightningResources[0].FilePath)
      ];
      return this.formatBundleOutput(failures, true);
    }
  }

  public async buildResourceList(): Promise<LightningComponentResource[]> {
    const sourceFiles = this.component.sources;
    sourceFiles.push(this.component.xml);
    const lightningResources: LightningComponentResource[] = [];

    const existingResources = await this.findLightningResources();
    const lightningBundle = existingResources[0]
      ? await this.upsertBundle(existingResources[0].LightningComponentBundleId)
      : await this.upsertBundle();
    const bundleId = lightningBundle.id;

    sourceFiles.forEach(async sourceFile => {
      const source = readFileSync(sourceFile, 'utf8');
      const isMetaSource = sourceFile === this.component.xml;
      const format = isMetaSource ? 'js' : extName(sourceFile);

      let match: LightningComponentResource;
      if (existingResources.length > 0) {
        match = existingResources.find(resource =>
          sourceFile.endsWith(resource.FilePath)
        );
      }

      // If resource exists in org, assign the matching Id
      // else, assign the id of the bundle it's associated with
      const lightningResource = {
        FilePath: sourceFile,
        Source: source,
        Format: format,
        ...(match ? { Id: match.Id } : { LightningComponentBundleId: bundleId })
      };

      // This is to ensure that the base file is deployed first for lwc
      // otherwise there is a `no base file found` error
      lightningResource.Format === 'js' && !isMetaSource
        ? lightningResources.unshift(lightningResource)
        : lightningResources.push(lightningResource);
    });

    return lightningResources;
  }

  public async upsert(
    lightningResources: LightningComponentResource[]
  ): Promise<SourceResult[]> {
    const type = this.component.type.name;
    const successes: SourceResult[] = [];
    for (const resource of lightningResources) {
      if (resource.Id) {
        const formattedDef = {
          Source: resource.Source,
          Id: resource.Id
        };

        await this.connection.tooling.update(
          deployTypes.get(type),
          formattedDef
        );
        successes.push(this.createDeployResult(resource.FilePath, true, false));
      } else {
        const formattedDef = {
          LightningComponentBundleId: resource.LightningComponentBundleId,
          Format: resource.Format,
          Source: resource.Source,
          FilePath: this.getFormattedPaths(resource.FilePath)[0]
        };

        await this.toolingCreate(deployTypes.get(type), formattedDef);
        successes.push(this.createDeployResult(resource.FilePath, true, true));
      }
    }
    return successes;
  }

  private async findLightningResources(): Promise<
    LightningComponentResource[]
  > {
    const lightningResourceResult = await this.connection.tooling.query(
      `Select LightningComponentBundleId, Id, Format, Source, FilePath from LightningComponentResource where LightningComponentBundle.DeveloperName = '${
        this.component.fullName
      }'`
    );
    return lightningResourceResult.records as LightningComponentResource[];
  }

  private parseLwcError(error: string, defaultPath: string): SourceResult {
    try {
      const pathParts = error.split(/[\s\n\t]+/);
      const msgStartIndex = pathParts.findIndex(part => part.includes(':'));
      const fileObject = pathParts[msgStartIndex];

      const fileName = fileObject.slice(0, fileObject.indexOf(':'));
      const errLocation = fileObject.slice(fileObject.indexOf(':') + 1);

      const errorMessage = pathParts.slice(msgStartIndex + 2).join(' ');

      const file = this.component.sources.find(s => s.includes(fileName));

      const errObj = {
        ...(errLocation
          ? { lineNumber: Number(errLocation.split(',')[0]) }
          : {}),
        ...(errLocation
          ? { columnNumber: Number(errLocation.split(',')[1]) }
          : {}),
        problem: errorMessage,
        fileName: file,
        fullName: this.getFormattedPaths(file)[1],
        componentType: this.component.type.name,
        success: false,
        changed: false,
        created: false,
        deleted: false
      } as SourceResult;
      return errObj;
    } catch (e) {
      //log error with parsing error message
      const errObj = {
        problem: error,
        fileName: defaultPath,
        fullName: this.getFormattedPaths(defaultPath)[1],
        componentType: this.component.type.name,
        success: false,
        changed: false,
        created: false,
        deleted: false
      } as SourceResult;
      return errObj;
    }
  }
}
