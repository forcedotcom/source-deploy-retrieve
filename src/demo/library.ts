//////
////// Types
//////

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

type MetadataComponent = {
  fullName: string;
  type: MetadataType;
};

type ComponentWithSources = MetadataComponent & {
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
type CommonPathOptions = {
  /**
   * Source paths of the files to perform the operation on.
   */
  paths: SourcePath[];
};
type CommonManifestOptions = {
  /**
   * The contents of a package manifest file.
   */
  xmlSource: string;
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

export type DeployOptions = CommonOptions & {
  components: ComponentWithSources[];
};
export type DeployPathOptions = CommonOptions & CommonPathOptions;
export type DeployManifestOptions = CommonOptions & CommonManifestOptions & {
    /**
     * The root package directory the manifest is used to operate on.
     */
    packageRoot: SourcePath;
  };
export type RetrieveOptions = CommonOptions & CommonRetrieveOptions & { components: MetadataComponent[] };
export type RetrievePathOptions = CommonOptions & CommonRetrieveOptions & CommonPathOptions;
export type RetrieveManifestOptions = CommonOptions & CommonRetrieveOptions & CommonManifestOptions;

export type ApiResult = Promise<{
  success: boolean;
  components: MetadataComponent[];
  message?: string;
}>;

type Connection = {};

export const registryData = {};

//////
////// Client Interfaces
//////

interface DeployRetrieveClient {
  /**
   * Deploy metadata components and wait for the result.
   *
   * @param options Specify `components` and other optionals
   */
  deploy(options: DeployOptions): ApiResult;
  /**
   * Infer metadata components from source paths, deploy them, and wait for the result.
   *
   * @param options Specify `paths` and other optionals
   */
  deployWithPaths(options: DeployPathOptions): ApiResult;
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
  retrieveWithPaths(options: RetrievePathOptions): ApiResult;
}

interface ManifestClient {
  /**
   * Deploy components using a manifest and wait for the result.
   *
   * @param options Specify `xmlContent`, `packageRoot` and other optionals
   */
  deployWithManifest(options: DeployManifestOptions): ApiResult;
  /**
   * Retrieve components using a manifest and wait for the result.
   *
   * @param output Specify `xmlContent`, `output` and other optionals
   */
  retrieveWithManifest(options: RetrieveManifestOptions): ApiResult;
}

abstract class BaseApi implements DeployRetrieveClient {
  private connection: Connection;
  private apiVersion: number;

  constructor(connection: Connection, apiVersion: number) {
    this.connection = connection;
    this.apiVersion = apiVersion;
  }

  /**
   * @param options Specify `paths` and other optionals
   */
  deployWithPaths(options: DeployPathOptions): ApiResult {
    throw new Error('Method not implemented.');
  }

  /**
   * @param options Specify `paths`, `output` and other optionals
   */
  retrieveWithPaths(options: RetrievePathOptions): ApiResult {
    throw new Error('Method not implemented.');
  }

  abstract deploy(options: DeployOptions): ApiResult;

  abstract retrieve(options: RetrieveOptions): ApiResult;
}

class ToolingApi extends BaseApi {
  /**
   * @param options Specify `components` and other optionals
   */
  deploy(options: DeployOptions): ApiResult {
    throw new Error('Method not implemented.');
  }

  /**
   * @param options Specify `components`, `output` and other optionals
   */
  retrieve(options: RetrieveOptions): ApiResult {
    throw new Error('Method not implemented.');
  }
}

class MetadataApi extends BaseApi implements ManifestClient {
  /**
   * @param options Specify `components` and other optionals
   */
  deploy(options: DeployOptions): ApiResult {
    throw new Error('Method not implemented.');
  }

  /**
   * @param options Specify `components`, `output` and other optionals
   */
  retrieve(options: RetrieveOptions): ApiResult {
    throw new Error('Method not implemented.');
  }

  /**
   * @param options Specify `xmlContent`, `packageRoot` and other optionals
   */
  deployWithManifest(options: DeployManifestOptions): ApiResult {
    throw new Error('Method not implemented.');
  }

  /**
   * @param output Specify `xmlContent`, `output` and other optionals
   */
  retrieveWithManifest(options: RetrieveManifestOptions): ApiResult {
    throw new Error('Method not implemented.');
  }
}

/**
 * Transfer SFDX source to and from a Salesforce org.
 */
export class SourceClient {
  public readonly connection: Connection;
  public readonly apiVersion: number;
  /**
   * Perform operations using the tooling api.
   */
  public readonly tooling: ToolingApi;
  /**
   * Perform operations using the metadata api.
   */
  public readonly metadata: MetadataApi;

  constructor(
    connection: Connection,
    apiVersion: number = registryData.apiVersion
  ) {
    this.connection = connection;
    this.apiVersion = apiVersion;
    this.tooling = new ToolingApi(connection, apiVersion);
    this.metadata = new MetadataApi(connection, apiVersion);
  }
}

//////
////// Utilities
//////

/**
 * Parse the XML content of a package manifest into a collection
 * of metadata components.
 *
 * @param content XML content of the package manifest
 */
export function parseManifest(content: string): MetadataComponent[] {}

/**
 * Create a package manifest with a collection of metadata components.
 *
 * @param components Components to construct the package manifest with
 */
export function createManifest(components: MetadataComponent[]): string {}

/**
 * Convert a file or directory from SFDX source format into metadata format.
 *
 * @param root File or directory path to convert
 * @param output Location to output the conversion to
 */
export function convertSource(root: SourcePath, output: SourcePath): void {}

/**
 * Convert a file or directory from metadata format into SFDX source format
 *
 * @param root File or directory path to convert
 * @param output Location to output the conversion to
 */
export function convertMetadata(root: SourcePath, output: SourcePath): void {}
