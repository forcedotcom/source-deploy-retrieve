import { Readable } from 'stream';
import { MetadataComponent } from '../types';

export class ComponentReader extends Readable {
  private components: MetadataComponent[];
  private i = 0;

  constructor(components: MetadataComponent[]) {
    super({ objectMode: true });
    this.components = components;
  }

  _read(size: number) {
    if (this.i < this.components.length - 1) {
      const c = this.components[this.i];
      this.i += 1;
      this.push(c);
    } else {
      this.push(null);
    }
  }
}
