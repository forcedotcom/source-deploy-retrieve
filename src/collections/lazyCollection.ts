/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export class LazyCollection<T> implements Iterable<T> {
  protected iterable: Iterable<T> | undefined;

  public constructor(iterable?: Iterable<T>) {
    this.iterable = iterable;
  }

  public first(): T | undefined {
    return this.getIterator().next().value as T | undefined;
  }

  public find(predicate: (element: T) => boolean): T | undefined {
    const iter = this.getIterator();
    let next = iter.next();
    while (!next.done) {
      if (predicate(next.value)) {
        return next.value;
      }
      next = iter.next();
    }
  }

  public filter(predicate: (element: T) => boolean): this {
    const iter = this.getIterator();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: valid syntax - invokes the constructor of the instance's type
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new this.constructor(
      (function* (): Iterable<T> {
        let next = iter.next();
        while (!next.done) {
          if (predicate(next.value)) {
            yield next.value;
          }
          next = iter.next();
        }
      })()
    );
  }

  public map<R>(mapper: (element: T) => R): LazyCollection<R> {
    const iter = this.getIterator();
    return new LazyCollection(
      (function* (): Iterable<R> {
        let next = iter.next();
        while (!next.done) {
          yield mapper(next.value);
          next = iter.next();
        }
      })()
    );
  }

  public toArray(): T[] {
    const result: T[] = [];
    const iter = this.getIterator();
    let next = iter.next();
    while (!next.done) {
      result.push(next.value);
      next = iter.next();
    }
    return result;
  }

  /**
   * USE getIterator() IN METHOD IMPLEMENTATIONS
   *
   * This is to support for..of syntax on non-subclass instances of
   * LazyCollection. getIterator() ensures we use [Symbol.iterator] of the
   * subclass if `iterable` is not set.
   */
  public [Symbol.iterator](): Iterator<T> {
    return this.iterable ? this.iterable[Symbol.iterator]() : [][Symbol.iterator]();
  }

  private getIterator(): Iterator<T> {
    return this.iterable ? this.iterable[Symbol.iterator]() : this[Symbol.iterator]();
  }
}
