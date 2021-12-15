import got from 'got';
import { CoverageObject } from '../../src/registry/types';

export const getCurrentApiVersion = async () => {
 return (
    JSON.parse((await got(`https://mdcoverage.secure.force.com/services/apexrest/report`)).body) as {
      versions: { selected: number };
    }
  ).versions.selected
}

export const getCoverage = async (apiVersion: number) => JSON.parse(
    (await got(`https://na${apiVersion - 9}.test1.pc-rnd.salesforce.com/mdcoverage/api.jsp`)).body
  ) as CoverageObject;
