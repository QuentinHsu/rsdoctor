import axios from 'axios';
import {
  CachedInputFileSystem,
  create as ResolverCreator,
} from 'enhanced-resolve';
import fs from 'fs';
import { omit } from 'lodash';
import path from 'path';
import { logger } from '@rsdoctor/utils/logger';
import { Loader } from '@rsdoctor/utils/common';
import { Time } from '@rsdoctor/utils/common';
import { SDK, Plugin } from '@rsdoctor/types';
import { DevToolError } from '@rsdoctor/utils/error';
import { getSDK } from './sdk';
import { checkCirclePath } from './circleDetect';
import { ProxyLoaderInternalOptions, ProxyLoaderOptions } from '@/types';
import { Utils as BuildUtils, Types } from '@/build-utils/build';
import { isESMLoader, parseQuery } from '@/build-utils/build/utils';
import { Lodash } from '@rsdoctor/utils/common';

export function getInternalLoaderOptions(
  loaderContext: Plugin.LoaderContext<ProxyLoaderOptions>,
): ProxyLoaderInternalOptions {
  const options = loaderContext.getOptions();

  return options[Loader.LoaderInternalPropertyName];
}

export function getLoaderOptionsWithoutInternalKeys(
  loaderContext: Plugin.LoaderContext<ProxyLoaderOptions>,
) {
  const options = loaderContext.getOptions();
  const circlePaths: string[][] = [];
  const loaderOptions = omit(options, [Loader.LoaderInternalPropertyName]);

  checkCirclePath(loaderOptions, [], circlePaths, 0);

  if (circlePaths.length > 0) {
    circlePaths.forEach((_path) => {
      if (_path?.length > 0 && loaderOptions[_path[0]] !== '[Circular]') {
        loaderOptions[_path[0]] = '[Circular]';
      }
    });
  }

  return loaderOptions;
}

export function getOriginLoaderModule(
  loaderContext: Plugin.LoaderContext<ProxyLoaderOptions>,
): ReturnType<typeof BuildUtils.loadLoaderModule> {
  const { loader, cwd } = getInternalLoaderOptions(loaderContext);
  return BuildUtils.loadLoaderModule(loader, cwd);
}

export function shouldSkipLoader(
  loaderContext: Plugin.LoaderContext<ProxyLoaderOptions>,
) {
  const { skipLoaders, cwd, loader } =
    getInternalLoaderOptions(loaderContext) || {};

  if (!loader) return true;

  if (Array.isArray(skipLoaders) && skipLoaders.length) {
    if (skipLoaders.includes(loader)) return true;

    const loaderName = BuildUtils.extractLoaderName(loader, cwd);

    if (skipLoaders.includes(loaderName)) return true;
  }

  return false;
}

export function interceptLoader<T extends Plugin.BuildRuleSetRule>(
  rules: T[],
  loaderPath: string,
  options: Omit<ProxyLoaderInternalOptions, 'loader' | 'hasOptions'>,
  cwd = process.cwd(),
  resolveLoader?: Plugin.Configuration['resolve'],
): T[] {
  const loaderResolver = ResolverCreator.sync({
    fileSystem: new CachedInputFileSystem(fs, 4000),
    conditionNames: ['loader', 'require', 'node'],
    exportsFields: ['exports'],
    mainFiles: ['index'],
    mainFields: ['loader', 'main'],
    extensions: ['js', '.json'],
    modules: ['node_modules'],
    ...resolveLoader,
  });

  const resolve = (target: string) => {
    try {
      const result = loaderResolver({}, cwd, target);

      if (typeof result === 'string') {
        return result;
      }
    } catch (e) {
      // ..
    }

    return target;
  };

  return BuildUtils.mapEachRules(rules, (rule) => {
    if (
      rule.loader?.startsWith('builtin:') ||
      rule.loader?.endsWith('.mjs') ||
      isESMLoader(rule)
    ) {
      return rule;
    }
    const opts: ProxyLoaderOptions = {
      ...('options' in rule
        ? typeof rule.options === 'string'
          ? JSON.parse(rule.options)
          : rule.options
        : {}),
    };
    // In the childCompiler of mini-css-extract-plugin, the options[Loader.LoaderInternalPropertyName] of proxy-loader is set to proxy-loader, ultimately causing errors in the compilation of less files.
    opts[Loader.LoaderInternalPropertyName] =
      rule.loader &&
      /proxy.js/.test(rule.loader) &&
      'options' in rule &&
      typeof rule.options === 'object'
        ? rule.options[Loader.LoaderInternalPropertyName]
        : {
            ...options,
            hasOptions: 'options' in rule && Boolean(rule.options),
            loader: 'loader' in rule ? resolve(rule.loader!) : '',
          };

    return {
      ...rule,
      loader: loaderPath,
      options: opts,
    } as unknown as T;
  });
}

export async function reportLoader(
  ctx: Plugin.LoaderContext<ProxyLoaderOptions>,
  start: number,
  startHRTime: [number, number],
  isPitch: boolean,
  sync: boolean,
  code: string,
  err: Error | null | undefined,
  res: string | Buffer | null,
  sourceMap?: Types.SourceMapInput,
) {
  const end = Time.getCurrentTimestamp(start, startHRTime);
  const { loader, host } = getInternalLoaderOptions(ctx);
  const loaderData: SDK.LoaderData = [
    {
      resource: {
        path: ctx._module?.layer
          ? `${ctx.resourcePath}[${ctx._module.layer}]`
          : ctx.resourcePath,
        query: parseQuery(ctx.resourceQuery || '?'),
        queryRaw: ctx.resourceQuery,
        ext: path.extname(ctx.resourcePath).slice(1),
        ...(ctx._module?.layer ? { layer: ctx._module.layer } : {}),
      },
      loaders: [
        {
          loader: BuildUtils.extractLoaderName(loader),
          loaderIndex: ctx.loaderIndex,
          path: loader,
          input: code,
          result:
            typeof res === 'string' || Buffer.isBuffer(res)
              ? res.toString()
              : res,
          startAt: start,
          endAt: end,
          options: getLoaderOptionsWithoutInternalKeys(ctx),
          isPitch,
          sync,
          errors: err
            ? [
                new DevToolError(code, err.message, {
                  controller: { noStack: false, noColor: true },
                  stack: err.stack,
                }),
              ]
            : [],
          pid: process.pid,
          ppid: process.ppid,
        },
      ],
    },
  ];
  const data: Types.SourceMap = !sourceMap
    ? {}
    : Lodash.isString(sourceMap)
      ? JSON.parse(sourceMap)
      : sourceMap;
  const sourceMapData = {
    version: data.version ?? -1,
    sources: data.sources ?? [],
    names: data.names ?? [],
    sourceRoot: data.sourceRoot,
    sourcesContent: data.sourcesContent,
    mappings: data.mappings,
    file: loaderData[0].resource.path,
  };

  // sdk exists means in the same process
  const sdk = getSDK(ctx._compilation?.name);

  if (sdk?.reportLoader && !('parent' in sdk && sdk.parent)) {
    sdk.reportLoader(loaderData);
    sdk.reportSourceMap(sourceMapData);
    return loaderData;
  }

  // fallback to request the url to report loader data
  await Promise.all([
    axios
      .post(`${host}${SDK.ServerAPI.API.ReportLoader}`, loaderData, {
        timeout: 8888,
      })
      .catch((err: Error) => {
        logger.debug(`${err.message}`, '[WebpackPlugin.ReportLoader][error]');
      }),
    axios
      .post(`${host}${SDK.ServerAPI.API.ReportSourceMap}`, sourceMapData, {
        timeout: 8888,
      })
      .catch((err: Error) => {
        logger.debug(
          `${err.message}`,
          '[WebpackPlugin.ReportSourceMap][error]',
        );
      }),
  ]);

  return loaderData;
}
