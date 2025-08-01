export const toolDescriptions = {
  getAllChunks: 'get all chunks',
  getChunkById:
    'get chunk by id, if chunk not found, return `Chunk not found`, and stop the execution',
  getModuleById: `
    get module detail by id (Rspack or Webpack module id)：
    - id: the id of the module (corresponds to Rspack or Webpack's internal module id)
    - issuerPath: the referrer chain (array of module ids, from entry to this module)
    - dependencies: direct dependencies (array of module ids this module imports/requires)
    - allDependencies: all transitive dependencies (if user asks for detail)
    - chunks: array of chunk ids this module belongs to
    - imported: array of module ids that import this module
    - isEntry: whether this module is an entry point
    - size: { sourceSize, transformedSize, parsedSize }
    - layer, modules, rootModule, webpackId: advanced info
    - bailoutReason: if present, the reason why this module is not tree-shaken or optimized away (e.g. "side effects", "dynamic import", "unknown exports", etc.)
    - Please use Rspack or Webpack's terminology for all fields.
    - If user asks for "why not tree-shaken", always return bailoutReason and explain in plain language.
    - If user asks for "who imported this module", return issuerPath as a dependency chain.
    - If user asks for "all dependencies", return allDependencies.
  `,
  getModuleByPath: `
    get module detail by module name or path (absolute or relative, as in Rspack or Webpack stats)
    - If multiple modules match, return all matched module paths and stop, let user select.
    - Otherwise, return the same fields as getModuleById.
    - Always include bailoutReason if present.
    - If user asks for "why is this module in the bundle", show the full issuerPath chain.
    - If user asks for "why not tree-shaken", show bailoutReason and explain.
  `,
  getModuleIssuerPath: `
    get module issuer path (who imported this module, recursively)
    - Return as a dependency chain (array of module ids from entry to this module)
    - If possible, render as a tree or graph for clarity.
    - For each module in the chain, show its path and (if present) bailoutReason.
  `,
  getPackageInfo: 'get package info',
  getPackageDependency: 'get package dependency',
  getRuleInfo: `get rules info, the rules info is a Record<{id: number, name: string, description: string, severity: string, category: string, module: string, path: string, line: number, column: number, message: string, fix: string}>, where:
  - id: an incremental sequence mark
  - name: the name of the rule
  - description: the description of the rule
  - severity: the severity of the rule
  - category: the category of the rule
  - E1001 Duplicate Packages:
      #### Description

      there is a same name package which bundled more than one version in your application.

      it is not good to the bundle size of your application.

      #### General Solution

      add an entry in \`resolve.alias\` which will configure Webpack to route any package references to a single specified path.

      For example, if \`lodash\` is duplicated in your bundle, the following configuration would render all Lodash imports to always refer to the \`lodash\` instance found at \`./node_modules/lodash\`:

      \`\`\`js
      {
        alias: {
          lodash: path.resolve(__dirname, 'node_modules/lodash')
        }
      }
      \`\`\`
      ,
  - E1002 Cross Chunks Packages:  #### Description
    There is a package with the same version that is duplicated across different chunks in your application. This redundancy increases the overall bundle size, which is not optimal for performance.

    #### General Solution

    To address this issue, you can use Rspack's **SplitChunksPlugin** to extract common dependencies into a separate chunk. This ensures that the same package is not duplicated across multiple chunks, thereby reducing the bundle size.

    For example, if **lodash** is being duplicated across different chunks, you can configure the **optimization.splitChunks** option in your Webpack configuration to extract **lodash** into a separate chunk:

    \`\`\`
    module.exports = {
      optimization: {
        splitChunks: {
          cacheGroups: {
            commons: {
              test: /[\\/]node_modules[\\/]lodash[\\/]/,
              name: 'lodash',
              chunks: 'all',
            },
          },
        },
      },
    };
    \`\`\`

    This configuration will automatically split out common dependencies (including those from \`node_modules\`) into separate chunks, ensuring that no package is duplicated across different chunks.

  - E1004 ECMA Version Check:
      #### Description
      This rule is used to detect incompatible advanced syntax. When scanning the rule, the configuration of browserslist is prioritized.
  `,
  getSimilarPackages: `get similar packages. Similar packages are categorized as follows, with each line representing a category of similar packages. The presence of packages below does not necessarily mean there are similar packages - replacement should only be considered when packages from the same category exist:
    1. cannot exist simultaneously: lodash、lodash-es、string_decode：Consider migrating to lodash-es for better Tree Shaking support. /n
    2. cannot exist simultaneously: dayjs, moment, date-fns, js-joda. Consider using dayjs to replace moment for smaller bundle size. /n
    3. cannot exist simultaneously: antd, material-ui, semantic-ui-react, material-ui, arco-design /n
    4. cannot exist simultaneously: axios, node-fetch
    5. cannot exist simultaneously: redux, mobx, Zustand, Recoil, Jotai
    6. cannot exist simultaneously: chalk, colors, picocolors, kleur
    7. cannot exist simultaneously: fs-extra, graceful-fs

    It's fine to have any of the above packages in your project, but packages from the same category (i.e. same line) should not coexist.
    If there are no similar packages, just return that there are no similar packages, without listing which packages exist.
    Please provide a simple response without listing all packages.
  `,

  getMediaAssetPrompt: `
    get media chunk prompt
    
    The first, for image assets, when using image resources:
      - Mobile: Ideally, a single image file should not exceed 60KB, and Base64 format SVG should not exceed 7KB.
      - PC: Ideally, a single image file should not exceed 200KB, and Base64 format SVG should not exceed 20KB.

      Optimization suggestions for oversized media resources:
      1. Large image resources can be compressed using image compression tools, for example: @rsbuild/plugin-image-compress (SVG are compressed by svgo, other images are compressed by @napi-rs/image.)
      2. SVG resources
        - Use SVG optimization tools to optimize SVG paths etc., for example: SVGO
        - Generate simple SVGs programmatically
      3. Consider whether using SVG resources is necessary.
      4. Split by compression characteristics
        - PNG image compression algorithm is suitable for images with fewer colors and clear boundaries, such as text or patterns composed of a few colors
        - JPG image compression algorithm is suitable for images with more gradients and natural transitions, such as landscapes, portraits, or irregular gradient patterns
        - base64 is suitable for important images with small file sizes to reduce network requests and render immediately. After base64 encoding, binary image data will increase by one-third in size, but after gzip compression, the size will increase by no more than 10%.


    The second, for font assets, when using font resources:
      1. Prefer using .woff2 format: .woff2 is a modern web font format with the highest compression ratio and good compatibility (supported by most modern browsers).
        - Single font file size:
          It is recommended to keep single font file size under 100KB.
          If large font files must be used, try to split them into font subsets.
        - Total font file size:
          The total font file size for the entire page should be kept under 300KB.
          For mobile devices, try to keep the total font size under 200KB.
        - Browser support for different font formats varies, and the size of the same font in different formats is also different. It is recommended not to use fonts other than ttf, woff, woff2.
      
      2. Font file optimization techniques
        - Font subsetting: Use tools (like Glyphhanger or Font Subsetter) to generate font subsets containing only needed characters, significantly reducing file size.
        - Use system fonts: Prioritize system default fonts (like Arial, Helvetica, Georgia, etc.) to avoid loading custom fonts.
        - Load fonts on demand: Use font-display: swap or @font-face unicode-range property to load fonts as needed.
        - Compress font files: Ensure server enables Gzip or Brotli compression to further reduce font file sizes.
        - Use variable fonts: Variable fonts can replace multiple font weight and width files, reducing the number and size of files.

    The third, for video assets, when using video resources:
      Lighthouse checks video files loaded in the page and provides the following recommendations:
        - Video file size: It is recommended that a single video file does not exceed 500KB.
        - Total video resource size: The total size of all video resources loaded on the page should be kept under 1MB if possible.

      Optimization suggestions for oversized media resources:
        - Optimization suggestions
          - Compress video files: Use tools (like HandBrake or FFmpeg) to compress video files and reduce file size.
          - Choose appropriate formats:
            - Use MP4 (H.264 codec) as the default format for best compatibility.
            - Use WebM (VP9 codec) as a modern format for higher compression rates.
          - Load videos on demand: Use lazy loading (e.g., loading="lazy") for non-critical videos to reduce initial load time.
          - Streaming technology: For long videos, use streaming technologies (like HLS or DASH) for segmented loading.
          - Remove unused videos: Detect and remove unused video resources.
          
        - Video preloading
          - The preload attribute has three available options: auto|metadata|none. The default setting is metadata. These settings control how much of the video file is downloaded during page load. You can save data by delaying downloads of less popular videos.

          - Setting preload="none" results in the video not being downloaded until playback begins. This delays startup but can save significant data for videos that are less likely to be played.

          - For more moderate bandwidth savings, you can set preload="metadata", which may download about 3% of the video during page load. This is a useful option for some small or medium-sized files.

          - Changing the setting to auto tells the browser to automatically download the entire video. Only do this when playback is very likely. Otherwise, it will waste a lot of bandwidth.
      
  `,

  getBunldeOptimize: `
    getBundleOptimize calls multiple functions to provide conclusions to users:
      - getRuleInfo for duplicate packages
      - GetSimilarPackages to check if there are similar packages that need optimization
      - getMediaAssetPrompt to check if media assets need optimization
      - GetAllChunks to check if there are oversized resources and provide splitChunk suggestions
  `,

  analysisExamples: `
    # Rspack or Webpack Analysis Examples

    1. "Why is node_modules/rc-tree/lib/util.js not tree-shaken?"
      - Return the module's bailoutReason, explain it in plain language.
      - Show the issuerPath (import chain) to this module.

    2. "Who imported lodash-es/constant.js?"
      - Show the issuerPath as a dependency chain.

    3. "List all modules in chunk 123"
      - Use getChunkById, then list all module paths.

    4. "Show all modules with side effects"
      - List all modules with non-empty bailoutReason containing 'side_effects'.

    5. "Why is package X duplicated?"
      - Use getRuleInfo to explain E1001/E1002, show which chunks and modules contain the duplicates.

    6. "Which modules are not tree-shaken due to side effects?"
      - List modules with bailoutReason containing 'side_effects', and show their paths and issuerPath.

    # Output format
    - For dependency chains, use a tree or arrow notation.
    - For module details, use a table or key-value list.
    - For explanations, use concise, plain language.
  `,
};
