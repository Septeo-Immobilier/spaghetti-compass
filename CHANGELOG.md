## [1.4.0](https://github.com/gh-septeo/spaghetti-compass/compare/v1.3.0...v1.4.0) (2026-06-30)

### ✨ Features

* **cli:** add reverse `impact` command with file-based route patterns ([f3a5cee](https://github.com/gh-septeo/spaghetti-compass/commit/f3a5cee09423183dddcc5fa1fd5fbd98da98ed3d))

### 🐛 Bug Fixes

* **resolver:** stop PHP/Python resolution from hijacking TS/JS relative imports ([b0b1e64](https://github.com/gh-septeo/spaghetti-compass/commit/b0b1e64b7ace02b9f0507ad51b877840db8fd0f1))

### ♻️ Refactoring

* **agent-setup:** simplify to skill-only with multi-destination support ([a799d0c](https://github.com/gh-septeo/spaghetti-compass/commit/a799d0c353e50abf77255d34d2ac81b797f7519e))

## [1.3.0](https://github.com/gh-septeo/spaghetti-compass/compare/v1.2.0...v1.3.0) (2026-02-12)

### ✨ Features

* **cli:** add agent-setup command and cursor workflow templates ([fabacfe](https://github.com/gh-septeo/spaghetti-compass/commit/fabacfeb1679d7c7bfd44e07045cdc375071ab2e))

### 📚 Documentation

* **spec:** add spec 7-agent-setup-cli artifacts ([e1fe13d](https://github.com/gh-septeo/spaghetti-compass/commit/e1fe13dd3c5f49b6cf2fb30746b768e05d21ad83))

## [1.2.0](https://github.com/gh-septeo/spaghetti-compass/compare/v1.1.0...v1.2.0) (2026-02-11)

### ✨ Features

* **lsp:** target class constructor in definition resolution ([984f20e](https://github.com/gh-septeo/spaghetti-compass/commit/984f20e45ff1b6ad76ecc994e197dbc30547348d))
* **parser:** expose class as entry point and extract new Class() calls ([d35d810](https://github.com/gh-septeo/spaghetti-compass/commit/d35d810051dd039ab40d009fe2fbcb329597dc05))

### 📚 Documentation

* **spec:** add spec 002 class constructor targeting ([abbb6a3](https://github.com/gh-septeo/spaghetti-compass/commit/abbb6a3ca5fd9f6cfdc7f5cb260c9544d5dfb527))

## [1.1.0](https://github.com/gh-septeo/spaghetti-compass/compare/v1.0.1...v1.1.0) (2026-02-10)

### ✨ Features

* **php:** add ComposerConfig, Psr4Mapping, PhpNamespaceResolution and resolvedVia on GraphEdge ([0a22573](https://github.com/gh-septeo/spaghetti-compass/commit/0a22573137a0749a478463df081f467e78c2973e))
* **php:** add ComposerConfig, Psr4Mapping, PhpNamespaceResolution and resolvedVia on GraphEdge ([3aeb467](https://github.com/gh-septeo/spaghetti-compass/commit/3aeb46706d4183bb981c152b290a5fae209acd04))
* **php:** add ComposerResolver for PSR-4 namespace resolution from composer.json ([21517d4](https://github.com/gh-septeo/spaghetti-compass/commit/21517d438f19513544f649374c13bb4a7adef491))
* **php:** add ComposerResolver for PSR-4 namespace resolution from composer.json ([c402095](https://github.com/gh-septeo/spaghetti-compass/commit/c402095c6dbc3ae44c3132cff89bf110cf90316c))
* **php:** extract property types from constructor and resolve $this->property->method() calls ([629af86](https://github.com/gh-septeo/spaghetti-compass/commit/629af86fc94b5b39a1ae82f8503fb32ac41c9158))
* **php:** extract property types from constructor and resolve $this->property->method() calls ([4ace1e9](https://github.com/gh-septeo/spaghetti-compass/commit/4ace1e9db0287e0e01b87c4d61d2507175aa13cd))
* **php:** resolve PHP method/class to definition line and ComposerResolver fallback without LSP ([16d907e](https://github.com/gh-septeo/spaghetti-compass/commit/16d907e07f1cfdcbec202addeecfb6672566e230))
* **php:** resolve PHP method/class to definition line and ComposerResolver fallback without LSP ([d113354](https://github.com/gh-septeo/spaghetti-compass/commit/d113354cc995c048f2cde5de7ef04f21db17d94a))
* **php:** resolve PHP namespaces in PathResolver via ComposerResolver and classify vendor/ ([be30a47](https://github.com/gh-septeo/spaghetti-compass/commit/be30a4733e0f72e88b79466a620873883855585f))
* **php:** resolve PHP namespaces in PathResolver via ComposerResolver and classify vendor/ ([7d4dade](https://github.com/gh-septeo/spaghetti-compass/commit/7d4dade2109e3032e30af0f782842e8ab291b549))

### 🐛 Bug Fixes

* **php:** resolve getDefinitionFromImport to class/method definition instead of use statement ([34df321](https://github.com/gh-septeo/spaghetti-compass/commit/34df3214e31e536d38b5f6517c1f269f43039e0f))
* **php:** resolve getDefinitionFromImport to class/method definition instead of use statement ([38defb2](https://github.com/gh-septeo/spaghetti-compass/commit/38defb2363fa42ae61e227b8081c95f31aa2052f))

### 📚 Documentation

* document PHP PSR-4 support and definition links ([56b391b](https://github.com/gh-septeo/spaghetti-compass/commit/56b391bfbf0c135d3145a7a87eca2dc8c4c27edb))
* document PHP PSR-4 support and definition links ([ee234c4](https://github.com/gh-septeo/spaghetti-compass/commit/ee234c4b1651f413cfe9f95de56b0b787303837d))

## [1.0.1](https://github.com/gh-septeo/spaghetti-compass/compare/v1.0.0...v1.0.1) (2026-02-05)

### 🐛 Bug Fixes

* cicd ([575cfe9](https://github.com/gh-septeo/spaghetti-compass/commit/575cfe9f666dd55693702968df04ab76d6bd6206))

## 1.0.0 (2026-02-05)

### ✨ Features

* **analyzer:** filter native methods and resolve imported file methods ([5b3ab5e](https://github.com/gh-septeo/spaghetti-compass/commit/5b3ab5e83690ea09973bd62b1bacfdfe3e5af75f))
* **analyzer:** implement recursive function exploration with depth limit ([11b1165](https://github.com/gh-septeo/spaghetti-compass/commit/11b1165319ab414a51f683f0268c8dd03c56e86b))
* **cli:** add clickable hyperlinks in terminal output ([6739250](https://github.com/gh-septeo/spaghetti-compass/commit/67392506c1f25e78afee7f0c94cc311a10e5fe8d))
* **cli:** add depth and same-file-only options for function exploration ([7030038](https://github.com/gh-septeo/spaghetti-compass/commit/7030038d3dd9e128e118c812d28d31fdd9fcbeeb))
* **cli:** add executable entry point ([3a4d8ca](https://github.com/gh-septeo/spaghetti-compass/commit/3a4d8ca83e02080a591d857f86b2febb19b0c4a5))
* **constitution:** créer la constitution CallGraph Explorer v1.0.0 ([941b5c9](https://github.com/gh-septeo/spaghetti-compass/commit/941b5c9b721c093f670ef3099ab57bd2398eb158))
* **core:** implement dependency graph analyzer ([02dbb4c](https://github.com/gh-septeo/spaghetti-compass/commit/02dbb4c7df7cbff4f06fc0a90374c4a256e8c425))
* **lsp-php:** support local intelephense installation ([2f380c9](https://github.com/gh-septeo/spaghetti-compass/commit/2f380c9f3d9af7e0532779827ca17bf2ff1eccb5))
* **lsp-ts:** improve resolution of this.property.method() calls ([b5ee009](https://github.com/gh-septeo/spaghetti-compass/commit/b5ee009694daf365cbe177af6aa0949d248c909a))
* **lsp:** add go-to-definition via typescript language service ([16c50d3](https://github.com/gh-septeo/spaghetti-compass/commit/16c50d3866690f031293231197a69b54fc2d7eb8))
* **lsp:** add json-rpc infrastructure for external lsp servers ([7839c95](https://github.com/gh-septeo/spaghetti-compass/commit/7839c95170e2c7dc50f178a35c80a812606931d5))
* **lsp:** add php and python lsp providers ([8e52fc7](https://github.com/gh-septeo/spaghetti-compass/commit/8e52fc72ce17d425d3aaeeed3f3267f200eda4aa))
* **npm:** add metadata for npm publication ([0721669](https://github.com/gh-septeo/spaghetti-compass/commit/07216696b867d20ecf57379a333b75c86ed787cc))
* **output:** add tree view for recursive function analysis ([43ca313](https://github.com/gh-septeo/spaghetti-compass/commit/43ca31360a7367f2efbfba7bedce560a9ffc9486))
* **parser:** add php and python parsers for multi-language support ([3ce62cb](https://github.com/gh-septeo/spaghetti-compass/commit/3ce62cb59c698cdacbdb23b91b734b24f9aa78ce))
* **parser:** detect callbacks and function variable assignments ([f250f08](https://github.com/gh-septeo/spaghetti-compass/commit/f250f08a32f9ff772bf38a97c65ee9e0fa9a41c3))
* **resolver:** add python and php relative import resolution ([a5e0d94](https://github.com/gh-septeo/spaghetti-compass/commit/a5e0d944feb521a85696446b8b92eb9a0239a53c))
* **tsconfig:** add typescript path alias resolution ([e51554b](https://github.com/gh-septeo/spaghetti-compass/commit/e51554b7f03df08606d4a6bee1031f87a383ec87))
* **types:** add depth tracking and call classification types ([b3c20ef](https://github.com/gh-septeo/spaghetti-compass/commit/b3c20ef3a5f0df18d85ab07f5275936dceea3e07))

### 🐛 Bug Fixes

* cicd ([e5b0acd](https://github.com/gh-septeo/spaghetti-compass/commit/e5b0acd3851a545ba11b2e9fa79853e49cb4d4ec))
* **cli:** correct file path parsing for entry without function ([c538aa4](https://github.com/gh-septeo/spaghetti-compass/commit/c538aa401f7dc40664d4edd07b44495c1e74be20))
* **esm:** use NodeNext module resolution for proper ESM support ([42d3495](https://github.com/gh-septeo/spaghetti-compass/commit/42d3495d6d1ac6fb1dd8352fa44dff6de5cfdd78))
* force unix line endings for scripts via .gitattributes ([82200f9](https://github.com/gh-septeo/spaghetti-compass/commit/82200f91235391f317422215a4a6c0b743e9e090))
* **graph:** differentiate recursive calls from circular dependencies ([bb42833](https://github.com/gh-septeo/spaghetti-compass/commit/bb428331b45c365fb5a28403062818f4c36de57a))
* **imports:** remove .js extensions for better IDE/LSP support ([5d7c9e6](https://github.com/gh-septeo/spaghetti-compass/commit/5d7c9e6d2a0c276e7c3d773bd214fc11490affb1))
* **parser-php:** improve function extraction and method call detection ([5907c77](https://github.com/gh-septeo/spaghetti-compass/commit/5907c771a4c8fdb99c1e7d8bc702ec0b7e973894))

### ♻️ Refactoring

* **lsp:** extract lsp provider architecture for multi-language support ([8489079](https://github.com/gh-septeo/spaghetti-compass/commit/8489079e992cf6b66040afc1f1a7dfa4543f150a))
* **parser:** introduce Parser interface and ParserFactory ([483de69](https://github.com/gh-septeo/spaghetti-compass/commit/483de693d839dea91faf8db7888eb9eef447ef07))

### 📚 Documentation

* add local installation instructions and quick start guide ([0971476](https://github.com/gh-septeo/spaghetti-compass/commit/0971476b0c5d2a19cee205348a0b7984ef5948db))
* add readme and implementation tasks ([71b69b3](https://github.com/gh-septeo/spaghetti-compass/commit/71b69b3c816a206614c709be50d226d8630e0ada))
* **readme:** add ai agent usage and json schema documentation ([88ab67f](https://github.com/gh-septeo/spaghetti-compass/commit/88ab67f86ba4d98d20f7b75dad2611bf0b047b7c))
* **readme:** add multi-language examples and supported languages table ([04f9594](https://github.com/gh-septeo/spaghetti-compass/commit/04f9594706a33252130e846f6918f136e4ddf5f9))
* **spec:** add clickable navigation specification ([67c58c2](https://github.com/gh-septeo/spaghetti-compass/commit/67c58c2c398ea4d3cfb6427fc414689fe1354094))
* **spec:** add multi-lsp support specification for php and python ([bcc5a8a](https://github.com/gh-septeo/spaghetti-compass/commit/bcc5a8ae8c262bd61c66d38f054b941978ad369a))
* **spec:** add tsconfig path aliases specification ([dd86958](https://github.com/gh-septeo/spaghetti-compass/commit/dd86958a6f43d5e5458fb55e6638e4cba7048533))
* **specs:** add agent integration specification ([67285e9](https://github.com/gh-septeo/spaghetti-compass/commit/67285e9b21f2ed99e3dfafd9532ff8b95246057b))
* update readme with clickable navigation feature ([c85fcf0](https://github.com/gh-septeo/spaghetti-compass/commit/c85fcf0c176f2cdc845a7f122e85e4403a398b14))

## 1.0.0 (2026-02-05)

### ✨ Features

* **analyzer:** filter native methods and resolve imported file methods ([5b3ab5e](https://github.com/gh-septeo/spaghetti-compass/commit/5b3ab5e83690ea09973bd62b1bacfdfe3e5af75f))
* **analyzer:** implement recursive function exploration with depth limit ([11b1165](https://github.com/gh-septeo/spaghetti-compass/commit/11b1165319ab414a51f683f0268c8dd03c56e86b))
* **cli:** add clickable hyperlinks in terminal output ([6739250](https://github.com/gh-septeo/spaghetti-compass/commit/67392506c1f25e78afee7f0c94cc311a10e5fe8d))
* **cli:** add depth and same-file-only options for function exploration ([7030038](https://github.com/gh-septeo/spaghetti-compass/commit/7030038d3dd9e128e118c812d28d31fdd9fcbeeb))
* **cli:** add executable entry point ([3a4d8ca](https://github.com/gh-septeo/spaghetti-compass/commit/3a4d8ca83e02080a591d857f86b2febb19b0c4a5))
* **constitution:** créer la constitution CallGraph Explorer v1.0.0 ([941b5c9](https://github.com/gh-septeo/spaghetti-compass/commit/941b5c9b721c093f670ef3099ab57bd2398eb158))
* **core:** implement dependency graph analyzer ([02dbb4c](https://github.com/gh-septeo/spaghetti-compass/commit/02dbb4c7df7cbff4f06fc0a90374c4a256e8c425))
* **lsp-php:** support local intelephense installation ([2f380c9](https://github.com/gh-septeo/spaghetti-compass/commit/2f380c9f3d9af7e0532779827ca17bf2ff1eccb5))
* **lsp-ts:** improve resolution of this.property.method() calls ([b5ee009](https://github.com/gh-septeo/spaghetti-compass/commit/b5ee009694daf365cbe177af6aa0949d248c909a))
* **lsp:** add go-to-definition via typescript language service ([16c50d3](https://github.com/gh-septeo/spaghetti-compass/commit/16c50d3866690f031293231197a69b54fc2d7eb8))
* **lsp:** add json-rpc infrastructure for external lsp servers ([7839c95](https://github.com/gh-septeo/spaghetti-compass/commit/7839c95170e2c7dc50f178a35c80a812606931d5))
* **lsp:** add php and python lsp providers ([8e52fc7](https://github.com/gh-septeo/spaghetti-compass/commit/8e52fc72ce17d425d3aaeeed3f3267f200eda4aa))
* **npm:** add metadata for npm publication ([0721669](https://github.com/gh-septeo/spaghetti-compass/commit/07216696b867d20ecf57379a333b75c86ed787cc))
* **output:** add tree view for recursive function analysis ([43ca313](https://github.com/gh-septeo/spaghetti-compass/commit/43ca31360a7367f2efbfba7bedce560a9ffc9486))
* **parser:** add php and python parsers for multi-language support ([3ce62cb](https://github.com/gh-septeo/spaghetti-compass/commit/3ce62cb59c698cdacbdb23b91b734b24f9aa78ce))
* **parser:** detect callbacks and function variable assignments ([f250f08](https://github.com/gh-septeo/spaghetti-compass/commit/f250f08a32f9ff772bf38a97c65ee9e0fa9a41c3))
* **resolver:** add python and php relative import resolution ([a5e0d94](https://github.com/gh-septeo/spaghetti-compass/commit/a5e0d944feb521a85696446b8b92eb9a0239a53c))
* **tsconfig:** add typescript path alias resolution ([e51554b](https://github.com/gh-septeo/spaghetti-compass/commit/e51554b7f03df08606d4a6bee1031f87a383ec87))
* **types:** add depth tracking and call classification types ([b3c20ef](https://github.com/gh-septeo/spaghetti-compass/commit/b3c20ef3a5f0df18d85ab07f5275936dceea3e07))

### 🐛 Bug Fixes

* **cli:** correct file path parsing for entry without function ([c538aa4](https://github.com/gh-septeo/spaghetti-compass/commit/c538aa401f7dc40664d4edd07b44495c1e74be20))
* **esm:** use NodeNext module resolution for proper ESM support ([42d3495](https://github.com/gh-septeo/spaghetti-compass/commit/42d3495d6d1ac6fb1dd8352fa44dff6de5cfdd78))
* force unix line endings for scripts via .gitattributes ([82200f9](https://github.com/gh-septeo/spaghetti-compass/commit/82200f91235391f317422215a4a6c0b743e9e090))
* **graph:** differentiate recursive calls from circular dependencies ([bb42833](https://github.com/gh-septeo/spaghetti-compass/commit/bb428331b45c365fb5a28403062818f4c36de57a))
* **imports:** remove .js extensions for better IDE/LSP support ([5d7c9e6](https://github.com/gh-septeo/spaghetti-compass/commit/5d7c9e6d2a0c276e7c3d773bd214fc11490affb1))
* **parser-php:** improve function extraction and method call detection ([5907c77](https://github.com/gh-septeo/spaghetti-compass/commit/5907c771a4c8fdb99c1e7d8bc702ec0b7e973894))

### ♻️ Refactoring

* **lsp:** extract lsp provider architecture for multi-language support ([8489079](https://github.com/gh-septeo/spaghetti-compass/commit/8489079e992cf6b66040afc1f1a7dfa4543f150a))
* **parser:** introduce Parser interface and ParserFactory ([483de69](https://github.com/gh-septeo/spaghetti-compass/commit/483de693d839dea91faf8db7888eb9eef447ef07))

### 📚 Documentation

* add local installation instructions and quick start guide ([0971476](https://github.com/gh-septeo/spaghetti-compass/commit/0971476b0c5d2a19cee205348a0b7984ef5948db))
* add readme and implementation tasks ([71b69b3](https://github.com/gh-septeo/spaghetti-compass/commit/71b69b3c816a206614c709be50d226d8630e0ada))
* **readme:** add ai agent usage and json schema documentation ([88ab67f](https://github.com/gh-septeo/spaghetti-compass/commit/88ab67f86ba4d98d20f7b75dad2611bf0b047b7c))
* **readme:** add multi-language examples and supported languages table ([04f9594](https://github.com/gh-septeo/spaghetti-compass/commit/04f9594706a33252130e846f6918f136e4ddf5f9))
* **spec:** add clickable navigation specification ([67c58c2](https://github.com/gh-septeo/spaghetti-compass/commit/67c58c2c398ea4d3cfb6427fc414689fe1354094))
* **spec:** add multi-lsp support specification for php and python ([bcc5a8a](https://github.com/gh-septeo/spaghetti-compass/commit/bcc5a8ae8c262bd61c66d38f054b941978ad369a))
* **spec:** add tsconfig path aliases specification ([dd86958](https://github.com/gh-septeo/spaghetti-compass/commit/dd86958a6f43d5e5458fb55e6638e4cba7048533))
* **specs:** add agent integration specification ([67285e9](https://github.com/gh-septeo/spaghetti-compass/commit/67285e9b21f2ed99e3dfafd9532ff8b95246057b))
* update readme with clickable navigation feature ([c85fcf0](https://github.com/gh-septeo/spaghetti-compass/commit/c85fcf0c176f2cdc845a7f122e85e4403a398b14))
