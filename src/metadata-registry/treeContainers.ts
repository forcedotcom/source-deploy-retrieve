import { SourcePath, MetadataType } from '../types';
import { join, sep, dirname, basename } from 'path';
import { baseName } from '../utils';
import { parseMetadataXml } from '../utils/registry';
import { lstatSync, existsSync, readdirSync } from 'fs';

export interface TreeContainer {
  isDirectory(path: SourcePath): boolean;
  exists(path: SourcePath): boolean;
  findMetadataContent(dir: SourcePath, fullName: string): SourcePath | undefined;
  findMetadataXml(dir: SourcePath, fullName: string): SourcePath | undefined;
  findXmlFromContentPath(contentPath: SourcePath, type: MetadataType): SourcePath | undefined;
  readDir(path: SourcePath): string[];
}

export abstract class BaseTreeContainer implements TreeContainer {
  public findMetadataContent(dir: SourcePath, fullName: string): SourcePath | undefined {
    return this._find(dir, fullName, false);
  }

  public findMetadataXml(dir: SourcePath, fullName: string): SourcePath | undefined {
    return this._find(dir, fullName, true);
  }

  public findXmlFromContentPath(contentPath: SourcePath, type: MetadataType): SourcePath {
    const pathParts = contentPath.split(sep);
    const typeFolderIndex = pathParts.findIndex(part => part === type.directoryName);
    const offset = type.inFolder ? 3 : 2;
    const rootContentPath = pathParts.slice(0, typeFolderIndex + offset).join(sep);
    const rootTypeDirectory = dirname(rootContentPath);
    const contentFullName = baseName(rootContentPath);
    return this.findMetadataXml(rootTypeDirectory, contentFullName);
  }

  public abstract isDirectory(path: SourcePath): boolean;
  public abstract exists(path: SourcePath): boolean;
  public abstract readDir(path: SourcePath): string[];

  private _find(
    dir: SourcePath,
    fullName: string,
    findMetadataXml: boolean
  ): SourcePath | undefined {
    const fileName = this.readDir(dir).find(f => {
      const parsed = parseMetadataXml(join(dir, f));
      const metaXmlCondition = findMetadataXml ? !!parsed : !parsed;
      return f.startsWith(fullName) && metaXmlCondition;
    });
    if (fileName) {
      return join(dir, fileName);
    }
  }
}

export class NodeFSContainer extends BaseTreeContainer {
  public isDirectory(path: SourcePath): boolean {
    return lstatSync(path).isDirectory();
  }

  public exists(path: SourcePath): boolean {
    return existsSync(path);
  }

  public readDir(path: SourcePath): string[] {
    return readdirSync(path);
  }
}

export type VirtualDirectory = {
  path: SourcePath;
  children: string[];
};

export class VirtualTreeContainer extends BaseTreeContainer {
  protected tree = new Map<SourcePath, Set<SourcePath>>();

  constructor(virtualFs: VirtualDirectory[]) {
    super();
    this.populate(virtualFs);
  }

  public isDirectory(path: string): boolean {
    const normalized = this.normalizePath(path);
    if (this.exists(normalized)) {
      return this.tree.has(normalized);
    }
    throw new Error(path + ' does not exist');
  }

  public exists(path: string): boolean {
    const normalized = this.normalizePath(path);
    const files = this.tree.get(dirname(normalized));
    const isFile = files && files.has(normalized);
    return isFile || this.tree.has(normalized);
  }

  public readDir(path: string): string[] {
    const normalized = this.normalizePath(path);
    return Array.from(this.tree.get(normalized)).map(p => basename(p));
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
  }

  private populate(virtualFs: VirtualDirectory[]): void {
    for (const dir of virtualFs) {
      const { path, children } = dir;
      this.tree.set(path, new Set());
      for (const child of children) {
        this.tree.get(path).add(join(path, child));
      }
    }
  }
}
