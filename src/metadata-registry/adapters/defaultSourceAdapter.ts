import { BaseSourceAdapter } from './baseSourceAdapter';
import { MetadataComponent, SourcePath } from '../../types';

/**
 * The default source adapter. Handles simple types with no additional content.
 *
 * __Example Types__:
 *
 * Layouts, PermissionSets, FlexiPages
 *
 * __Example Structure__:
 * ```text
 * foos/
 * ├── foo.ext-meta.xml
 * ├── bar.ext-meta.xml
 *```
 */
export class DefaultSourceAdapter extends BaseSourceAdapter {
  protected getRootMetadataXmlPath(trigger: string): SourcePath {
    return trigger;
  }
  protected populate(component: MetadataComponent): MetadataComponent {
    return component;
  }
}
