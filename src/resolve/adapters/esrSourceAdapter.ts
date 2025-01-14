/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataType, RegistryAccess } from '../../registry';
import { ForceIgnore } from '../forceIgnore';
import { NodeFSTreeContainer } from '../treeContainers';
import { MixedContentSourceAdapter } from './mixedContentSourceAdapter';

/**
 * Adapter for handling External Service Registration (ESR) source components.
 * Extends the MixedContentSourceAdapter to provide specific functionality for ESR components.
 *
 * Given a single ESR component, the adapter will:
 * - Identify the root metadata xml file
 * - Identify the content file(s) associated with the component from elements schema and serviceBinding from the xml
 */
export class EsrSourceAdapter extends MixedContentSourceAdapter {
  /**
   * Creates an instance of EsrSourceAdapter.
   *
   * @param {MetadataType} type - The metadata type for the ESR component.
   * @param {RegistryAccess} [registry=new RegistryAccess()] - The registry access instance.
   * @param {ForceIgnore} [forceIgnore=new ForceIgnore()] - The force ignore instance.
   * @param {NodeFSTreeContainer} [tree=new NodeFSTreeContainer()] - The file system tree container.
   */
  public constructor(
    type: MetadataType,
    registry: RegistryAccess = new RegistryAccess(),
    forceIgnore: ForceIgnore = new ForceIgnore(),
    tree: NodeFSTreeContainer = new NodeFSTreeContainer()
  ) {
    super(type, registry, forceIgnore, tree);
    this.metadataWithContent = false;
  }
}
