import { Connection } from '@salesforce/core';

/**
 * File system path to a source file of a metadata component.
 */
export type SourcePath = string;

export type MetadataType = {
  name: string;
  /**
   * Name of the directory where components are located in a package
   */
  directoryName: string;
  /**
   * Whether or not components are stored in folders.
   *
   * __Examples:__ Reports, Dashboards, Documents, EmailTemplates
   */
  inFolder: boolean;
  /**
   * File suffix
   *
   * Some types may not have one, such as those made up of varying file extensions.
   *
   * __Examples:__ LightningComponentBundles, Documents, StaticResources
   */
  suffix?: string;
  /**
   * Names of the subtypes if the type has any.
   */
  childXmlNames?: string[];
};

/**
 * Source information about a single metadata component.
 */
export type MetadataComponent = {
  fullName: string;
  type: MetadataType;
  /**
   * Path to the root metadata xml file.
   */
  xml: SourcePath;
  /**
   * Paths to additional source files, if any.
   */
  sources: SourcePath[];
};

type CommonOptions = {
  /**
   * Set the max number of seconds to wait for the operation.
   */
  wait?: number;
};

type CommonRetrieveOptions = {
  /**
   * Whether or not the files should be automatically converted to
   * [source format](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm)
   */
  convert?: boolean;
  /**
   * Whether or not existing source files should be overwritten.
   */
  overwrite?: boolean;
  /**
   * The directory to retrieve the components to.
   */
  output: SourcePath;
};

type CommonPathOptions = {
  /**
   * Source paths of the files to perform the operation on.
   */
  paths: SourcePath[];
};

export type RetrieveOptions = CommonOptions &
  CommonRetrieveOptions & { components: MetadataComponent[] };

export type RetrievePathOptions = CommonOptions &
  CommonRetrieveOptions &
  CommonPathOptions;

export type ApiResult = {
  success: boolean;
  components: MetadataComponent[];
  message?: string;
};

/**
 * Infers the source format structure of a metadata component when given a file path.
 */
export interface SourceAdapter {
  getComponent(fsPath: SourcePath): MetadataComponent;
}

export interface DeployRetrieveClient {
  /**
   * Retrieve metadata components and wait for the result.
   *
   * @param options Specify `components`, `output` and other optionals
   */
  retrieve(options: RetrieveOptions): ApiResult;
  /**
   * Infer metadata components from source paths, retrieve them, and wait for the result.
   *
   * @param options Specify `paths`, `output` and other optionals
   */
  retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult>;
}

export abstract class BaseApi implements DeployRetrieveClient {
  protected connection: Connection;
  private apiVersion: string;

  constructor(connection: Connection, apiVersion: string) {
    this.connection = connection;
    this.apiVersion = apiVersion;
  }

  /**
   * @param options Specify `paths`, `output` and other optionals
   */
  abstract retrieveWithPaths(options: RetrievePathOptions): Promise<ApiResult>;

  abstract retrieve(options: RetrieveOptions): ApiResult;
}
