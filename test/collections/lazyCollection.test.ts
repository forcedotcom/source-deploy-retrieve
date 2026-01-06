/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { expect } from 'chai';
import { LazyCollection } from '../../src/collections';

class TestCollection extends LazyCollection<number> {
  // partial implementation only for tests
  // eslint-disable-next-line class-methods-use-this
  public *[Symbol.iterator](): Iterator<number> {
    yield 2;
    yield 4;
    yield 6;
  }
}

describe('LazyCollection', () => {
  describe('first', () => {
    it('should return first item in the collection', () => {
      const numbers = [1, 2, 3];
      const collection = new LazyCollection(numbers);

      expect(collection.first()).to.equal(numbers[0]);
    });

    it('should utilize iterator of subclass if defined', () => {
      const collection = new TestCollection();

      expect(collection.first()).to.equal(2);
    });
  });

  describe('find', () => {
    const names = ['Justin', 'Molly', 'Analia', 'Aaron'];

    it('should return first element matching predicate', () => {
      const collection = new LazyCollection(names);

      const result = collection.find((name) => name.startsWith('A'));

      expect(result).to.equal(names[2]);
    });

    it('should return undefined if no element matches predicate', () => {
      const collection = new LazyCollection(names);

      const result = collection.find((name) => name === 'Tim');

      expect(result).to.be.undefined;
    });

    it('should utilize iterator of subclass if defined', () => {
      const collection = new TestCollection();

      const result = collection.find((number) => number % 3 === 0);

      expect(result).to.equal(6);
    });
  });

  describe('filter', () => {
    it('should create new collection with elements matching predicate', () => {
      const numbers = [1, 2, 3, 4, 5, 6];
      const collection = new LazyCollection(numbers);

      const result = collection.filter((number) => number % 2 === 0);

      expect(result.toArray()).to.deep.equal([2, 4, 6]);
    });

    it('should utilize iterator of subclass if defined', () => {
      const collection = new TestCollection();

      const result = collection.filter((number) => number > 3);

      expect(result.toArray()).to.deep.equal([4, 6]);
    });
  });

  describe('map', () => {
    it('should create a new collection with mapped elements', () => {
      const numbers = [1, 2, 3, 4, 5, 6];
      const collection = new LazyCollection(numbers);

      const result = collection.map((number) => number + 1);

      expect(result.toArray()).to.deep.equal([2, 3, 4, 5, 6, 7]);
    });

    it('should utilize iterator of subclass if defined', () => {
      const collection = new TestCollection();

      const result = collection.map((number) => number + 1);

      expect(result.toArray()).to.deep.equal([3, 5, 7]);
    });
  });

  describe('Daisy Chain', () => {
    it('should lazily process chained operation', () => {
      const numbers = [10, 9, 8, 7, 6, 5];
      const collection = new LazyCollection(numbers);
      let ticks = 0;

      const result = collection
        .map((number) => {
          ticks += 1;
          return number * 2;
        })
        .find((number) => {
          ticks += 1;
          return number > 15 && number < 20;
        });

      // should be half the ticks of using eager arrays in this scenario
      expect(ticks).to.equal(4);
      expect(result).to.equal(18);
    });
  });

  describe('[Symbol.iterator]', () => {
    it('should support for..of', () => {
      const numbers = [1, 2, 3, 4, 5, 6];
      const collection = new LazyCollection(numbers);
      let total = 0;

      for (const number of collection) {
        total += number;
      }

      expect(total).to.equal(21);
    });

    it('should return empty result if no iterable given', () => {
      const collection = new LazyCollection();
      let elementCount = 0;

      elementCount += collection.toArray().length;

      expect(elementCount).to.equal(0);
    });
  });
});
