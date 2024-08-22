export type DescribeFile = { [key: string]: LooseDescribeEntry };
export type DescribeEntry = LooseDescribeEntry & Required<Pick<LooseDescribeEntry, 'directoryName' | 'suffix'>>;

/**
 * From the org-agnostic describe.json file.
 * might not have dirname or suffix */
export type LooseDescribeEntry = {
  directoryName?: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix?: string;
  name: string;
  hasChildren: boolean;
};

/** produced by the mdapi, describing an org */
export type DescribeResult = {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix: string;
  xmlName: string;
  folderContentType: string;
  childXmlNames: string[];
};
