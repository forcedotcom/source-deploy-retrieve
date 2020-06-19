import { SourcePath, VirtualDirectory, TreeContainer } from '../types';
import { join, dirname, basename } from 'path';
import { baseName } from '../utils';
import { parseMetadataXml } from '../utils/registry';
import { lstatSync, existsSync, readdirSync } from 'fs';

export abstract class BaseTreeContainer implements TreeContainer {
  public find(
    fileType: 'content' | 'metadata',
    fullName: string,
    dir: SourcePath
  ): SourcePath | undefined {
    const fileName = this.readDirectory(dir).find(entry => {
      const parsed = parseMetadataXml(join(dir, entry));
      const metaXmlCondition = fileType === 'metadata' ? !!parsed : !parsed;
      return baseName(entry) === fullName && metaXmlCondition;
    });
    if (fileName) {
      return join(dir, fileName);
    }
  }

  public abstract exists(path: SourcePath): boolean;
  public abstract isDirectory(path: SourcePath): boolean;
  public abstract readDirectory(path: SourcePath): string[];
}

export class NodeFSContainer extends BaseTreeContainer {
  public isDirectory(path: SourcePath): boolean {
    return lstatSync(path).isDirectory();
  }

  public exists(path: SourcePath): boolean {
    return existsSync(path);
  }

  public readDirectory(path: SourcePath): string[] {
    return readdirSync(path);
  }
}

export class VirtualTreeContainer extends BaseTreeContainer {
  private tree = new Map<SourcePath, Set<SourcePath>>();

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

  public readDirectory(path: string): string[] {
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
