import { expect, describe, it } from '@rstest/core';
import { getModuleName } from '../src/graph/module-graph/utils';
import { readPackageJson } from '../src/graph/package-graph/utils';
import { join } from 'path';
import fse from 'fs-extra';
/**
 * The following code is modified based on
 * https://github.com/relative-ci/bundle-stats/blob/master/packages/utils/src/webpack/__tests__/utils-get-module-name.js
 *
 * MIT Licensed
 * Author Viorel Cojocaru
 * Copyright 2019 Viorel Cojocaru, contributors.
 * https://github.com/relative-ci/bundle-stats/blob/master/LICENSE.md
 */
describe('Webpack/utils/getModuleName', () => {
  it('should return empty name if missing', () => {
    expect(getModuleName()).toBe('');
  });

  it('should return name as it is', () => {
    expect(getModuleName('./node_modules/lodash/_apply.js')).toBe(
      './node_modules/lodash/_apply.js',
    );
  });

  it('should remove loader details', () => {
    expect(
      getModuleName(
        '!babel-loader!eslint-loader!./node_modules/lodash/_apply.js',
      ),
    ).toBe('./node_modules/lodash/_apply.js');
    expect(
      getModuleName(
        '!babel-loader!eslint-loader!./node_modules/lodash/_apply.js',
      ),
    ).toBe('./node_modules/lodash/_apply.js');
    expect(
      getModuleName('plugin/src/loader.js?{"modules":["./src/main.js"]}!'),
    ).toBe('plugin/src/loader.js?{"modules":["./src/main.js"]}!');
  });

  it('should remove webpack module details', () => {
    expect(getModuleName('./node_modules/lodash/_apply.js + 7 modules')).toBe(
      './node_modules/lodash/_apply.js',
    );
  });

  it('should remove invalid node_modules prefix', () => {
    expect(
      getModuleName('css ../node_modules../node_modules/package-a/style.css'),
    ).toBe('../node_modules/package-a/style.css');
  });
});

describe('readPackageJson util', () => {
  it('readPackageJson util', () => {
    expect(
      readPackageJson(join(__dirname, './fixture/index/index.js'), (file) => {
        try {
          return fse.readJsonSync(file, { encoding: 'utf8' });
        } catch (e) {
          // console.log(e)
        }
      }),
    ).toMatchSnapshot();
  });
});
