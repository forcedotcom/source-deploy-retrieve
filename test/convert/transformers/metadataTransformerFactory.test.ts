/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// describe('MetadataTransformerFactory', () => {
//   it('should return DefaultMetadataTransformer', () => {
//     const component = KEANU_COMPONENT;
//     const factory = new MetadataTransformerFactory(mockRegistry);
//     expect(factory.getTransformer(component)).to.deep.equal(
//       new DefaultMetadataTransformer(mockRegistry)
//     );
//   });

//   it('should return DecomposedMetadataTransformer', () => {
//     const component = REGINA_COMPONENT;
//     const transaction = new ConvertTransaction();
//     const factory = new MetadataTransformerFactory(mockRegistry, transaction);
//     expect(factory.getTransformer(component)).to.deep.equal(
//       new DecomposedMetadataTransformer(mockRegistry, transaction)
//     );
//   });

//   it('should return StaticResourceMetadataTransformer', () => {
//     const component = MC_SINGLE_FILE_COMPONENT;
//     const factory = new MetadataTransformerFactory(mockRegistry);
//     expect(factory.getTransformer(component)).to.deep.equal(
//       new StaticResourceMetadataTransformer(mockRegistry)
//     );
//   });
// });
