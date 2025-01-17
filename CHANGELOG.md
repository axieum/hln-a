# Changelog

## [1.1.1](https://github.com/axieum/hln-a/compare/v1.1.0...v1.1.1) (2025-01-17)


### Bug Fixes

* **ark:** the last player was not always accounted for in the `/ark listplayers` command ([77b2c52](https://github.com/axieum/hln-a/commit/77b2c528010961c49b36a4cffdedf17f2713fdd9))

## [1.1.0](https://github.com/axieum/hln-a/compare/v1.0.1...v1.1.0) (2025-01-17)


### Features

* **ark:** add `/ark listplayers` command ([71924e9](https://github.com/axieum/hln-a/commit/71924e963274457222c7b3016eae00046d06688a))
* **ark:** add error feedback during the `/ark dinowipe` command ([8bb1c52](https://github.com/axieum/hln-a/commit/8bb1c52f5caf4e1ab6cc87b49376ea35a14cc505))
* **ark:** rename `/dinowipe` command to `/ark dinowipe` ([02eab35](https://github.com/axieum/hln-a/commit/02eab35c74b9e60e2d64c02553a2e454b1799745))

## [1.0.1](https://github.com/axieum/hln-a/compare/v1.0.0...v1.0.1) (2025-01-16)


### Bug Fixes

* **ark:** change the Extinction map's default emoji to 🌆 from ☄️ ([242337b](https://github.com/axieum/hln-a/commit/242337bf54f08a9398a957624da73cca9d33bd6a))
* **ark:** prefer pinging Discord roles in unedited messages ([5eba383](https://github.com/axieum/hln-a/commit/5eba383f8bacd26af330a9f8304da2fcf67940ac))
* **ark:** the `DestroyWildDinos` instruction was not always sent over RCON during the `/dinowipe` command ([015ab00](https://github.com/axieum/hln-a/commit/015ab004dcb7ba15b3c259062fea3981d66923db))

## [1.0.0](https://github.com/axieum/hln-a/compare/v0.1.0...v1.0.0) (2025-01-16)


### Features

* **ark:** add `/dinowipe` command ([4cd212d](https://github.com/axieum/hln-a/commit/4cd212dc58dc58569813ab366790e3f3b08a2e07))
* **db:** add sqlite database ([c777737](https://github.com/axieum/hln-a/commit/c777737481d28f275253388be3aab30c750c83b0))
* log into Discord and sync slash commands ([cfbf241](https://github.com/axieum/hln-a/commit/cfbf241abea4822be75e5c7c9d4653ffd0927d75))


### Performance Improvements

* unregister component callbacks if not interacted with after some time ([311beed](https://github.com/axieum/hln-a/commit/311beedf271cd2bf7bf513dd301d93b0ba929101))
