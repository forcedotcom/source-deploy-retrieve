import { ToolingCreateResult, ToolingDeployResult } from './index';
import { MetadataComponent } from '../../../metadata-registry';
import { Connection } from '@salesforce/core';

const DOMParser = require('xmldom-sfdx-encoding').DOMParser;

export abstract class BaseDeploy {
  public connection: Connection;
  public metadataType: string;
  protected apiVersion?: string;

  constructor(connection: Connection, apiVersion?: string) {
    this.connection = connection;
    this.apiVersion = apiVersion;
  }

  abstract deploy(component: MetadataComponent): Promise<ToolingDeployResult>;

  protected buildMetadataField(
    metadataContent: string
  ): {
    label?: string;
    packageVersions?: string;
    status?: string;
    apiVersion: string;
  } {
    const parser = new DOMParser();
    const document = parser.parseFromString(metadataContent, 'text/xml');
    const apiVersion =
      this.apiVersion ||
      document.getElementsByTagName('apiVersion')[0].textContent;
    const statusNode = document.getElementsByTagName('status')[0];
    const packageNode = document.getElementsByTagName('packageVersions')[0];
    const descriptionNode = document.getElementsByTagName('description')[0];
    const labelNode = document.getElementsByTagName('label')[0];

    const metadataField = {
      apiVersion,
      ...(statusNode ? { status: statusNode.textContent } : {}),
      ...(packageNode ? { packageVersions: packageNode.textContent } : {}),
      ...(descriptionNode ? { description: descriptionNode.textContent } : {}),
      ...(labelNode ? { label: labelNode.textContent } : {})
    };
    return metadataField;
  }

  protected async toolingCreate(
    type: string,
    record: object
  ): Promise<ToolingCreateResult> {
    return (await this.connection.tooling.create(
      type,
      record
    )) as ToolingCreateResult;
  }
}
