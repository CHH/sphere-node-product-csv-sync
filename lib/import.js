/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var CONS, Errors, GLOBALS, Import, ProductSync, Promise, Repeater, SphereClient, Validator, _, _ref;

_ = require('underscore');

Promise = require('bluebird');

_ref = require('sphere-node-sdk'), SphereClient = _ref.SphereClient, ProductSync = _ref.ProductSync, Errors = _ref.Errors;

Repeater = require('sphere-node-utils').Repeater;

CONS = require('./constants');

GLOBALS = require('./globals');

Validator = require('./validator');

Import = (function() {
  function Import(options) {
    if (options == null) {
      options = {};
    }
    if (options.config) {
      this.client = new SphereClient(options);
      this.client.setMaxParallel(10);
      this.sync = new ProductSync;
      this.repeater = new Repeater({
        attempts: 3
      });
    }
    this.validator = new Validator(options);
    this.publishProducts = false;
    this.continueOnProblems = options.continueOnProblems;
    this.allowRemovalOfVariants = false;
    this.syncSeoAttributes = true;
    this.updatesOnly = false;
    this.dryRun = false;
    this.blackListedCustomAttributesForUpdate = [];
    this.customAttributeNameToMatch = void 0;
  }

  Import.prototype["import"] = function(fileContent) {
    return this.validator.parse(fileContent).then((function(_this) {
      return function(parsed) {
        console.log("CSV file with " + parsed.count + " row(s) loaded.");
        return _this.validator.validate(parsed.data).then(function(rawProducts) {
          var products, rawProduct, _i, _len;
          if (_.size(_this.validator.errors) !== 0) {
            return Promise.reject(_this.validator.errors);
          } else {
            products = [];
            console.log("Mapping " + (_.size(rawProducts)) + " product(s) ...");
            for (_i = 0, _len = rawProducts.length; _i < _len; _i++) {
              rawProduct = rawProducts[_i];
              products.push(_this.validator.map.mapProduct(rawProduct));
            }
            if (_.size(_this.validator.map.errors) !== 0) {
              return Promise.reject(_this.validator.map.errors);
            } else {
              console.log("Mapping done. About to process existing product(s) ...");
              return _this.client.productProjections.staged().all().fetch().then(function(payload) {
                var existingProducts, productsToUpdate;
                existingProducts = payload.body.results;
                console.log("Comparing against " + payload.body.total + " existing product(s) ...");
                _this.initMatcher(existingProducts);
                productsToUpdate = _this.validator.updateVariantsOnly ? _this.mapVariantsBasedOnSKUs(existingProducts, products) : products;
                console.log("Processing " + (_.size(productsToUpdate)) + " product(s) ...");
                return _this.createOrUpdate(productsToUpdate, _this.validator.types);
              }).then(function(result) {
                console.log("Finished processing " + (_.size(result)) + " product(s)");
                return Promise.resolve(result);
              });
            }
          }
        });
      };
    })(this));
  };

  Import.prototype.changeState = function(publish, remove, filterFunction) {
    if (publish == null) {
      publish = true;
    }
    if (remove == null) {
      remove = false;
    }
    this.publishProducts = true;
    return this.client.productProjections.staged(remove || publish).perPage(10).process((function(_this) {
      return function(result) {
        var action, existingProducts, filteredProducts, posts;
        existingProducts = result.body.results;
        console.log("Found " + (_.size(existingProducts)) + " product(s) ...");
        filteredProducts = _.filter(existingProducts, filterFunction);
        console.log("Filtered " + (_.size(filteredProducts)) + " product(s).");
        if (_.size(filteredProducts) === 0) {
          return Promise.resolve();
        } else {
          posts = _.map(filteredProducts, function(product) {
            if (remove) {
              return _this.deleteProduct(product, 0);
            } else {
              return _this.publishProduct(product, 0, publish);
            }
          });
          action = publish ? 'Publishing' : 'Unpublishing';
          if (remove) {
            action = 'Deleting';
          }
          console.log("" + action + " " + (_.size(posts)) + " product(s) ...");
          return Promise.all(posts);
        }
      };
    })(this)).then(function(result) {
      var filteredResult;
      filteredResult = _.filter(result, function(r) {
        return r;
      });
      console.log("Finished processing " + (_.size(filteredResult)) + " products");
      if (_.size(filteredResult) === 0) {
        return Promise.resolve('Nothing to do');
      } else {
        return Promise.resolve(filteredResult);
      }
    });
  };

  Import.prototype.initMatcher = function(existingProducts) {
    this.existingProducts = existingProducts;
    this.id2index = {};
    this.customAttributeValue2index = {};
    this.sku2index = {};
    this.sku2variantInfo = {};
    this.slug2index = {};
    return _.each(existingProducts, (function(_this) {
      return function(product, productIndex) {
        var slug, variants;
        _this.id2index[product.id] = productIndex;
        if (product.slug != null) {
          slug = product.slug[GLOBALS.DEFAULT_LANGUAGE];
          if (slug != null) {
            _this.slug2index[slug] = productIndex;
          }
        }
        product.variants || (product.variants = []);
        variants = [product.masterVariant].concat(product.variants);
        return _.each(variants, function(variant, variantIndex) {
          var sku;
          sku = variant.sku;
          if (sku != null) {
            _this.sku2index[sku] = productIndex;
            _this.sku2variantInfo[sku] = {
              index: variantIndex - 1,
              id: variant.id
            };
          }
          if (_this.customAttributeNameToMatch != null) {
            return _this.customAttributeValue2index[_this.getCustomAttributeValue(variant)] = productIndex;
          }
        });
      };
    })(this));
  };

  Import.prototype.mapVariantsBasedOnSKUs = function(existingProducts, products) {
    var productsToUpdate;
    console.log("Mapping variants for " + (_.size(products)) + " product type(s) ...");
    productsToUpdate = {};
    _.each(products, (function(_this) {
      return function(entry) {
        return _.each(entry.product.variants, function(variant) {
          var existingProduct, productIndex, variantInfo, _ref1;
          productIndex = _this.sku2index[variant.sku];
          if (productIndex != null) {
            existingProduct = ((_ref1 = productsToUpdate[productIndex]) != null ? _ref1.product : void 0) || _.deepClone(existingProducts[productIndex]);
            variantInfo = _this.sku2variantInfo[variant.sku];
            variant.id = variantInfo.id;
            if (variant.id === 1) {
              existingProduct.masterVariant = variant;
            } else {
              existingProduct.variants[variantInfo.index] = variant;
            }
            return productsToUpdate[productIndex] = {
              product: existingProduct,
              header: entry.header,
              rowIndex: entry.rowIndex
            };
          } else {
            return console.warn("Ignoring variant as no match by SKU found for: ", variant);
          }
        });
      };
    })(this));
    return _.map(productsToUpdate);
  };

  Import.prototype.getCustomAttributeValue = function(variant) {
    var attrib;
    variant.attributes || (variant.attributes = []);
    attrib = _.find(variant.attributes, (function(_this) {
      return function(attribute) {
        return attribute.name === _this.customAttributeNameToMatch;
      };
    })(this));
    return attrib != null ? attrib.value : void 0;
  };

  Import.prototype.match = function(entry) {
    var index, product;
    product = entry.product;
    if (product.id != null) {
      index = this.id2index[product.id];
    }
    if (!index) {
      index = this._matchOnCustomAttribute(product);
    }
    if (!index) {
      if (product.masterVariant.sku != null) {
        index = this.sku2index[product.masterVariant.sku];
      }
    }
    if (!index && (entry.header.has(CONS.HEADER_SLUG) || entry.header.hasLanguageForBaseAttribute(CONS.HEADER_SLUG))) {
      if ((product.slug != null) && (product.slug[GLOBALS.DEFAULT_LANGUAGE] != null)) {
        index = this.slug2index[product.slug[GLOBALS.DEFAULT_LANGUAGE]];
      }
    }
    if (index > -1) {
      return this.existingProducts[index];
    }
  };

  Import.prototype._matchOnCustomAttribute = function(product) {
    var attribute, variants;
    attribute = void 0;
    if (this.customAttributeNameToMatch != null) {
      product.variants || (product.variants = []);
      variants = [product.masterVariant].concat(product.variants);
      _.find(variants, (function(_this) {
        return function(variant) {
          variant.attributes || (variant.attributes = []);
          attribute = _.find(variant.attributes, function(attrib) {
            return attrib.name === _this.customAttributeNameToMatch;
          });
          return attribute != null;
        };
      })(this));
    }
    if (attribute != null) {
      return this.customAttributeValue2index[attribute.value];
    }
  };

  Import.prototype.createOrUpdate = function(products, types) {
    return Promise.all(_.map(products, (function(_this) {
      return function(entry) {
        return _this.repeater.execute(function() {
          var existingProduct;
          existingProduct = _this.match(entry);
          if (existingProduct != null) {
            return _this.update(entry.product, existingProduct, types, entry.header, entry.rowIndex);
          } else {
            return _this.create(entry.product, entry.rowIndex);
          }
        }, function(e) {
          if (e.code === 504) {
            console.warn('Got a timeout, will retry again...');
            return Promise.resolve();
          } else {
            return Promise.reject(e);
          }
        });
      };
    })(this)));
  };

  Import.prototype._isBlackListedForUpdate = function(attributeName) {
    if (_.isEmpty(this.blackListedCustomAttributesForUpdate)) {
      return false;
    } else {
      return _.contains(this.blackListedCustomAttributesForUpdate, attributeName);
    }
  };

  Import.prototype.update = function(product, existingProduct, types, header, rowIndex) {
    var allSameValueAttributes, config, filtered;
    allSameValueAttributes = types.id2SameForAllAttributes[product.productType.id];
    config = [
      {
        type: 'base',
        group: 'white'
      }, {
        type: 'references',
        group: 'white'
      }, {
        type: 'attributes',
        group: 'white'
      }, {
        type: 'variants',
        group: 'white'
      }, {
        type: 'metaAttributes',
        group: 'white'
      }
    ];
    if (header.has(CONS.HEADER_PRICES)) {
      config.push({
        type: 'prices',
        group: 'white'
      });
    } else {
      config.push({
        type: 'prices',
        group: 'black'
      });
    }
    if (header.has(CONS.HEADER_IMAGES)) {
      config.push({
        type: 'images',
        group: 'white'
      });
    } else {
      config.push({
        type: 'images',
        group: 'black'
      });
    }
    filtered = this.sync.config(config).buildActions(product, existingProduct, allSameValueAttributes).filterActions((function(_this) {
      return function(action) {
        switch (action.action) {
          case 'setAttribute':
          case 'setAttributeInAllVariants':
            return (header.has(action.name) || header.hasLanguageForCustomAttribute(action.name)) && !_this._isBlackListedForUpdate(action.name);
          case 'changeName':
            return header.has(CONS.HEADER_NAME) || header.hasLanguageForBaseAttribute(CONS.HEADER_NAME);
          case 'changeSlug':
            return header.has(CONS.HEADER_SLUG) || header.hasLanguageForBaseAttribute(CONS.HEADER_SLUG);
          case 'setDescription':
            return header.has(CONS.HEADER_DESCRIPTION) || header.hasLanguageForBaseAttribute(CONS.HEADER_DESCRIPTION);
          case 'setMetaAttributes':
            return (header.has(CONS.HEADER_META_TITLE) || header.hasLanguageForBaseAttribute(CONS.HEADER_META_TITLE)) && (header.has(CONS.HEADER_META_DESCRIPTION) || header.hasLanguageForBaseAttribute(CONS.HEADER_META_DESCRIPTION)) && (header.has(CONS.HEADER_META_KEYWORDS) || header.hasLanguageForBaseAttribute(CONS.HEADER_META_KEYWORDS)) && _this.syncSeoAttributes;
          case 'addToCategory':
          case 'removeFromCategory':
            return header.has(CONS.HEADER_CATEGORIES);
          case 'setTaxCategory':
            return header.has(CONS.HEADER_TAX);
          case 'setSKU':
            return header.has(CONS.HEADER_SKU);
          case 'addVariant':
          case 'addPrice':
          case 'removePrice':
          case 'changePrice':
          case 'addExternalImage':
          case 'removeImage':
            return true;
          case 'removeVariant':
            return _this.allowRemovalOfVariants;
          default:
            throw Error("The action '" + action.action + "' is not supported. Please contact the SPHERE.IO team!");
        }
      };
    })(this));
    if (this.dryRun) {
      if (filtered.shouldUpdate()) {
        return Promise.resolve("[row " + rowIndex + "] DRY-RUN - updates for " + existingProduct.id + ":\n" + (_.prettify(filtered.getUpdatePayload())));
      } else {
        return Promise.resolve("[row " + rowIndex + "] DRY-RUN - nothing to update.");
      }
    } else {
      if (filtered.shouldUpdate()) {
        return this.client.products.byId(filtered.getUpdateId()).update(filtered.getUpdatePayload()).then((function(_this) {
          return function(result) {
            return _this.publishProduct(result.body, rowIndex).then(function() {
              return Promise.resolve("[row " + rowIndex + "] Product updated.");
            });
          };
        })(this))["catch"]((function(_this) {
          return function(err) {
            var msg;
            msg = "[row " + rowIndex + "] Problem on updating product:\n" + (_.prettify(err)) + "\n" + (_.prettify(err.body));
            if (_this.continueOnProblems) {
              return Promise.resolve("" + msg + " - ignored!");
            } else {
              return Promise.reject(msg);
            }
          };
        })(this));
      } else {
        return Promise.resolve("[row " + rowIndex + "] Product update not necessary.");
      }
    }
  };

  Import.prototype.create = function(product, rowIndex) {
    if (this.dryRun) {
      return Promise.resolve("[row " + rowIndex + "] DRY-RUN - create new product.");
    } else if (this.updatesOnly) {
      return Promise.resolve("[row " + rowIndex + "] UPDATES ONLY - nothing done.");
    } else {
      return this.client.products.create(product).then((function(_this) {
        return function(result) {
          return _this.publishProduct(result.body, rowIndex).then(function() {
            return Promise.resolve("[row " + rowIndex + "] New product created.");
          });
        };
      })(this))["catch"]((function(_this) {
        return function(err) {
          var msg;
          msg = "[row " + rowIndex + "] Problem on creating new product:\n" + (_.prettify(err)) + "\n" + (_.prettify(err.body));
          if (_this.continueOnProblems) {
            return Promise.resolve("" + msg + " - ignored!");
          } else {
            return Promise.reject(msg);
          }
        };
      })(this));
    }
  };

  Import.prototype.publishProduct = function(product, rowIndex, publish) {
    var action, data;
    if (publish == null) {
      publish = true;
    }
    action = publish ? 'publish' : 'unpublish';
    if (!this.publishProducts) {
      return Promise.resolve("Do not " + action + ".");
    } else if (publish && product.published && !product.hasStagedChanges) {
      return Promise.resolve("[row " + rowIndex + "] Product is already published - no staged changes.");
    } else {
      data = {
        id: product.id,
        version: product.version,
        actions: [
          {
            action: action
          }
        ]
      };
      return this.client.products.byId(product.id).update(data).then(function(result) {
        return Promise.resolve("[row " + rowIndex + "] Product " + action + "ed.");
      })["catch"]((function(_this) {
        return function(err) {
          if (_this.continueOnProblems) {
            return Promise.resolve("[row " + rowIndex + "] Product is already " + action + "ed.");
          } else {
            return Promise.reject("[row " + rowIndex + "] Problem on " + action + "ing product:\n" + (_.prettify(err)) + "\n" + (_.prettify(err.body)));
          }
        };
      })(this));
    }
  };

  Import.prototype.deleteProduct = function(product, rowIndex) {
    return this.client.products.byId(product.id)["delete"](product.version).then(function() {
      return Promise.resolve("[row " + rowIndex + "] Product deleted.");
    })["catch"](function(err) {
      return Promise.reject("[row " + rowIndex + "] Error on deleting product:\n" + (_.prettify(err)) + "\n" + (_.prettify(err.body)));
    });
  };

  return Import;

})();

module.exports = Import;
